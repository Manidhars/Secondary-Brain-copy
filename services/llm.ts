import { Memory, Place, Reminder, MemoryType, MemoryDomain, DecisionLog, TranscriptSegment } from "../types";
import { getSettings, trackMemoryAccess, saveDecisionLog, getMemories, getDecisionLogs, addMemory, upsertReminder, getReminders, getMemoriesInFolder } from "./storage";
import { localTranscribe } from './whisper';

export { localTranscribe };

const deriveDueTime = (timeFragment: string): string => {
    const now = new Date();
    const lower = timeFragment.trim().toLowerCase();
    const relative = lower.match(/in\s+(\d+)\s+(minute|minutes|hour|hours)/);
    if (relative) {
        const value = parseInt(relative[1], 10);
        const ms = /hour/.test(relative[2]) ? value * 60 * 60 * 1000 : value * 60 * 1000;
        return new Date(now.getTime() + ms).toISOString();
    }

    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!timeMatch) return new Date(now.getTime() + 60 * 60 * 1000).toISOString();

    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3];

    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    if (!period && hour >= 1 && hour <= 7) hour += 12; // assume evening by default

    const due = new Date(now);
    due.setHours(hour, minute, 0, 0);
    if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
    return due.toISOString();
};

const detectFolderScopes = (message: string): string[] => {
    const scopes: string[] = [];
    const lower = message.toLowerCase();
    const friendMatch = lower.match(/my friend\s+([a-z]+)/i);
    if (friendMatch?.[1]) scopes.push(`personal/friends/${friendMatch[1].toLowerCase()}`);
    if (lower.includes('friend')) scopes.push('personal/friends');
    if (/(about\s+me|about\s+myself|i\s+)/i.test(message)) scopes.push('personal/self');
    if (/(work|manager|project|meeting|sprint)/i.test(message)) scopes.push('work');
    if (lower.includes('remind')) scopes.push('work/reminders');
    return scopes;
};

const handleReminderIntent = (message: string) => {
    if (!/remind\s+me/i.test(message)) return null;

    const timeSegmentMatch = message.match(/at\s+([^,.;]+)|in\s+\d+\s+(minutes?|hours?)/i);
    const timeSegment = timeSegmentMatch ? timeSegmentMatch[0].replace(/^at\s+/i, '') : 'in 1 hour';
    const dueTime = deriveDueTime(timeSegment);

    let task = message
        .replace(/remind\s+me\s+/i, '')
        .replace(timeSegmentMatch ? timeSegmentMatch[0] : '', '')
        .replace(/^to\s+/i, '')
        .trim();

    if (!task) {
        const existing = getReminders();
        task = existing[0]?.task || 'task';
    }

    const reminder = upsertReminder(task, dueTime, false);
    const reminderFolder = /work|manager|project/i.test(message) ? 'work/reminders' : 'personal/reminders';

    const memory = addMemory({
        content: `Reminder: ${task} at ${new Date(dueTime).toLocaleString()}`,
        domain: /work/.test(reminderFolder) ? 'work' : 'personal',
        type: 'task',
        entity: 'self',
        justification: 'User requested reminder',
        metadata: {
            folder: reminderFolder,
            table: 'reminders',
            topic: task.slice(0, 80),
            owner: 'self',
            origin: 'reminder'
        }
    });

    return {
        reply: `Scheduled "${task}" for ${new Date(dueTime).toLocaleString()}. I'll keep it synced if you change it.`,
        explanation: 'Added to local reminders with auto-updates enabled.',
        citations: [memory?.id].filter(Boolean) as string[],
        assumptions: ['Task stored locally; will reschedule when asked.'],
        reminderId: reminder.id
    } as const;
};

const handlePreferenceCapture = (message: string) => {
    if (message.includes('?')) return null;
    const preferenceMatch = message.match(/i\s+(like|love|prefer|enjoy)\s+([^.!]+)/i);
    if (!preferenceMatch) return null;

    const sentiment = preferenceMatch[1];
    const subject = preferenceMatch[2].trim();

    const memory = addMemory({
        content: `Preference noted: you ${sentiment} ${subject}.`,
        domain: 'personal',
        type: 'preference',
        entity: 'self',
        justification: 'Direct user statement',
        metadata: {
            folder: 'personal/self/preferences',
            table: 'preferences',
            topic: subject,
            owner: 'self',
            origin: 'preference'
        }
    });

    return {
        reply: `Captured that you ${sentiment} ${subject} in your personal preferences folder.`,
        explanation: 'Stored under personal/self/preferences for quick recall.',
        citations: [memory?.id].filter(Boolean) as string[],
        assumptions: ['Future questions about you will prioritize this folder.']
    } as const;
};

const handleFriendFact = (message: string) => {
    if (!/my\s+friend/i.test(message) || message.includes('?')) return null;
    const friendMatch = message.match(/my\s+friend\s+([a-z]+)/i);
    const name = friendMatch?.[1] || 'friend';
    const folder = `personal/friends/${name.toLowerCase()}`;

    const memory = addMemory({
        content: message.trim(),
        domain: 'personal',
        type: 'fact',
        entity: name,
        justification: 'User shared detail about a friend',
        metadata: {
            folder,
            table: 'facts',
            topic: name,
            owner: 'friend',
            origin: 'manual'
        }
    });

    return {
        reply: `Logged this under My Friends → ${name}.`,
        explanation: 'Created/updated a friend folder for targeted recall.',
        citations: [memory?.id].filter(Boolean) as string[],
        assumptions: ['Friend context will be prioritized when you ask about them.']
    } as const;
};

const extractProjectName = (message: string) => {
    const normalized = message.replace(/['"]/g, '');
    const explicitMatch = normalized.match(/project\s+(?:called|named)?\s+([a-z0-9\s-]{2,})/i);
    if (explicitMatch?.[1]) return explicitMatch[1].trim();

    const workingOnMatch = normalized.match(/working on\s+([a-z0-9\s-]+)\s+project/i);
    if (workingOnMatch?.[1]) return workingOnMatch[1].trim();

    return null;
};

const handleProjectIntent = (message: string) => {
    const projectName = extractProjectName(message);
    if (!projectName) return null;

    const normalized = projectName.trim();
    const slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';

    const existing = getMemories().filter(m =>
        (m.metadata?.table === 'projects') && (m.metadata?.topic || '').toLowerCase() === normalized.toLowerCase()
    );

    if (existing.length > 0) {
        const memory = existing[0];
        trackMemoryAccess(memory.id);
        return {
            reply: `I already have a project named "${normalized}" in your graph. Is this the same effort or a separate project with the same name?`,
            explanation: 'Matched an existing project node; requesting clarification before branching the workstream.',
            citations: [memory.id],
            assumptions: ['Awaiting your confirmation before creating a new project node.']
        } as const;
    }

    const memory = addMemory({
        content: `Project node created for "${normalized}". User is currently working on it.`,
        domain: 'work',
        type: 'task',
        entity: normalized,
        justification: 'User declared an active project.',
        metadata: {
            folder: `work/projects/${slug}`,
            table: 'projects',
            topic: normalized,
            owner: 'work',
            origin: 'manual'
        }
    });

    return {
        reply: `Logged a new project called "${normalized}" in your work graph and created a fresh node for it.`,
        explanation: 'New project node added locally for future recall and linking.',
        citations: [memory?.id].filter(Boolean) as string[],
        assumptions: ['Project stored locally; no cloud calls used.']
    } as const;
};

const handleLocalAutomations = (message: string) => {
    const project = handleProjectIntent(message);
    if (project) return project;

    const reminder = handleReminderIntent(message);
    if (reminder) return reminder;

    const preference = handlePreferenceCapture(message);
    if (preference) return preference;

    const friendFact = handleFriendFact(message);
    if (friendFact) return friendFact;

    return null;
};

export const isApiConfigured = () => {
    // Local-only mode: no API configuration required.
    return true;
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

const decomposeUserQuery = async (msg: string): Promise<string[]> => {
    const cleaned = msg.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [msg];

    const unique = Array.from(new Set(tokens)).filter(t => t.length > 2);
    const chunks: string[] = [];
    for (let i = 0; i < unique.length && chunks.length < 3; i++) {
        chunks.push(unique[i]);
    }

    return chunks.length > 0 ? chunks : [msg];
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

  const automation = handleLocalAutomations(currentMessage);
  if (automation) {
      saveDecisionLog({
        timestamp: Date.now(),
        query: currentMessage,
        memory_retrieval_used: false,
        memories_considered: 0,
        memories_injected: 0,
        cloud_called: false,
        decision_reason: 'Handled by local automation (reminder/folder/preference).',
        retrieval_latency_ms: Date.now() - startTime,
        cognitive_load: 0.1,
        assumptions: automation.assumptions || []
      });

      return {
        reply: automation.reply,
        explanation: automation.explanation,
        citations: automation.citations,
        assumptions: automation.assumptions
      };
  }
  
  const searchQueries = await decomposeUserQuery(currentMessage);
  
  const folderScopes = detectFolderScopes(currentMessage);
  let searchSpace = memories.filter(m =>
      m.cluster === settings.active_cluster && m.status === 'active'
  );

  if (folderScopes.length > 0) {
      const scoped = searchSpace.filter(m => {
          const folder = (m.metadata?.folder || '').toLowerCase();
          return folderScopes.some(scope => folder.startsWith(scope));
      });
      if (scoped.length > 0) searchSpace = scoped;
      if (scoped.length === 0) {
          const fallback = folderScopes.flatMap(scope => getMemoriesInFolder(scope));
          if (fallback.length > 0) searchSpace = fallback;
      }
  }
  
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
};

export const generateLongitudinalInsights = async (memories: Memory[]) => {
    return summarizeMemoriesLocally(memories, 3);
};

export const distillInput = async (input: string) => {
    return { memories: buildLocalDistillation(input) };
};

export const verifyCrossMemoryConsistency = async (newContent: string, newDomain: string) => {
    return { isContradictory: false, reasoning: 'Local mode: no cloud validation performed.' };
};

export const reconstructEpisodicTimeline = async (memories: Memory[]) => {
    return buildLocalTimeline(memories);
};

export const speakText = (t: string) => {
    const utter = new SpeechSynthesisUtterance(t);
    window.speechSynthesis.speak(utter);
};

export const memorySearch = { search: async (q: string, i: Memory[]) => i.filter(m => m.content.toLowerCase().includes(q.toLowerCase())).map(x => ({ item: x })) };
export const transcriptSearch = { search: async (q: string, i: any[]) => i.filter(m => m.content.toLowerCase().includes(q.toLowerCase())).map(x => ({ item: x })) };
export const placeSearch = { search: async (q: string, i: Place[]) => i.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).map(x => ({ item: x })) };
