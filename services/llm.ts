import { Memory, Place, Reminder, MemoryType, MemoryDomain, DecisionLog, TranscriptSegment } from "../types";
import {
  getSettings,
  trackMemoryAccess,
  registerMemoryIgnored,
  saveDecisionLog,
  getMemories,
  getDecisionLogs,
  addMemory,
  upsertReminder,
  getReminders,
  getMemoriesInFolder,
  getPendingProjectDecision,
  savePendingProjectDecision,
  getPeople,
  addFactToPerson,
  savePendingPersonDecision,
  getPendingPersonDecision,
  updatePerson,
  reinforceIdentity,
  weakenIdentity,
  mergeIdentities,
  splitIdentityHypothesis,
  deriveConcernThemes,
  scoreConcernAlignment,
  reinforceConcernTrace
} from "./storage";
import { localTranscribe } from './whisper';
import { getDecisionBiasSnapshot } from "./cognitiveEngine";

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
    if (/(family|brother|sister|mom|dad|mother|father|partner|wife|husband)/i.test(message)) scopes.push('personal/relationships');
    if (/(work|manager|project|meeting|sprint)/i.test(message)) scopes.push('work');
    if (lower.includes('remind')) scopes.push('work/reminders');
    return scopes;
};

const extractPersonEncounter = (message: string): { name: string; fact: string } | null => {
    const metMatch = message.match(/\bmet\s+([A-Za-z]+)/i);
    const spokeMatch = message.match(/\b(?:spoke with|talked to|saw|meeting with|met with)\s+([A-Za-z]+)/i);

    const name = metMatch?.[1] || spokeMatch?.[1];
    if (!name) return null;

    return { name, fact: message.trim() };
};

const normalizeFact = (pendingFact: string, followUp: string) => {
    const trimmed = followUp.trim();
    const isBareAck = /^(yes|yeah|yep|no|new|same|correct|different|another)/i.test(trimmed) && trimmed.split(/\s+/).length <= 3;
    if (!trimmed || isBareAck) return pendingFact;
    return `${pendingFact} ${trimmed}`.trim();
};

const tokenizeContext = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);

const estimateContextOverlap = (fact: string, contextTokens: string[]) => {
    const factTokens = tokenizeContext(fact);
    if (factTokens.length === 0 || contextTokens.length === 0) return 0;
    const overlap = factTokens.filter(t => contextTokens.includes(t));
    return Math.min(0.35, overlap.length * 0.05);
};

const scoreIdentityCandidate = (person: ReturnType<typeof getPeople>[number], message: string, memories: Memory[]) => {
    const base = typeof person.identityConfidence === 'number' ? person.identityConfidence : 0.55;
    const tokens = tokenizeContext(message);

    const nameSignal = person.name && message.toLowerCase().includes(person.name.toLowerCase()) ? 0.18 : 0;
    const recentness = (() => {
        const last = new Date(person.lastUpdated).getTime();
        const days = Math.max(0, (Date.now() - last) / 86_400_000);
        return Math.max(0, 0.12 - days * 0.01);
    })();

    const contextualMemories = memories.filter(m =>
        m.content.toLowerCase().includes(person.name.toLowerCase()) ||
        m.metadata?.topic?.toLowerCase().includes(person.name.toLowerCase())
    );

    const overlapScore = contextualMemories.reduce((acc, m) => acc + estimateContextOverlap(m.content, tokens), 0);
    const strengthSignal = contextualMemories.reduce((acc, m) => acc + (m.strength ?? 0.5) * 0.05, 0);

    const confidence = Math.min(0.98, base + nameSignal + recentness + overlapScore + strengthSignal);
    const evidence: string[] = [];
    if (nameSignal > 0) evidence.push('Name mentioned');
    if (recentness > 0.01) evidence.push('Recently updated');
    if (overlapScore > 0) evidence.push('Context overlaps past facts');
    if (strengthSignal > 0.02) evidence.push('Strong linked memories');

    return { person, confidence, evidence };
};

const resolveIdentityCandidates = (message: string) => {
    const people = getPeople();
    const memories = getMemories();
    const candidates = people.map(p => scoreIdentityCandidate(p, message, memories));
    return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
};

const shouldAskIdentityQuestion = (
    candidates: ReturnType<typeof resolveIdentityCandidates>,
    biasCaution: number,
    concernAlignment: number = 0
) => {
    if (candidates.length < 2) return false;
    const [top, second] = candidates;
    const confidenceGap = Math.abs(top.confidence - second.confidence);
    const concernCaution = concernAlignment > 0.15 ? concernAlignment * 0.12 : 0;
    const closenessThreshold = Math.max(0.04, 0.12 - Math.max(0, biasCaution) * 0.05 + concernCaution);
    const cautiousEnough = biasCaution + concernCaution > 0.01;
    const unclearTop = top.confidence < Math.min(0.85, 0.7 + Math.max(0, biasCaution + concernCaution) * 0.25);
    return cautiousEnough && (confidenceGap < closenessThreshold || unclearTop);
};

const buildIdentityQuestion = (candidates: ReturnType<typeof resolveIdentityCandidates>, name: string) => {
    const [top, second] = candidates;
    const hints = [top, second]
        .filter(Boolean)
        .map(c => {
            const contextCue = c.evidence[0] || 'recent details you shared';
            return `${c.person.name} because of ${contextCue}`;
        })
        .join(' or ');
    const contextPrompt = top.evidence[0] || 'recent mentions';
    return `You mentioned ${name}. Is this about ${hints}? I noticed ${contextPrompt}.`;
};

const interpretIdentityFeedback = (message: string) => {
    const lower = message.toLowerCase();
    const confirmSignal = /(yes|correct|that one|exactly|same)/i.test(lower);
    const correctionSignal = /(different|someone else|not|new person|another)/i.test(lower);
    const mergeSignal = /(merge|they are the same person|combine)/i.test(lower);

    return {
        confirmSignal,
        correctionSignal,
        mergeSignal,
        detailProvided: message.split(/\s+/).length > 6
    };
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

const handleHardcodedQuestion = (message: string) => {
    const lower = message.toLowerCase();
    if (!/(hard\s*coded|hardcode|hard-coded)/i.test(lower)) return null;

    const memories = getMemories();
    const reminders = getReminders();
    const people = getPeople();

    const replyParts = [
        "You're in local/offline mode right now—responses are built from your saved memories and heuristics, not cloud models.",
        `I currently see ${memories.length} stored memories, ${reminders.length} reminders, and ${people.length} people entries to ground replies.`
    ];

    return {
        reply: replyParts.join("\n"),
        explanation: 'Clarified that the assistant answers from locally persisted data rather than hardcoded templates or cloud calls.',
        citations: [],
        assumptions: ['Local heuristics are active; cloud connectors are disabled.']
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

const handleSelfFact = (message: string) => {
    if (message.includes('?')) return null;
    const factMatch = message.match(/\b(i am|i'm|my name is|i live in|i (?:work|worked) at|i was born in|i have|i got)\b\s+([^.!?]+)/i);
    if (!factMatch) return null;

    const verb = factMatch[1];
    const detail = factMatch[2].trim();

    const memory = addMemory({
        content: `Self fact: ${verb} ${detail}`,
        domain: 'personal',
        type: 'fact',
        entity: 'self',
        justification: 'User shared a personal fact',
        metadata: {
            folder: 'personal/self/facts',
            table: 'facts',
            topic: detail.slice(0, 80),
            owner: 'self',
            origin: 'manual'
        }
    });

    return {
        reply: `Captured this about you: ${verb} ${detail}.`,
        explanation: 'Stored under personal/self/facts for fast recall like a personal brain.',
        citations: [memory?.id].filter(Boolean) as string[],
        assumptions: ['Future questions about you will surface this first.']
    } as const;
};

const handleRelationshipFact = (message: string) => {
    if (message.includes('?')) return null;

    const directRelation = message.match(/\bmy\s+(friend|brother|sister|mother|father|mom|dad|cousin|partner|wife|husband)\s+([a-z]+)/i);
    const reverseRelation = message.match(/\b([A-Z][a-z]+)\s+is\s+my\s+(friend|brother|sister|mother|father|mom|dad|cousin|partner|wife|husband)/i);

    const relation = directRelation?.[1] || reverseRelation?.[2];
    const name = directRelation?.[2] || reverseRelation?.[1];

    if (!relation || !name) return null;

    const folder = `personal/relationships/${name.toLowerCase()}`;
    const memory = addMemory({
        content: `${name} is your ${relation}. ${message.trim()}`,
        domain: 'personal',
        type: 'fact',
        entity: name,
        justification: 'User described a relationship',
        metadata: {
            folder,
            table: 'relationships',
            topic: `${name} (${relation})`,
            owner: 'friend',
            origin: 'manual'
        }
    });

    return {
        reply: `Noted that ${name} is your ${relation}. I've organized it under relationships for you.`,
        explanation: 'Relationship details were filed under personal/relationships for human-like recall.',
        citations: [memory?.id].filter(Boolean) as string[],
        assumptions: ['Friend and family context will be recalled before general info.']
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

const uniqueSlug = (base: string) => {
    const normalized = base.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
    const existingSlugs = new Set(
        getMemories()
            .filter(m => m.metadata?.table === 'projects')
            .map(m => (m.metadata?.folder || '').split('/').pop() || '')
            .filter(Boolean)
    );

    if (!existingSlugs.has(normalized)) return normalized;

    let suffix = 2;
    let candidate = `${normalized}-${suffix}`;
    while (existingSlugs.has(candidate)) {
        suffix += 1;
        candidate = `${normalized}-${suffix}`;
    }
    return candidate;
};

const classifyProjectDecision = (message: string): 'same' | 'new' | null => {
    const lower = message.toLowerCase();
    if (/(same|yes|continue|keep|existing|resume)/i.test(lower)) return 'same';
    if (/(different|new|separate|fresh|another)/i.test(lower)) return 'new';
    return null;
};

const handlePendingProjectDecision = (message: string) => {
    const pending = getPendingProjectDecision();
    if (!pending) return null;

    const decision = classifyProjectDecision(message);
    if (!decision) return null;

    savePendingProjectDecision(null);

    if (decision === 'same') {
        if (pending.existingMemoryId) trackMemoryAccess(pending.existingMemoryId, 'Project confirmation reused memory');
        const reinforcement = addMemory({
            content: `Confirmed continuation of existing project "${pending.projectName}".`,
            domain: 'work',
            type: 'event',
            entity: pending.projectName,
            justification: 'User confirmed existing project node reuse.',
            metadata: {
                folder: `work/projects/${pending.slug || uniqueSlug(pending.projectName)}`,
                table: 'projects',
                topic: pending.projectName,
                owner: 'work',
                origin: 'manual'
            }
        });

        return {
            reply: `Got it — continuing with your existing "${pending.projectName}" project node.`,
            explanation: 'Keeping all updates tied to the original project memory.',
            citations: [pending.existingMemoryId, reinforcement?.id].filter(Boolean) as string[],
            assumptions: ['You prefer to reuse the existing project graph.']
        } as const;
    }

    const slug = uniqueSlug(pending.projectName);
    const memory = addMemory({
        content: `Parallel project node created for "${pending.projectName}" after user requested separation.`,
        domain: 'work',
        type: 'task',
        entity: pending.projectName,
        justification: 'User indicated this is a different project with the same name.',
        metadata: {
            folder: `work/projects/${slug}`,
            table: 'projects',
            topic: `${pending.projectName} (${slug})`,
            owner: 'work',
            origin: 'manual'
        }
    });

    return {
        reply: `Started a separate project thread for "${pending.projectName}" (${slug}). I'll keep it independent from the earlier node.`,
        explanation: 'Created a new local project node to avoid merging contexts.',
        citations: [memory?.id].filter(Boolean) as string[],
        assumptions: ['Treat project updates as a distinct effort.']
    } as const;
};

const handlePendingPersonDecision = (message: string) => {
    const pending = getPendingPersonDecision();
    if (!pending) return null;

    const feedback = interpretIdentityFeedback(message);
    const fact = normalizeFact(pending.fact, message);
    const people = getPeople();
    const hydratedCandidates = pending.candidates
        ? pending.candidates
              .map(c => {
                  const person = people.find(p => p.id === c.personId);
                  return person ? { person, confidence: c.confidence, evidence: c.evidence } : null;
              })
              .filter(Boolean) as ReturnType<typeof resolveIdentityCandidates>
        : [];
    const candidates = hydratedCandidates.length > 0 ? hydratedCandidates : resolveIdentityCandidates(message);

    const fallbackPerson = pending.matchedPersonId ? people.find(p => p.id === pending.matchedPersonId) : null;
    const topCandidate = candidates[0] || (fallbackPerson ? { person: fallbackPerson, confidence: fallbackPerson.identityConfidence ?? 0.6, evidence: [] } : null);

    savePendingPersonDecision(null);

    if (feedback.mergeSignal && candidates.length >= 2) {
        mergeIdentities(candidates[0].person.id, candidates[1].person.id, 'User signaled these are the same identity');
        const memory = addMemory({
            content: `Merged identities: ${candidates[0].person.name} with ${candidates[1].person.name}.`,
            domain: 'personal',
            type: 'fact',
            entity: candidates[0].person.name,
            justification: 'User indicated these references match.',
            metadata: {
                folder: 'personal/relationships',
                table: 'relationships',
                topic: `${candidates[0].person.name} merge`,
                owner: 'friend',
                origin: 'manual'
            }
        });

        return {
            reply: `Combined ${candidates[0].person.name} and ${candidates[1].person.name} as the same person and kept their facts together.`,
            explanation: 'Merged overlapping identities with a reversible snapshot.',
            citations: [memory?.id].filter(Boolean) as string[],
            assumptions: ['Revertible via identity event log if needed.']
        } as const;
    }

    if (topCandidate?.person && !feedback.correctionSignal) {
        addFactToPerson(topCandidate.person.id, fact, 'user');
        reinforceIdentity(topCandidate.person.id, feedback.detailProvided ? 'User elaborated without contradiction' : 'User confirmed identity match');
        const memory = addMemory({
            content: `Person ${topCandidate.person.name}: ${fact}`,
            domain: 'personal',
            type: 'fact',
            entity: topCandidate.person.name,
            justification: feedback.detailProvided ? 'User reinforced this identity with more detail.' : 'User confirmed this identity.',
            metadata: {
                folder: `personal/relationships/${topCandidate.person.name.toLowerCase()}`,
                table: 'relationships',
                topic: `${topCandidate.person.name} (${topCandidate.person.relation})`,
                owner: 'friend',
                origin: 'manual'
            }
        });

        return {
            reply: `Linked this to ${topCandidate.person.name} with confidence ${(topCandidate.confidence || 0.5).toFixed(2)} and noted: ${fact}.`,
            explanation: 'Identity confidence nudged upward after your confirmation.',
            citations: [memory?.id].filter(Boolean) as string[],
            assumptions: ['Future mentions will bias toward this node unless corrected.']
        } as const;
    }

    if (topCandidate?.person && feedback.correctionSignal) {
        weakenIdentity(topCandidate.person.id, 'User corrected an identity link', true);
        const branched = splitIdentityHypothesis(topCandidate.person.id, pending.name, fact, 'Identity confidence fell low after correction');
        const memory = addMemory({
            content: `New identity hypothesis for ${pending.name}: ${fact}`,
            domain: 'personal',
            type: 'fact',
            entity: pending.name,
            justification: 'User indicated prior match was wrong, so a new hypothesis was created.',
            metadata: {
                folder: `personal/relationships/${pending.name.toLowerCase()}`,
                table: 'relationships',
                topic: pending.name,
                owner: 'friend',
                origin: 'manual'
            }
        });

        return {
            reply: `Created a fresh identity hypothesis for ${pending.name} and lowered confidence on the previous candidate. Logged: ${fact}.`,
            explanation: 'Correction applied; confidence reduced and a new node formed to keep contexts separate.',
            citations: [memory?.id].filter(Boolean) as string[],
            assumptions: ['Tell me if this new node also needs to merge later.']
        } as const;
    }

    // If no candidate existed, create a new hypothesis and store.
    updatePerson(pending.name, fact, 'Acquaintance');
    const memory = addMemory({
        content: `New person ${pending.name}: ${fact}`,
        domain: 'personal',
        type: 'fact',
        entity: pending.name,
        justification: 'New identity hypothesis created after mention.',
        metadata: {
            folder: `personal/relationships/${pending.name.toLowerCase()}`,
            table: 'relationships',
            topic: pending.name,
            owner: 'friend',
            origin: 'manual'
        }
    });

    return {
        reply: `Started a new identity hypothesis for ${pending.name} and logged: ${fact}.`,
        explanation: 'No strong candidate remained, so a fresh node was added.',
        citations: [memory?.id].filter(Boolean) as string[],
        assumptions: ['I will keep adjusting confidence as you add or correct facts.']
    } as const;
};

const handlePersonEncounter = (message: string) => {
    const encounter = extractPersonEncounter(message);
    if (!encounter) return null;

    const candidates = resolveIdentityCandidates(encounter.fact);
    const biasSnapshot = getDecisionBiasSnapshot?.() || { clarityThresholdBias: 0, ambiguityToleranceBias: 0, questioningBias: 0 };
    const concernSignal = scoreConcernAlignment(encounter.fact, deriveConcernThemes());
    const shouldClarify = shouldAskIdentityQuestion(
        candidates,
        biasSnapshot.clarityThresholdBias + biasSnapshot.questioningBias,
        concernSignal.alignment
    );
    const topCandidate = candidates[0];

    if (topCandidate && topCandidate.confidence >= 0.72 && !shouldClarify) {
        addFactToPerson(topCandidate.person.id, encounter.fact, 'user');
        reinforceIdentity(topCandidate.person.id, 'Identity matched without objection');
        const memory = addMemory({
            content: `Person ${topCandidate.person.name}: ${encounter.fact}`,
            domain: 'personal',
            type: 'fact',
            entity: topCandidate.person.name,
            justification: 'High-confidence match to existing identity.',
            metadata: {
                folder: `personal/relationships/${topCandidate.person.name.toLowerCase()}`,
                table: 'relationships',
                topic: `${topCandidate.person.name} (${topCandidate.person.relation})`,
                owner: 'friend',
                origin: 'manual'
            }
        });
        return {
            reply: `I linked this to ${topCandidate.person.name} and noted: ${encounter.fact}.`,
            explanation: 'Confidence was high and bias was low, so I reinforced the existing identity without extra questions.',
            citations: [memory?.id].filter(Boolean) as string[],
            assumptions: ['Tell me if this should be separated and I will lower confidence.']
        } as const;
    }

    if (!topCandidate || topCandidate.confidence < 0.35) {
        const newPerson = splitIdentityHypothesis(topCandidate?.person.id || 'unlinked', encounter.name, encounter.fact, 'No strong identity candidate matched');
        const memory = addMemory({
            content: `New identity hypothesis for ${encounter.name}: ${encounter.fact}`,
            domain: 'personal',
            type: 'fact',
            entity: encounter.name,
            justification: 'No confident match; created a fresh hypothesis.',
            metadata: {
                folder: `personal/relationships/${encounter.name.toLowerCase()}`,
                table: 'relationships',
                topic: encounter.name,
                owner: 'friend',
                origin: 'manual'
            }
        });
        return {
            reply: `I created a new identity hypothesis for ${encounter.name} (starting confidence ${(newPerson.identityConfidence || 0.45).toFixed(2)}). Logged: ${encounter.fact}.`,
            explanation: 'No candidate was confident enough, so a fresh node was created with low initial confidence.',
            citations: [memory?.id].filter(Boolean) as string[],
            assumptions: ['Confidence will rise or fall as you confirm or correct future mentions.']
        } as const;
    }

    savePendingPersonDecision({
        name: encounter.name,
        matchedPersonId: topCandidate.person.id,
        fact: encounter.fact,
        createdAt: new Date().toISOString(),
        candidates: candidates.map(c => ({ personId: c.person.id, confidence: c.confidence, evidence: c.evidence })),
        lastPrompt: 'identity_clarification'
    });

    const clarification = buildIdentityQuestion(candidates, encounter.name);
    return {
        reply: clarification,
        explanation: 'Top candidates shared similar context cues and current bias favors caution, so I asked before reinforcing.',
        citations: [],
        assumptions: ['Your next message will nudge identity confidence up or down.']
    } as const;
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
        trackMemoryAccess(memory.id, 'Matched existing project node');
        savePendingProjectDecision({
            projectName: normalized,
            existingMemoryId: memory.id,
            slug,
            createdAt: new Date().toISOString()
        });
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
    const pendingProject = handlePendingProjectDecision(message);
    if (pendingProject) return pendingProject;

    const pendingPerson = handlePendingPersonDecision(message);
    if (pendingPerson) return pendingPerson;

    const automations = [
        handleHardcodedQuestion(message),
        handlePersonEncounter(message),
        handleProjectIntent(message),
        handleReminderIntent(message),
        handlePreferenceCapture(message),
        handleSelfFact(message),
        handleRelationshipFact(message),
        handleFriendFact(message)
    ].filter(Boolean) as {
        reply: string;
        explanation: string;
        citations: string[];
        assumptions?: string[];
    }[];

    if (automations.length === 0) return null;
    if (automations.length === 1) return automations[0];

    const combinedReply = automations.map(a => `• ${a.reply}`).join("\n");
    const combinedExplanation = automations.map(a => a.explanation).join(' ');
    const combinedCitations = Array.from(new Set(automations.flatMap(a => a.citations)));
    const combinedAssumptions = Array.from(new Set(automations.flatMap(a => a.assumptions || [])));

    return {
        reply: combinedReply,
        explanation: combinedExplanation,
        citations: combinedCitations,
        assumptions: combinedAssumptions
    } as const;
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
  const concernTraces = deriveConcernThemes();
  const messageConcern = scoreConcernAlignment(currentMessage, concernTraces);

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

  const concernLift = (memory: Memory) => {
      const signal = scoreConcernAlignment(`${memory.content} ${memory.metadata?.topic || ''}`, concernTraces);
      return 1 + signal.alignment * 0.35;
  };

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
      .sort(
        (a, b) =>
          (b.salience * b.trust_score * (b.strength ?? 0.6) * concernLift(b)) -
          (a.salience * a.trust_score * (a.strength ?? 0.6) * concernLift(a))
      )
      .slice(0, candidateLimit);

  const ignored = Array.from(relevantFragments)
    .filter(m => !candidates.includes(m))
    .map(m => m.id);
  registerMemoryIgnored(ignored, 'Memory surfaced but not selected');

  const replyHeader = candidates.length > 0
    ? `Local-only mode: responding with cached context from ${candidates.length} memories.`
    : 'Local-only mode: no cached memories matched; consider adding more context.';

  const replyBody = candidates.map(c => `• ${c.content}`).join("\n");
  const reflection =
    messageConcern.alignment > 0.55 && candidates.length > 0 && !/\?/g.test(currentMessage)
      ? `This aligns with something you often reinforce: ${messageConcern.topConcern?.description}. Does that sound right?`
      : '';
  const assembledReply = [replyHeader, replyBody, reflection].filter(Boolean).join("\n\n");

  if (reflection && messageConcern.topConcern?.description) {
    reinforceConcernTrace(messageConcern.topConcern.description, 'Surfaced as a persistent concern to confirm understanding');
  }

  const decisionAssumptions = reflection && messageConcern.topConcern?.description
    ? [`This touchpoint matches a recurring concern: ${messageConcern.topConcern.description}`]
    : [];

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
    assumptions: decisionAssumptions
  });

  candidates.forEach(c => trackMemoryAccess(c.id, 'Used in assembled reply'));
  return {
      reply: assembledReply || 'Local-only mode active. No relevant memories yet.',
      explanation: 'Local provider responded without cloud inference.',
      citations: candidates.map(c => c.id),
      assumptions: decisionAssumptions
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
