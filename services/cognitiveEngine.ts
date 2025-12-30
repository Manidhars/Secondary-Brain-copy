import { recordBiasDriftSnapshot } from './storage';

export interface Proposal {
  summaryOfChange: string;
  suggestedEffects: string[]; // descriptive phrases only
  confidenceEstimate: number; // 0-1
  ambiguityEstimate: number; // 0-1
  followUpQuestions?: string[];
}

export interface Decision {
  action: 'apply' | 'askClarifyingQuestions' | 'defer' | 'ignore';
  reasons: string[];
  followUpQuestions: string[];
  memoryNotes?: string;
  biasSnapshot: DecisionBias;
}

export interface DecisionLogEntry {
  timestamp: number;
  proposal: Proposal;
  decision: Decision;
  explanation: string;
}

interface DecisionBias {
  clarityThresholdBias: number; // positive = more cautious
  ambiguityToleranceBias: number; // positive = more tolerant
  questioningBias: number; // positive = more inquisitive
  lastUpdated: number;
}

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
    .find((entry) => entry.proposal.summaryOfChange.toLowerCase().includes(normalizedSummary));
};

const shouldApply = (
  proposal: Proposal,
  past: DecisionLogEntry | undefined,
  contextSignals: { memoryStrength: number; identityConfidence: number }
) => {
  const adjustedAmbiguity = Math.min(1, Math.max(0, proposal.ambiguityEstimate - decisionBias.ambiguityToleranceBias));
  const baseClarity = proposal.confidenceEstimate * (1 - adjustedAmbiguity);
  const evidenceLift = (contextSignals.memoryStrength - 0.5) * 0.2 + (contextSignals.identityConfidence - 0.5) * 0.2;
  const historicalSupport = past ? 0.1 : 0;
  const clarityThreshold = Math.min(0.9, Math.max(0.5, 0.7 + decisionBias.clarityThresholdBias));
  return baseClarity + evidenceLift + historicalSupport >= clarityThreshold;
};

const shouldAskQuestions = (
  proposal: Proposal,
  past: DecisionLogEntry | undefined,
  contextSignals: { memoryStrength: number; identityConfidence: number }
) => {
  if (!proposal.followUpQuestions || proposal.followUpQuestions.length === 0) return false;
  const adjustedAmbiguity = Math.min(1, Math.max(0, proposal.ambiguityEstimate - decisionBias.ambiguityToleranceBias));
  const baseClarity = proposal.confidenceEstimate * (1 - adjustedAmbiguity);
  const evidenceLift = (contextSignals.memoryStrength - 0.5) * 0.2 + (contextSignals.identityConfidence - 0.5) * 0.2;
  const clarityScore = baseClarity + evidenceLift;
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
  const aSummary = a.proposal.summaryOfChange.toLowerCase();
  const bSummary = b.proposal.summaryOfChange.toLowerCase();
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

export const decideOnProposal = (
  proposal: Proposal,
  contextSignals: { memoryStrength?: number; identityConfidence?: number } = {}
): Decision => {
  adjustDecisionBias();
  const normalizedSignals = {
    memoryStrength: typeof contextSignals.memoryStrength === 'number' ? contextSignals.memoryStrength : 0.5,
    identityConfidence: typeof contextSignals.identityConfidence === 'number' ? contextSignals.identityConfidence : 0.5
  };
  const past = recentSimilarDecision(proposal.summaryOfChange);

  if (shouldApply(proposal, past, normalizedSignals)) {
    const decision: Decision = {
      action: 'apply',
      reasons: [
        `Clarity score suggests the update is well understood (${proposal.confidenceEstimate.toFixed(2)} confidence, ${proposal.ambiguityEstimate.toFixed(2)} ambiguity).`,
        past ? 'Recent similar decision reduced uncertainty.' : 'No conflicting history found.',
        `Context signals (memory strength ${normalizedSignals.memoryStrength.toFixed(2)}, identity confidence ${normalizedSignals.identityConfidence.toFixed(2)}) nudged acceptance.`
      ],
      followUpQuestions: [],
      memoryNotes: proposal.suggestedEffects.join('; '),
      biasSnapshot: { ...decisionBias }
    };
    decisionHistory.push({
      timestamp: Date.now(),
      proposal,
      decision,
      explanation: biasAwareExplanation(
        `Information is stable enough to apply; subtle self-signals reinforced the choice. (Clarity threshold: ${(0.7 + decisionBias.clarityThresholdBias).toFixed(2)})`
      )
    });
    return decision;
  }

  if (shouldAskQuestions(proposal, past, normalizedSignals)) {
    const decision: Decision = {
      action: 'askClarifyingQuestions',
      reasons: [
        `Ambiguity remains (${proposal.ambiguityEstimate.toFixed(2)}) and clarity score is low, so more details are needed.`,
        'No recent confirmations exist, so clarification is worthwhile.'
      ],
      followUpQuestions: proposal.followUpQuestions || [],
      biasSnapshot: { ...decisionBias }
    };
    decisionHistory.push({
      timestamp: Date.now(),
      proposal,
      decision,
      explanation: biasAwareExplanation(
        `Seek clarity before applying effects to prevent noisy memories. (Questioning threshold: ${(0.7 + decisionBias.questioningBias).toFixed(2)})`
      )
    });
    return decision;
  }

  const decision: Decision = {
    action: proposal.confidenceEstimate < 0.25 ? 'ignore' : 'defer',
    reasons: [
      'Confidence and ambiguity do not justify application yet.',
      past ? 'Past decisions already considered similar information.' : 'Waiting for a clearer signal.'
    ],
    followUpQuestions: [],
    biasSnapshot: { ...decisionBias }
  };
  decisionHistory.push({
    timestamp: Date.now(),
    proposal,
    decision,
    explanation: biasAwareExplanation(
      `Conserve cognitive effort until stronger evidence arrives. (Caution bias: ${decisionBias.clarityThresholdBias.toFixed(2)})`
    )
  });
  return decision;
};

export const runExampleFlow = async (
  proposal: Proposal,
  memoryContext: { memoryStrength?: number; identityConfidence?: number },
  persistMemory: (note: string) => void
) => {
  const decision = decideOnProposal(proposal, memoryContext);

  if (decision.action === 'apply') {
    persistMemory(decision.memoryNotes || proposal.summaryOfChange);
  }

  if (decision.action === 'askClarifyingQuestions') {
    console.log('Questions to ask before applying:', decision.followUpQuestions);
  }

  return { proposal, decision };
};
