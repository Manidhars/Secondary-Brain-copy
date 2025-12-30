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

// Placeholder for the local reasoning function (LLM-backed) – treated as a black box.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare function reasonAboutMessage(input: string, memoryContext: any): ReasoningResult;

const decisionHistory: DecisionLogEntry[] = [];

const recentSimilarDecision = (summary: string): DecisionLogEntry | undefined => {
  const normalizedSummary = summary.toLowerCase();
  return decisionHistory
    .slice(-5)
    .reverse()
    .find((entry) => entry.reasoning.summaryOfChange.toLowerCase().includes(normalizedSummary));
};

const shouldStore = (reasoning: ReasoningResult, past: DecisionLogEntry | undefined) => {
  const clarityScore = reasoning.confidence * (1 - reasoning.ambiguity);
  const historicalSupport = past ? 0.1 : 0;
  return clarityScore + historicalSupport >= 0.7;
};

const shouldAskQuestions = (reasoning: ReasoningResult, past: DecisionLogEntry | undefined) => {
  if (reasoning.questionsToAsk.length === 0) return false;
  const clarityScore = reasoning.confidence * (1 - reasoning.ambiguity);
  const redundantInquiry = past && past.decision.followUpQuestions.length > 0;
  return clarityScore < 0.7 && !redundantInquiry;
};

export const decideNextActions = (reasoning: ReasoningResult): Decision => {
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
      explanation: 'Information is stable enough to persist; avoiding redundant questions.'
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
      explanation: 'Seek clarity before storing to prevent noisy memories.'
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
    explanation: 'Conserve cognitive effort until stronger evidence arrives.'
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
