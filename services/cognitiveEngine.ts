import { recordBiasDriftSnapshot } from './storage';

export interface ReasoningResult {
  summaryOfChange: string;
  confidence: number; // 0-1
  ambiguity: number; // 0-1
  questionsToAsk: string[];
  suggestedEffects: string[]; // descriptive phrases only
}

export interface Decision {
  action: 'storeMemory' | 'askClarifyingQuestions' | 'noAction';
  reasons: string[];
  followUpQuestions: string[];
  memoryNotes?: string;
}

export interface DecisionLogEntry {
  timestamp: number;
  reasoning: ReasoningResult;
  decision: Decision;
  explanation: string;
}

interface DecisionBias {
  clarityThresholdBias: number; // positive = more cautious
  ambiguityToleranceBias: number; // positive = more tolerant
  questioningBias: number; // positive = more inquisitive
  lastUpdated: number;
}

// Placeholder for the local reasoning function (LLM-backed) – treated as a black box.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare function reasonAboutMessage(input: string, memoryContext: any): ReasoningResult;

const decisionHistory: DecisionLogEntry[] = [];
const decisionBias: DecisionBias = {
  clarityThresholdBias: 0,
  ambiguityToleranceBias: 0,
  questioningBias: 0,
  lastUpdated: Date.now()
};

const biasAdjustmentNotes: string[] = [];

const recentSimilarDecision = (summary: string): DecisionLogEntry | undefined => {
  const normalizedSummary = summary.toLowerCase();
  return decisionHistory
    .slice(-5)
    .reverse()
    .find((entry) => entry.reasoning.summaryOfChange.toLowerCase().includes(normalizedSummary));
};

const shouldStore = (reasoning: ReasoningResult, past: DecisionLogEntry | undefined) => {
  const adjustedAmbiguity = Math.min(1, Math.max(0, reasoning.ambiguity - decisionBias.ambiguityToleranceBias));
  const clarityScore = reasoning.confidence * (1 - adjustedAmbiguity);
  const historicalSupport = past ? 0.1 : 0;
  const clarityThreshold = Math.min(0.9, Math.max(0.5, 0.7 + decisionBias.clarityThresholdBias));
  return clarityScore + historicalSupport >= clarityThreshold;
};

const shouldAskQuestions = (reasoning: ReasoningResult, past: DecisionLogEntry | undefined) => {
  if (reasoning.questionsToAsk.length === 0) return false;
  const adjustedAmbiguity = Math.min(1, Math.max(0, reasoning.ambiguity - decisionBias.ambiguityToleranceBias));
  const clarityScore = reasoning.confidence * (1 - adjustedAmbiguity);
  const redundantInquiry = past && past.decision.followUpQuestions.length > 0;
  const questioningThreshold = Math.min(0.9, Math.max(0.5, 0.7 + decisionBias.questioningBias));
  return clarityScore < questioningThreshold && !redundantInquiry;
};

const decayDecisionBias = () => {
  const now = Date.now();
  const elapsedMinutes = (now - decisionBias.lastUpdated) / 60000;
  if (elapsedMinutes <= 0) return;

  const decayAmount = Math.min(0.02, elapsedMinutes * 0.01);
  const soften = (value: number) => {
    if (value > 0) return Math.max(0, value - decayAmount);
    if (value < 0) return Math.min(0, value + decayAmount);
    return 0;
  };

  decisionBias.clarityThresholdBias = soften(decisionBias.clarityThresholdBias);
  decisionBias.ambiguityToleranceBias = soften(decisionBias.ambiguityToleranceBias);
  decisionBias.questioningBias = soften(decisionBias.questioningBias);
  decisionBias.lastUpdated = now;
};

const recordBiasAdjustment = (note: string) => {
  biasAdjustmentNotes.push(note);
};

const detectSimilar = (a: DecisionLogEntry, b: DecisionLogEntry) => {
  const aSummary = a.reasoning.summaryOfChange.toLowerCase();
  const bSummary = b.reasoning.summaryOfChange.toLowerCase();
  return aSummary.includes(bSummary) || bSummary.includes(aSummary);
};

const deriveFeedbackSignals = (history: DecisionLogEntry[]) => {
  const recent = history.slice(-10);
  let answeredClarifications = 0;
  let unansweredClarifications = 0;
  let corrections = 0;
  let reinforcements = 0;
  let stableSimilarDecisions = 0;

  recent.forEach((entry, index) => {
    if (entry.decision.action === 'askClarifyingQuestions') {
      const followUp = recent
        .slice(index + 1)
        .find((candidate) => detectSimilar(candidate, entry));
      if (followUp && followUp.decision.action === 'storeMemory') {
        answeredClarifications += 1;
      } else {
        unansweredClarifications += 1;
      }
    }

    if (entry.decision.action === 'storeMemory') {
      const laterStore = recent
        .slice(index + 1)
        .find((candidate) => candidate.decision.action === 'storeMemory' && detectSimilar(candidate, entry));
      if (laterStore) {
        const confidenceImproved = laterStore.reasoning.confidence >= entry.reasoning.confidence;
        const ambiguityReduced = laterStore.reasoning.ambiguity <= entry.reasoning.ambiguity;
        const selfCorrectionLanguage =
          /update|correction|revise|fix/i.test(laterStore.reasoning.summaryOfChange) ||
          /update|correction|revise|fix/i.test(laterStore.decision.reasons.join(' '));

        if (selfCorrectionLanguage || (!confidenceImproved && !ambiguityReduced)) {
          corrections += 1;
        } else {
          reinforcements += 1;
        }
      }
    }

    const stableRepeat = recent
      .slice(index + 1)
      .find((candidate) => candidate.decision.action === entry.decision.action && detectSimilar(candidate, entry));
    if (stableRepeat) {
      stableSimilarDecisions += 1;
    }
  });

  return { answeredClarifications, unansweredClarifications, corrections, reinforcements, stableSimilarDecisions };
};

const adjustDecisionBias = () => {
  biasAdjustmentNotes.length = 0;
  decayDecisionBias();
  const signals = deriveFeedbackSignals(decisionHistory);

  const clampBias = (value: number) => Math.min(0.15, Math.max(-0.15, value));

  if (signals.corrections > signals.reinforcements) {
    const shift = Math.min(0.05, 0.02 * (signals.corrections - signals.reinforcements));
    decisionBias.clarityThresholdBias = clampBias(decisionBias.clarityThresholdBias + shift);
    decisionBias.ambiguityToleranceBias = clampBias(decisionBias.ambiguityToleranceBias - shift / 2);
    recordBiasAdjustment(`Raised clarity threshold by ${shift.toFixed(2)} after detecting corrections.`);
  }

  if (signals.reinforcements > signals.corrections) {
    const shift = Math.min(0.04, 0.015 * (signals.reinforcements - signals.corrections));
    decisionBias.clarityThresholdBias = clampBias(decisionBias.clarityThresholdBias - shift);
    decisionBias.ambiguityToleranceBias = clampBias(decisionBias.ambiguityToleranceBias + shift / 2);
    recordBiasAdjustment(`Reduced caution by ${shift.toFixed(2)} due to reinforced stores.`);
  }

  if (signals.unansweredClarifications > signals.answeredClarifications) {
    const shift = Math.min(0.04, 0.02 * (signals.unansweredClarifications - signals.answeredClarifications));
    decisionBias.questioningBias = clampBias(decisionBias.questioningBias - shift);
    recordBiasAdjustment(`Lowered follow-up tendency by ${shift.toFixed(2)} because questions went unanswered.`);
  }

  if (signals.stableSimilarDecisions > 0) {
    const shift = Math.min(0.03, 0.01 * signals.stableSimilarDecisions);
    decisionBias.questioningBias = clampBias(decisionBias.questioningBias - shift / 2);
    decisionBias.ambiguityToleranceBias = clampBias(decisionBias.ambiguityToleranceBias + shift / 2);
    recordBiasAdjustment(`Smoothed biases (${shift.toFixed(2)}) after stable similar decisions.`);
  }

  if (signals.answeredClarifications > signals.unansweredClarifications) {
    const shift = Math.min(0.02, 0.01 * (signals.answeredClarifications - signals.unansweredClarifications));
    decisionBias.questioningBias = clampBias(decisionBias.questioningBias + shift / 2);
    recordBiasAdjustment(`Maintained inquisitiveness by ${shift.toFixed(2)} because clarifications were answered.`);
  }

  decisionBias.lastUpdated = Date.now();
  recordBiasDriftSnapshot({
    timestamp: decisionBias.lastUpdated,
    clarityThresholdBias: decisionBias.clarityThresholdBias,
    ambiguityToleranceBias: decisionBias.ambiguityToleranceBias,
    questioningBias: decisionBias.questioningBias,
    notes: [...biasAdjustmentNotes]
  });
};

const biasAwareExplanation = (base: string) => {
  if (biasAdjustmentNotes.length === 0) return base;
  return `${base} Bias shifts: ${biasAdjustmentNotes.join(' ')}`;
};

export const getDecisionBiasSnapshot = () => ({ ...decisionBias });

export const decideNextActions = (reasoning: ReasoningResult): Decision => {
  adjustDecisionBias();
  const past = recentSimilarDecision(reasoning.summaryOfChange);

  if (shouldStore(reasoning, past)) {
    const decision: Decision = {
      action: 'storeMemory',
      reasons: [
        `Clarity score suggests the update is well understood (${reasoning.confidence.toFixed(2)} confidence, ${reasoning.ambiguity.toFixed(2)} ambiguity).`,
        past ? 'Recent similar decision reduced uncertainty.' : 'No conflicting history found.'
      ],
      followUpQuestions: [],
      memoryNotes: reasoning.suggestedEffects.join('; ')
    };
    decisionHistory.push({
      timestamp: Date.now(),
      reasoning,
      decision,
      explanation: biasAwareExplanation(
        `Information is stable enough to persist; avoiding redundant questions. (Clarity threshold: ${(0.7 + decisionBias.clarityThresholdBias).toFixed(2)})`
      )
    });
    return decision;
  }

  if (shouldAskQuestions(reasoning, past)) {
    const decision: Decision = {
      action: 'askClarifyingQuestions',
      reasons: [
        `Ambiguity remains (${reasoning.ambiguity.toFixed(2)}) and clarity score is low, so more details are needed.`,
        'No recent confirmations exist, so clarification is worthwhile.'
      ],
      followUpQuestions: reasoning.questionsToAsk
    };
    decisionHistory.push({
      timestamp: Date.now(),
      reasoning,
      decision,
      explanation: biasAwareExplanation(
        `Seek clarity before storing to prevent noisy memories. (Questioning threshold: ${(0.7 + decisionBias.questioningBias).toFixed(2)})`
      )
    });
    return decision;
  }

  const decision: Decision = {
    action: 'noAction',
    reasons: [
      'Confidence and ambiguity do not justify storage yet.',
      past ? 'Past decisions already considered similar information.' : 'Waiting for a clearer signal.'
    ],
    followUpQuestions: []
  };
  decisionHistory.push({
    timestamp: Date.now(),
    reasoning,
    decision,
    explanation: biasAwareExplanation(
      `Conserve cognitive effort until stronger evidence arrives. (Caution bias: ${decisionBias.clarityThresholdBias.toFixed(2)})`
    )
  });
  return decision;
};

export const runExampleFlow = async (message: string, memoryContext: any, persistMemory: (note: string) => void) => {
  const reasoning = reasonAboutMessage(message, memoryContext);
  const decision = decideNextActions(reasoning);

  if (decision.action === 'storeMemory') {
    persistMemory(decision.memoryNotes || reasoning.summaryOfChange);
  }

  if (decision.action === 'askClarifyingQuestions') {
    console.log('Questions to ask before storing:', decision.followUpQuestions);
  }

  return { reasoning, decision };
};
