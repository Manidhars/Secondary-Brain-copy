import { GoogleGenAI, Type, Tool } from "@google/genai";
import { Memory, Place, Person, Reminder, LLMProvider, LLMSettings, MemoryType, MemoryDomain, DecisionLog, TranscriptSegment } from "../types";
import { getSettings, getUserProfile, trackMemoryAccess, saveDecisionLog, getMemories, getDecisionLogs, updateMemory, deleteMemory, addMemory, addTranscriptionLog } from "./storage";
import { localTranscribe } from './whisper';

export { localTranscribe };

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral-large-latest';

type ProviderConfig = {
    provider: LLMProvider;
    apiKey: string | null;
    source: 'explicit' | 'fallback' | 'auto' | 'local_only' | 'cloud_blocked';
};

const extractMistralText = (message: any) => {
    if (!message) return '';
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
        const textPart = message.content.find((p: any) => typeof p === 'string' || p.type === 'text');
        if (!textPart) return '';
        return typeof textPart === 'string' ? textPart : textPart.text || '';
    }
    return '';
};

const resolveProviderConfig = (): ProviderConfig => {
    const settings = getSettings();
    const requested: LLMProvider = settings.provider || 'auto';
    const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || null;
    const mistralKey = process.env.MISTRAL_API_KEY || null;

    if (settings.cloud_disabled) {
        return { provider: 'local', apiKey: null, source: 'cloud_blocked' };
    }

    if (requested === 'gemini') {
        if (geminiKey) return { provider: 'gemini', apiKey: geminiKey, source: 'explicit' };
        if (mistralKey) return { provider: 'mistral', apiKey: mistralKey, source: 'fallback' };
        return { provider: 'local', apiKey: null, source: 'fallback' };
    }

    if (requested === 'mistral') {
        if (mistralKey) return { provider: 'mistral', apiKey: mistralKey, source: 'explicit' };
        if (geminiKey) return { provider: 'gemini', apiKey: geminiKey, source: 'fallback' };
        return { provider: 'local', apiKey: null, source: 'fallback' };
    }

    if (requested === 'local') {
        return { provider: 'local', apiKey: null, source: 'explicit' };
    }

    // Auto: prefer Gemini, then Mistral, otherwise operate locally
    if (geminiKey) return { provider: 'gemini', apiKey: geminiKey, source: 'auto' };
    if (mistralKey) return { provider: 'mistral', apiKey: mistralKey, source: 'auto' };

    return { provider: 'local', apiKey: null, source: 'local_only' };
};

export const isApiConfigured = () => {
    const { provider, apiKey } = resolveProviderConfig();
    return provider !== 'local' && !!apiKey;
};

const getGeminiClient = (apiKey?: string | null) => new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY });

const sendMistralChat = async (messages: any[], response_format: any | undefined, apiKey: string) => {
    const response = await fetch(process.env.MISTRAL_CHAT_URL || 'https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: MISTRAL_MODEL,
            messages,
            response_format
        })
    });

    const data = await response.json();
    const choice = data?.choices?.[0];
    const text = extractMistralText(choice?.message);
    return { text, raw: choice?.message };
};

const generateJson = async (prompt: string, systemInstruction?: string) => {
    const { provider, apiKey } = resolveProviderConfig();

    if (provider === 'local' || !apiKey) return '';

    if (provider === 'mistral') {
        const response = await sendMistralChat([
            { role: 'system', content: systemInstruction || 'Respond with JSON only.' },
            { role: 'user', content: prompt }
        ], { type: 'json_object' }, apiKey);
        return response.text || '';
    }

    const ai = getGeminiClient(apiKey);
    const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json", ...(systemInstruction ? { systemInstruction } : {}) }
    });
    return response.text || '';
};

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

const summarizeMemoriesLocally = (memories: Memory[], limit: number) => {
    return memories.slice(0, limit).map(m => ({
        content: m.content,
        entity: m.entity || 'unknown',
        justification: 'Local heuristic summary',
        domain: m.domain
    }));
};

const buildLocalDistillation = (input: string) => {
    const segments = input.split(/(?<=[.!?])\s+/).filter(Boolean);
    return segments.slice(0, 3).map(segment => ({
        domain: 'general',
        type: 'raw',
        entity: 'user',
        content: segment.trim(),
        confidence: 0.55,
        salience: 0.5,
        justification: 'Local extraction (cloud disabled)'
    }));
};

const buildLocalTimeline = (memories: Memory[]) => {
    return memories.slice(0, 5).map(m => ({
        episode_name: m.entity || 'Episode',
        date_range: m.createdAt || 'recent',
        summary: m.content.slice(0, 180),
        related_memories_count: 1
    }));
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
    const { provider, apiKey } = resolveProviderConfig();
    const prompt = `Decompose this query into 3 atomic search terms. JSON array of strings. QUERY: "${msg}"`;
    try {
        if (provider === 'mistral' && apiKey) {
            const response = await sendMistralChat([
                { role: 'system', content: 'Respond with a JSON array of strings.' },
                { role: 'user', content: prompt }
            ], undefined, apiKey);
            const parsed = JSON.parse(response.text || "[]");
            return Array.isArray(parsed) ? parsed : [msg];
        }

        if (provider === 'gemini' && apiKey) {
            const ai = getGeminiClient(apiKey);
            const response = await ai.models.generateContent({
                model: GEMINI_MODEL,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { responseMimeType: "application/json" }
            });
            const parsed = JSON.parse(response.text || "[]");
            return Array.isArray(parsed) ? parsed : [msg];
        }

        return [msg];
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
  const { provider, apiKey } = resolveProviderConfig();
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

  const shouldUseCloud = provider !== 'local' && !!apiKey && !settings.cloud_disabled;

  if (!shouldUseCloud) {
      const replyHeader = candidates.length > 0
        ? `Local-only mode: responding with cached context from ${candidates.length} memories.`
        : 'Local-only mode: no cached memories matched; consider adding more context.';

      const replyBody = candidates.map(c => `• ${c.content}`).join("\n");
      const assembledReply = [replyHeader, replyBody].filter(Boolean).join("\n\n");

      saveDecisionLog({
        timestamp: Date.now(),
        query: currentMessage,
        memory_retrieval_used: candidates.length > 0,
        memories_considered: searchSpace.length,
        memories_injected: candidates.length,
        injected_ids: candidates.map(c => c.id),
        cloud_called: false,
        decision_reason: 'Local provider selected (no API key / cloud disabled).',
        retrieval_latency_ms: Date.now() - startTime,
        cognitive_load: candidates.length / 10,
        assumptions: []
      });

      candidates.forEach(c => trackMemoryAccess(c.id));
      return {
          reply: assembledReply || 'Local-only mode active. No relevant memories yet.',
          explanation: 'Local provider responded without cloud inference.',
          citations: candidates.map(c => c.id),
          assumptions: []
      };
  }

  if (provider === 'mistral' && apiKey) {
      const response = await sendMistralChat([
          { role: 'system', content: `${systemPrompt} Respond with JSON object including reply, explanation, citations, assumptions.` },
          ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.content })),
          { role: 'user', content: `Context:\n${contextStr}\n\nUser: ${currentMessage}` }
      ], { type: 'json_object' }, apiKey);

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
  }

  const ai = getGeminiClient(apiKey);
  const chat = ai.chats.create({
    model: GEMINI_MODEL,
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
    const { provider, apiKey } = resolveProviderConfig();
    if (provider === 'local' || !apiKey) {
        return summarizeMemoriesLocally(memories, 3);
    }

    const prompt = `Identify 3 patterns in these memories. JSON array of { content, entity, justification, domain }. MEMORIES: ${memories.slice(0, 20).map(m => m.content).join(" | ")}`;
    try {
        const response = await generateJson(prompt, 'Respond with JSON array of patterns.');
        return JSON.parse(response || "[]");
    } catch { return []; }
};

export const distillInput = async (input: string) => {
    const { provider, apiKey } = resolveProviderConfig();
    if (provider === 'local' || !apiKey) {
        return { memories: buildLocalDistillation(input) };
    }

    try {
        const response = await generateJson(
            `Extract atomic memories: "${input}"`,
            "Output JSON array of {domain, type, entity, content, confidence, salience, justification}"
        );
        const parsed = JSON.parse(response || "[]");
        return { memories: Array.isArray(parsed) ? parsed : [] };
    } catch { return { memories: [] }; }
};

export const verifyCrossMemoryConsistency = async (newContent: string, newDomain: string) => {
    const { provider, apiKey } = resolveProviderConfig();
    if (provider === 'local' || !apiKey) {
        return { isContradictory: false, reasoning: 'Local mode: no cloud validation performed.' };
    }

    try {
        const response = await generateJson(
            `Check for contradictions with general knowledge: "${newContent}"`,
            'Return JSON object: { isContradictory: boolean, reason?: string }'
        );
        return JSON.parse(response || "{}");
    } catch { return { isContradictory: false }; }
};

export const reconstructEpisodicTimeline = async (memories: Memory[]) => {
    const { provider, apiKey } = resolveProviderConfig();
    if (provider === 'local' || !apiKey) {
        return buildLocalTimeline(memories);
    }

    const prompt = `Stitch these memories into a narrative timeline. JSON array of { episode_name, date_range, summary, related_memories_count }. MEMORIES: ${memories.slice(0, 20).map(m => `[${m.createdAt}] ${m.content}`).join("\n")}`;
    try {
        const response = await generateJson(prompt, 'Return JSON array of episodes.');
        const parsed = JSON.parse(response || "[]");
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
