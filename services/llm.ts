import { GoogleGenAI, Type, Tool } from "@google/genai";
import { Memory, Place, Person, Reminder, LLMProvider, LLMSettings, MemoryType, MemoryDomain, DecisionLog, TranscriptSegment } from "../types";
import { getSettings, getUserProfile, trackMemoryAccess, saveDecisionLog, getMemories, getDecisionLogs, updateMemory, deleteMemory, addMemory, addTranscriptionLog } from "./storage";
import { localTranscribe } from './whisper';

export { localTranscribe };
export const isApiConfigured = () => {
    const settings = getSettings();
    if (settings.provider === 'local' || settings.orinMode || settings.cloud_disabled) {
        return !!settings.local_llm_endpoint;
    }
    return !!process.env.API_KEY;
};

// Fix: Use ai.models.generateContent with simplified contents string following SDK best practices
export const diarizeTranscription = async (text: string): Promise<TranscriptSegment[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Perform speaker diarization on this transcript. RESPONSE: JSON array of { speaker: string, text: string, timestamp: number }. TRANSCRIPT: "${text}"`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(response.text || "[]");
        return Array.isArray(parsed) ? parsed : [{ speaker: 'Unknown', text: text, timestamp: Date.now() }];
    } catch { 
        return [{ speaker: 'Unknown', text: text, timestamp: Date.now() }]; 
    }
};

/**
 * FEATURE: Memory-as-API (Rule 1)
 */
export const BrainService = {
    query: async (text: string) => {
        const memories = getMemories();
        return memories.filter(m => m.content.toLowerCase().includes(text.toLowerCase()));
    },
    getStats: () => {
        const mems = getMemories();
        const logs = getDecisionLogs();
        return {
            synapse_count: mems.length,
            avg_latency: logs.slice(0, 10).reduce((a, b) => a + b.retrieval_latency_ms, 0) / 10,
            load_factor: logs[0]?.cognitive_load || 0
        };
    },
    injectManual: (content: string, domain: MemoryDomain = 'general') => {
        return addMemory({ content, domain, type: 'raw', entity: 'API_INJECT', distilled_by: 'manual' });
    }
};

const memoryTools: Tool = {
  functionDeclarations: [
    {
      name: "modify_memory",
      description: "Update content of existing memory.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          memory_id: { type: Type.STRING },
          new_content: { type: Type.STRING },
          reason: { type: Type.STRING }
        },
        required: ["memory_id", "new_content"]
      }
    }
  ]
};

const callLocalLLM = async (
    payload: {
        prompt: string;
        history: { role: string; content: string }[];
        context: string;
        model: string;
        mode: 'active' | 'observer';
        endpoint?: string;
        apiKey?: string;
    }
) => {
    if (!payload.endpoint) {
        throw new Error('Local LLM endpoint not configured');
    }

    const response = await fetch(payload.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(payload.apiKey ? { Authorization: `Bearer ${payload.apiKey}` } : {})
        },
        body: JSON.stringify({
            prompt: payload.prompt,
            history: payload.history,
            context: payload.context,
            model: payload.model,
            mode: payload.mode
        })
    });

    if (!response.ok) {
        throw new Error(`Local LLM unreachable (${response.status})`);
    }

    const data = await response.json().catch(() => ({}));
    return {
        reply: data.reply || data.output || data.text,
        explanation: data.explanation || data.reasoning,
        citations: data.citations || [],
        assumptions: data.assumptions || []
    };
};

// Fix: Use ai.models.generateContent with simplified contents string
const decomposeUserQuery = async (msg: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Decompose this query into atomic search terms. RESPONSE: JSON array of strings. QUERY: "${msg}"`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(response.text || "[]");
        return Array.isArray(parsed) ? parsed : [msg];
    } catch { return [msg]; }
};

// Fix: Use chat.sendMessage and handle function calls following SDK best practices
export const consultBrain = async (
  history: { role: string; content: string; images?: string[] }[],
  currentMessage: string,
  memories: Memory[],
  isObserver: boolean = false,
  systemStatus: 'nominal' | 'degraded' | 'safe_mode' = 'nominal'
) => {
  const startTime = Date.now();
  const settings = getSettings();
  const profile = getUserProfile();
  
  const searchQueries = await decomposeUserQuery(currentMessage);
  
  let searchSpace = memories.filter(m => 
      m.cluster === settings.active_cluster && 
      (m.status === 'active' || (settings.deep_recall_enabled && m.status === 'cold_storage'))
  );
  
  const relevantFragments = new Set<Memory>();
  for (const q of searchQueries) {
      const lowerQ = q.toLowerCase();
      searchSpace.forEach(m => {
          if (m.content.toLowerCase().includes(lowerQ) || m.isPinned) {
              relevantFragments.add(m);
          }
      });
  }

  const isThrottled = systemStatus === 'degraded';
  const candidateLimit = isThrottled ? 4 : Math.floor(10 * settings.recall_sensitivity) + 5;

  const candidates = Array.from(relevantFragments)
      .sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return (b.salience * b.trust_score) - (a.salience * a.trust_score);
      })
      .slice(0, candidateLimit);

  const cognitiveLoad = candidates.length / 15;
  const contextStr = candidates.map(m => `[ID: ${m.id}]: ${m.content}`).join("\n");

  const systemPrompt = `
  You are 'Jarvis' for ${profile.name}.
  
  CONTEXT:
  ${contextStr || "No specific memories found."}

  METACOGNITION PROTOCOL:
  Reflect on your retrieval. What are you assuming about the user based on these memories?

  RESPONSE JSON FORMAT:
  {
    "reply": "Message",
    "explanation": "Reasoning",
    "citations": ["ID1"],
    "assumptions": ["Assumption 1"]
  }
  `;

  const useLocal = settings.provider === 'local' || settings.orinMode || settings.cloud_disabled;
  let parsed: any = { reply: "I encountered an error processing that request." };

  if (useLocal) {
      const local = await callLocalLLM({
          prompt: systemPrompt + `\n\nUser: ${currentMessage}`,
          history,
          context: contextStr,
          model: settings.local_llm_model || 'mistral',
          mode: isObserver ? 'observer' : 'active',
          endpoint: settings.local_llm_endpoint,
          apiKey: settings.local_api_key
      });
      parsed = local;
  } else {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          tools: isObserver || systemStatus === 'safe_mode' ? [] : [memoryTools],
          thinkingConfig: { thinkingBudget: isThrottled ? 0 : 2000 }
        },
        history: history.map(h => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: h.content }] }))
      });

      let response = await chat.sendMessage({ message: currentMessage });

      // Fix: Handle function calls explicitly and correctly
      if (response.functionCalls && response.functionCalls.length > 0) {
          for (const fc of response.functionCalls) {
              if (fc.name === 'modify_memory') {
                  updateMemory(fc.args.memory_id as string, {
                      content: fc.args.new_content as string,
                      justification: fc.args.reason as string
                  });
              }
          }
          // Re-query for final text response if model didn't provide it
          if (!response.text) {
              response = await chat.sendMessage({ message: "Processed tool. Please provide final response in the required JSON format." });
          }
      }

      try {
          parsed = JSON.parse(response.text || "{}");
      } catch (e) {
          console.warn("[Cliper] Gemini returned non-JSON text. Using fallback.", response.text);
          parsed.reply = response.text || parsed.reply;
      }
  }
  
  saveDecisionLog({
    timestamp: Date.now(),
    query: currentMessage,
    memory_retrieval_used: candidates.length > 0,
    memories_considered: searchSpace.length,
    memories_injected: candidates.length,
    injected_ids: candidates.map(c => c.id),
    cloud_called: !useLocal,
    decision_reason: `Recall depth: ${candidateLimit}. Mode: ${isObserver ? 'Observer' : 'Active'}`,
    retrieval_latency_ms: Date.now() - startTime,
    cognitive_load: cognitiveLoad,
    assumptions: parsed.assumptions || []
  });

  if (systemStatus !== 'safe_mode') {
      candidates.forEach(c => trackMemoryAccess(c.id));
  }

  return { 
      reply: parsed.reply || "Awaiting further input.", 
      explanation: parsed.explanation, 
      citations: parsed.citations,
      assumptions: parsed.assumptions
  };
};

// Fix: Use ai.models.generateContent with simplified contents string
export const generateLongitudinalInsights = async (memories: Memory[]) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const activeMems = memories.filter(m => m.status === 'active').slice(0, 50);
    const memData = activeMems.map(m => m.content).join("\n");
    const prompt = `Analyze memories for patterns. JSON array of { content, entity, justification, domain }`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt + "\n\nMEMORIES:\n" + memData,
            config: { responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(response.text || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
};

// Fix: Use ai.models.generateContent with simplified contents string
export const distillInput = async (input: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: `Distill: "${input}"`, 
            config: { 
                systemInstruction: "Extract memories. JSON array of {domain, type, entity, content, confidence, salience, justification}", 
                responseMimeType: "application/json" 
            } 
        });
        const parsed = JSON.parse(response.text || "[]");
        return { memories: Array.isArray(parsed) ? parsed : [] };
    } catch { return { memories: [] }; }
};

// Fix: Use ai.models.generateContent with simplified contents string
export const verifyCrossMemoryConsistency = async (newContent: string, newDomain: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: `Check consistency: "${newContent}"`, 
            config: { responseMimeType: "application/json" } 
        });
        return JSON.parse(response.text || "{}");
    } catch { return { isContradictory: false }; }
};

// Fix: Use ai.models.generateContent with simplified contents string
export const reconstructEpisodicTimeline = async (memories: Memory[]) => {
    if (memories.length === 0) return [];
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const memoryContext = memories.slice(0, 40).map(m => `[${m.createdAt}] ${m.content}`).join("\n");
    const prompt = `Construct narrative timeline. JSON Array: { episode_name, date_range, summary, related_memories_count }`;
    try {
        const response = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: prompt + "\n\nMEMORIES:\n" + memoryContext, 
            config: { responseMimeType: "application/json" } 
        });
        const parsed = JSON.parse(response.text || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
};

export const speakText = (t: string) => window.speechSynthesis.speak(new SpeechSynthesisUtterance(t));
export const memorySearch = { search: async (q: string, i: Memory[]) => i.filter(m => m.content.toLowerCase().includes(q.toLowerCase())).map(x => ({ item: x })) };
export const transcriptSearch = { search: async (q: string, i: any[]) => i.filter(m => m.content.toLowerCase().includes(q.toLowerCase())).map(x => ({ item: x })) };
export const placeSearch = { search: async (q: string, i: Place[]) => i.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).map(x => ({ item: x })) };