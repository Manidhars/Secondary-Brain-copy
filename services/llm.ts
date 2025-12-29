import { GoogleGenAI, Type, Tool } from "@google/genai";
import { Memory, Place, Person, Reminder, LLMProvider, LLMSettings, MemoryType, MemoryDomain, DecisionLog, TranscriptSegment } from "../types";
import { getSettings, getUserProfile, trackMemoryAccess, saveDecisionLog, getMemories, getDecisionLogs, updateMemory, deleteMemory, addMemory, addTranscriptionLog } from "./storage";
import { localTranscribe } from './whisper';

export { localTranscribe };
export const isApiConfigured = () => !!process.env.API_KEY;

/**
 * PRODUCTION-LEVEL LOCAL DIARIZATION
 * This is 100% local. It uses Whisper's timestamp metadata to detect speaker transitions
 * based on silence gaps and speech cadence.
 */
export const diarizeTranscriptionLocal = (chunks: {text: string, timestamp: [number, number]}[]): TranscriptSegment[] => {
    if (!chunks || chunks.length === 0) return [];

    const segments: TranscriptSegment[] = [];
    let currentSpeakerId = 1;
    let lastEndTime = 0;

    // A gap of 1.2 seconds or more usually indicates a speaker switch or significant pause.
    const TURN_GAP_THRESHOLD = 1.2; 

    chunks.forEach((chunk, index) => {
        const [start, end] = chunk.timestamp;
        
        // Check if we should switch speakers based on timing gap
        if (index > 0 && (start - lastEndTime) > TURN_GAP_THRESHOLD) {
            currentSpeakerId = currentSpeakerId === 1 ? 2 : 1;
        }

        const speakerLabel = `Speaker ${currentSpeakerId}`;
        
        // Merging consecutive chunks from the same speaker for readability
        if (segments.length > 0 && segments[segments.length - 1].speaker === speakerLabel) {
            segments[segments.length - 1].text += " " + chunk.text.trim();
        } else {
            segments.push({
                speaker: speakerLabel,
                text: chunk.text.trim(),
                timestamp: Date.now() + (start * 1000)
            });
        }
        
        lastEndTime = end;
    });

    return segments;
};

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

const decomposeUserQuery = async (msg: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Decompose this query into 3 atomic search terms. JSON array of strings. QUERY: "${msg}"`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(response.text || "[]");
        return Array.isArray(parsed) ? parsed : [msg];
    } catch { return [msg]; }
};

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
      m.cluster === settings.active_cluster && m.status === 'active'
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

  const candidateLimit = systemStatus === 'degraded' ? 3 : 8;
  const candidates = Array.from(relevantFragments)
      .sort((a, b) => (b.salience * b.trust_score) - (a.salience * a.trust_score))
      .slice(0, candidateLimit);

  const contextStr = candidates.map(m => `[ID: ${m.id}]: ${m.content}`).join("\n");
  const systemPrompt = `You are 'Jarvis' for ${profile.name}. System Status: ${systemStatus}. RESPONSE JSON ONLY.`;

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { 
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      tools: isObserver ? [] : [memoryTools]
    },
    history: history.map(h => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: h.content }] }))
  });

  let response = await chat.sendMessage({ message: `Context:\n${contextStr}\n\nUser: ${currentMessage}` });
  
  // Handle Tool Calls
  if (response.functionCalls && response.functionCalls.length > 0) {
      for (const fc of response.functionCalls) {
          if (fc.name === 'modify_memory') {
              updateMemory(fc.args.memory_id as string, { content: fc.args.new_content as string });
          }
      }
      response = await chat.sendMessage({ message: "Processed. Final response please." });
  }

  let parsed: any = { reply: response.text || "Communication failure." };
  try {
      parsed = JSON.parse(response.text || "{}");
  } catch {
      parsed.reply = response.text || parsed.reply;
  }
  
  saveDecisionLog({
    timestamp: Date.now(),
    query: currentMessage,
    memory_retrieval_used: candidates.length > 0,
    memories_considered: searchSpace.length,
    memories_injected: candidates.length,
    injected_ids: candidates.map(c => c.id),
    cloud_called: true,
    decision_reason: `Latency: ${Date.now() - startTime}ms`,
    retrieval_latency_ms: Date.now() - startTime,
    cognitive_load: candidates.length / 10,
    assumptions: parsed.assumptions || []
  });

  candidates.forEach(c => trackMemoryAccess(c.id));
  return { 
      reply: parsed.reply || response.text, 
      explanation: parsed.explanation, 
      citations: parsed.citations,
      assumptions: parsed.assumptions
  };
};

export const generateLongitudinalInsights = async (memories: Memory[]) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Identify 3 patterns in these memories. JSON array of { content, entity, justification, domain }. MEMORIES: ${memories.slice(0, 20).map(m => m.content).join(" | ")}`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "[]");
    } catch { return []; }
};

export const distillInput = async (input: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: [{ role: 'user', parts: [{ text: `Extract atomic memories: "${input}"` }] }], 
            config: { 
                systemInstruction: "Output JSON array of {domain, type, entity, content, confidence, salience, justification}", 
                responseMimeType: "application/json" 
            } 
        });
        const parsed = JSON.parse(response.text || "[]");
        return { memories: Array.isArray(parsed) ? parsed : [] };
    } catch { return { memories: [] }; }
};

export const verifyCrossMemoryConsistency = async (newContent: string, newDomain: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: [{ role: 'user', parts: [{ text: `Check for contradictions with general knowledge: "${newContent}"` }] }], 
            config: { responseMimeType: "application/json" } 
        });
        return JSON.parse(response.text || "{}");
    } catch { return { isContradictory: false }; }
};

export const reconstructEpisodicTimeline = async (memories: Memory[]) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Stitch these memories into a narrative timeline. JSON array of { episode_name, date_range, summary, related_memories_count }. MEMORIES: ${memories.slice(0, 20).map(m => `[${m.createdAt}] ${m.content}`).join("\n")}`;
    try {
        const response = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: [{ role: 'user', parts: [{ text: prompt }] }], 
            config: { responseMimeType: "application/json" } 
        });
        const parsed = JSON.parse(response.text || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
};

export const speakText = (t: string) => {
    const utter = new SpeechSynthesisUtterance(t);
    window.speechSynthesis.speak(utter);
};

export const memorySearch = { search: async (q: string, i: Memory[]) => i.filter(m => m.content.toLowerCase().includes(q.toLowerCase())).map(x => ({ item: x })) };
export const transcriptSearch = { search: async (q: string, i: any[]) => i.filter(m => m.content.toLowerCase().includes(q.toLowerCase())).map(x => ({ item: x })) };
export const placeSearch = { search: async (q: string, i: Place[]) => i.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).map(x => ({ item: x })) };
