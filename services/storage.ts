import {
  Memory,
  Person,
  Reminder,
  Place,
  MemoryType,
  MemoryDomain,
  ChatMessage,
  MemoryStatus,
  ChatSession,
  LLMSettings,
  UserProfile,
  QueueItem,
  TranscriptionLog,
  SmartDevice,
  Room,
  ConnectionProtocol,
  RecallPriority,
  DecisionLog,
  PersonFact,
  TranscriptSegment,
  PendingProjectDecision,
  PendingPersonDecision
} from '../types';
import { Client } from 'pg';

export interface StorageAdapter {
  initializeStorage: () => Promise<void>;
  getSettings: () => LLMSettings;
  saveSettings: (settings: LLMSettings) => Promise<void>;
  getMemories: () => Memory[];
  getPendingProjectDecision: () => PendingProjectDecision | null;
  savePendingProjectDecision: (pending: PendingProjectDecision | null) => void;
  getPendingPersonDecision: () => PendingPersonDecision | null;
  savePendingPersonDecision: (pending: PendingPersonDecision | null) => void;
  addMemory: (params: any) => Memory | null;
  approveMemory: (id: string) => void;
  updateMemory: (id: string, updates: Partial<Memory>) => void;
  deleteMemory: (id: string) => void;
  getMemoriesInFolder: (folderPrefix: string) => Memory[];
  trackMemoryAccess: (id: string, reason?: string) => void;
  registerMemoryIgnored: (ids: string[], reason?: string) => void;
  getPeople: () => Person[];
  reinforceIdentity: (personId: string, reason: string) => number | null;
  weakenIdentity: (personId: string, reason: string, sharp?: boolean) => number | null;
  mergeIdentities: (
    targetId: string,
    sourceId: string,
    reason: string
  ) => { mergedInto: Person; snapshot: { target?: Person; source?: Person } } | null;
  splitIdentityHypothesis: (sourceId: string, newName: string, factStr: string, reason: string) => Person;
  updatePerson: (name: string, factStr: string, relation?: string) => void;
  updatePersonConsent: (id: string, consent: boolean) => void;
  addFactToPerson: (personId: string, content: string, source?: 'user' | 'inferred' | 'system') => void;
  removeFactFromPerson: (personId: string, factId: string) => void;
  getReminders: () => Reminder[];
  upsertReminder: (task: string, dueTime: string, completed?: boolean) => Reminder;
  completeReminder: (id: string, completed?: boolean) => void;
  rescheduleReminder: (id: string, dueTime: string) => void;
  getSessions: () => ChatSession[];
  createSession: (mode?: 'active' | 'observer') => ChatSession;
  updateSession: (id: string, messages: ChatMessage[]) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  getUserProfile: () => UserProfile;
  saveUserProfile: (profile: UserProfile) => Promise<void>;
  getQueue: () => QueueItem[];
  addToQueue: (content: string, type?: any) => Promise<void>;
  removeFromQueue: (id: string) => Promise<void>;
  updateQueueItem: (id: string, updates: any) => Promise<void>;
  getDecisionLogs: () => DecisionLog[];
  saveDecisionLog: (log: DecisionLog) => Promise<void>;
  getStorageUsage: () => { usedKB: number; limitKB: number; percent: number };
  runSystemBootCheck: () => string[];
  runColdStorageMaintenance: () => void;
  triggerSync: () => Promise<void>;
  exportData: () => void;
  importData: (file: File) => Promise<boolean>;
  factoryReset: () => void;
  getTranscriptionLogs: () => TranscriptionLog[];
  addTranscriptionLog: (
    content: string,
    source: 'upload' | 'live',
    segments?: TranscriptSegment[],
    options?: { meetingId?: string; participants?: string[]; meetingDate?: string; sourceType?: 'audio' | 'document' }
  ) => void;
  deleteTranscriptionLog: (id: string) => Promise<void>;
  getPlaces: () => Place[];
  addPlace: (place: Partial<Place>) => void;
  updatePlaceStatus: (id: string, status: Place['status']) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;
  getRooms: () => Room[];
  addRoom: (name: string, type: string) => Promise<void>;
  getSmartDevices: () => SmartDevice[];
  addSmartDevice: (device: Partial<SmartDevice>) => Promise<void>;
  updateSmartDevice: (id: string, updates: Partial<SmartDevice>) => Promise<void>;
  deleteSmartDevice: (id: string) => Promise<void>;
  purgeOldDecisionLogs: () => void;
}

export interface StorageAdapter {
  initializeStorage: () => Promise<void>;
  getSettings: () => LLMSettings;
  saveSettings: (settings: LLMSettings) => Promise<void>;
  getMemories: () => Memory[];
  getPendingProjectDecision: () => PendingProjectDecision | null;
  savePendingProjectDecision: (pending: PendingProjectDecision | null) => void;
  getPendingPersonDecision: () => PendingPersonDecision | null;
  savePendingPersonDecision: (pending: PendingPersonDecision | null) => void;
  addMemory: (params: any) => Memory | null;
  approveMemory: (id: string) => void;
  updateMemory: (id: string, updates: Partial<Memory>) => void;
  deleteMemory: (id: string) => void;
  getMemoriesInFolder: (folderPrefix: string) => Memory[];
  trackMemoryAccess: (id: string, reason?: string) => void;
  registerMemoryIgnored: (ids: string[], reason?: string) => void;
  getPeople: () => Person[];
  reinforceIdentity: (personId: string, reason: string) => number | null;
  weakenIdentity: (personId: string, reason: string, sharp?: boolean) => number | null;
  mergeIdentities: (
    targetId: string,
    sourceId: string,
    reason: string
  ) => { mergedInto: Person; snapshot: { target?: Person; source?: Person } } | null;
  splitIdentityHypothesis: (sourceId: string, newName: string, factStr: string, reason: string) => Person;
  updatePerson: (name: string, factStr: string, relation?: string) => void;
  updatePersonConsent: (id: string, consent: boolean) => void;
  addFactToPerson: (personId: string, content: string, source?: 'user' | 'inferred' | 'system') => void;
  removeFactFromPerson: (personId: string, factId: string) => void;
  getReminders: () => Reminder[];
  upsertReminder: (task: string, dueTime: string, completed?: boolean) => Reminder;
  completeReminder: (id: string, completed?: boolean) => void;
  rescheduleReminder: (id: string, dueTime: string) => void;
  getSessions: () => ChatSession[];
  createSession: (mode?: 'active' | 'observer') => ChatSession;
  updateSession: (id: string, messages: ChatMessage[]) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  getUserProfile: () => UserProfile;
  saveUserProfile: (profile: UserProfile) => Promise<void>;
  getQueue: () => QueueItem[];
  addToQueue: (content: string, type?: any) => Promise<void>;
  removeFromQueue: (id: string) => Promise<void>;
  updateQueueItem: (id: string, updates: any) => Promise<void>;
  getDecisionLogs: () => DecisionLog[];
  saveDecisionLog: (log: DecisionLog) => Promise<void>;
  getStorageUsage: () => { usedKB: number; limitKB: number; percent: number };
  runSystemBootCheck: () => string[];
  runColdStorageMaintenance: () => void;
  triggerSync: () => Promise<void>;
  exportData: () => void;
  importData: (file: File) => Promise<boolean>;
  factoryReset: () => void;
  getTranscriptionLogs: () => TranscriptionLog[];
  addTranscriptionLog: (
    content: string,
    source: 'upload' | 'live',
    segments?: TranscriptSegment[],
    options?: { meetingId?: string; participants?: string[]; meetingDate?: string; sourceType?: 'audio' | 'document' }
  ) => void;
  deleteTranscriptionLog: (id: string) => Promise<void>;
  getPlaces: () => Place[];
  addPlace: (place: Partial<Place>) => void;
  updatePlaceStatus: (id: string, status: Place['status']) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;
  getRooms: () => Room[];
  addRoom: (name: string, type: string) => Promise<void>;
  getSmartDevices: () => SmartDevice[];
  addSmartDevice: (device: Partial<SmartDevice>) => Promise<void>;
  updateSmartDevice: (id: string, updates: Partial<SmartDevice>) => Promise<void>;
  deleteSmartDevice: (id: string) => Promise<void>;
  purgeOldDecisionLogs: () => void;
}

const STORAGE_KEYS = {
  MEMORIES: 'cliper_memories',
  PEOPLE: 'cliper_people',
  REMINDERS: 'cliper_reminders',
  SESSIONS: 'cliper_chat_sessions',
  PLACES: 'cliper_places',
  SETTINGS: 'cliper_llm_settings',
  USER_PROFILE: 'cliper_user_profile',
  QUEUE: 'cliper_processing_queue',
  TRANSCRIPTION_LOGS: 'cliper_transcription_logs',
  SMART_DEVICES: 'cliper_smart_devices',
  ROOMS: 'cliper_smart_rooms',
  DECISION_LOGS: 'cliper_decision_logs',
  PENDING_PROJECT: 'cliper_pending_project_decision',
  PENDING_PERSON: 'cliper_pending_person_decision',
  MEMORY_EVENTS: 'cliper_memory_events',
  IDENTITY_EVENTS: 'cliper_identity_events'
};

type MemoryAdjustmentEvent = {
  timestamp: number;
  memoryId: string;
  delta: number;
  strengthAfter: number;
  reason: string;
};

type IdentityAdjustmentEvent = {
  timestamp: number;
  personId: string;
  delta: number;
  confidenceAfter: number;
  reason: string;
  snapshot?: { target?: Person; source?: Person };
  mergeIds?: { targetId: string; sourceId: string };
};

type KeyValueBackend = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  ready?: Promise<void>;
};

class PostgresKeyValueStore implements KeyValueBackend {
  private client: Client;
  private cache = new Map<string, string>();
  public ready: Promise<void>;

  constructor(connectionString: string) {
    this.client = new Client({ connectionString });
    this.ready = this.initialize();
  }

  private async initialize() {
    await this.client.connect();
    await this.client.query(
      `CREATE TABLE IF NOT EXISTS cliper_kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    );
    const rows = await this.client.query('SELECT key, value FROM cliper_kv_store');
    rows.rows.forEach((row: { key: string; value: any }) => {
      const serialized = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
      this.cache.set(row.key, serialized);
    });
  }

  getItem(key: string) {
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.cache.set(key, value);
    void this.ready?.then(() =>
      this.client.query(
        'INSERT INTO cliper_kv_store(key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()',
        [key, value]
      )
    );
  }

  removeItem(key: string) {
    this.cache.delete(key);
    void this.ready?.then(() => this.client.query('DELETE FROM cliper_kv_store WHERE key = $1', [key]));
  }
}

const resolveBackend = (): KeyValueBackend => {
  const backend = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STORAGE_BACKEND) ||
    (typeof process !== 'undefined' ? (process.env?.VITE_STORAGE_BACKEND as string) : undefined) ||
    'session';

  if (backend === 'postgres') {
    const connectionString =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_POSTGRES_URL) ||
      (typeof process !== 'undefined' ? process.env?.VITE_POSTGRES_URL : undefined);

    if (!connectionString) {
      console.warn('[Cliper] VITE_POSTGRES_URL not set; falling back to session storage.');
      return window.sessionStorage;
    }

    return new PostgresKeyValueStore(connectionString);
  }

  return window.sessionStorage;
};

const storage: KeyValueBackend = resolveBackend();

const clampStrength = (value: number) => Math.min(1.25, Math.max(0.05, value));
const clampIdentityConfidence = (value: number) => Math.min(0.98, Math.max(0.05, value));

const getMemoryEvents = (): MemoryAdjustmentEvent[] => load<MemoryAdjustmentEvent[]>(STORAGE_KEYS.MEMORY_EVENTS, []);
const getIdentityEvents = (): IdentityAdjustmentEvent[] => load<IdentityAdjustmentEvent[]>(STORAGE_KEYS.IDENTITY_EVENTS, []);

const recordMemoryEvent = (event: MemoryAdjustmentEvent) => {
  const events = [event, ...getMemoryEvents()].slice(0, 200);
  save(STORAGE_KEYS.MEMORY_EVENTS, events);
  console.info(
    `[Cliper] Memory ${event.memoryId} strength adjusted by ${event.delta.toFixed(3)} to ${event.strengthAfter.toFixed(
      3
    )} (${event.reason}).`
  );
};

const recordIdentityEvent = (event: IdentityAdjustmentEvent) => {
  const events = [event, ...getIdentityEvents()].slice(0, 200);
  save(STORAGE_KEYS.IDENTITY_EVENTS, events);
  console.info(
    `[Cliper] Identity ${event.personId} confidence adjusted by ${event.delta.toFixed(3)} to ${event.confidenceAfter.toFixed(
      3
    )} (${event.reason}).`
  );
};

const applyIdentityConfidenceDecay = (people: Person[], now = Date.now()) => {
  let changed = false;

  people.forEach((person, idx) => {
    const prior = deriveIdentityConfidence(person);
    const lastTouch = new Date(person.lastUpdated || now).getTime();
    const days = Math.max(0, (now - lastTouch) / 86_400_000);

    const ambientDecay = days * 0.002; // gentle drift downward
    const prolongedDecay = days > 30 ? (days - 30) * 0.004 : 0; // speed up only after long inactivity
    const totalDecay = ambientDecay + prolongedDecay;
    if (totalDecay < 0.0005) return;

    const next = clampIdentityConfidence(prior - totalDecay);
    if (Math.abs(next - prior) < 0.0005) return;

    people[idx] = { ...person, identityConfidence: next };
    changed = true;
    recordIdentityEvent({
      timestamp: now,
      personId: person.id,
      delta: next - prior,
      confidenceAfter: next,
      reason: prolongedDecay > 0 ? 'Identity confidence decayed after long inactivity' : 'Identity confidence gently decayed'
    });
  });

  if (changed) save(STORAGE_KEYS.PEOPLE, people);
  return people;
};

const deriveBaseStrength = (memory: Memory) => {
  if (typeof memory.strength === 'number') return memory.strength;
  const salienceSeed = typeof memory.salience === 'number' ? memory.salience : 0.5;
  return clampStrength(0.5 + salienceSeed * 0.3);
};

const deriveIdentityConfidence = (person: Person) => {
  if (typeof person.identityConfidence === 'number') return clampIdentityConfidence(person.identityConfidence);
  const factSignal = Math.min(0.2, (person.facts?.length || 0) * 0.02);
  return clampIdentityConfidence(0.55 + factSignal);
};

const applyStrengthDelta = (memory: Memory, delta: number, reason: string, now = Date.now()) => {
  const prior = deriveBaseStrength(memory);
  const updated = clampStrength(prior + delta);
  if (Math.abs(updated - prior) < 0.0005) {
    memory.strength = prior;
    return prior;
  }
  memory.strength = updated;
  recordMemoryEvent({ timestamp: now, memoryId: memory.id, delta: updated - prior, strengthAfter: updated, reason });
  return updated;
};

const applyDecayToMemories = (memories: Memory[], now = Date.now()) => {
  let changed = false;

  memories.forEach((memory, idx) => {
    const baseStrength = deriveBaseStrength(memory);
    const lastTouch = new Date(memory.lastAccessedAt || memory.updatedAt || memory.createdAt || now).getTime();
    const daysSinceAccess = Math.max(0, (now - lastTouch) / 86_400_000);

    // Slow decay that accelerates with prolonged inactivity but never drops abruptly.
    const gentleDecay = daysSinceAccess * 0.002; // ~0.02 over 10 days
    const prolongedBoost = daysSinceAccess > 14 ? (daysSinceAccess - 14) * 0.003 : 0; // faster after two weeks idle
    const totalDecay = gentleDecay + prolongedBoost;

    const shouldDecay = totalDecay >= 0.001;
    const nextStrength = shouldDecay ? clampStrength(baseStrength - totalDecay) : baseStrength;
    if (nextStrength !== baseStrength || memory.strength !== baseStrength) {
      memories[idx] = { ...memory, strength: nextStrength };
      changed = true;
      if (shouldDecay && nextStrength !== baseStrength) {
        recordMemoryEvent({
          timestamp: now,
          memoryId: memory.id,
          delta: nextStrength - baseStrength,
          strengthAfter: nextStrength,
          reason: daysSinceAccess > 14 ? 'Prolonged inactivity decay' : 'Ambient time decay'
        });
      }
    }
  });

  if (changed) save(STORAGE_KEYS.MEMORIES, memories);
  return memories;
};

const save = async (key: string, data: any) => {
    try {
        const str = JSON.stringify(data);
        storage.setItem(key, str);
    } catch (e) {
        console.error(`[Cliper] Storage write failure for ${key}`, e);
    }
};

const load = <T,>(key: string, fallback: T): T => {
    const stored = storage.getItem(key);
    if (!stored) return fallback;
    try {
        return JSON.parse(stored);
    } catch {
        return fallback;
    }
};

export const initializeStorage = async () => {
  if (storage.ready) {
    await storage.ready;
    console.log('[Cliper] Postgres storage initialized.');
    return;
  }

  console.log('[Cliper] Volatile memory initialized.');
};

export const getSettings = (): LLMSettings => {
  return load<LLMSettings>(STORAGE_KEYS.SETTINGS, {
    provider: 'local',
    executionMode: 'auto',
    ollamaUrl: '',
    ollamaModel: '',
    mcpEnabled: false,
    mcpEndpoint: '',
    enableSimulation: false,
    orinMode: true,
    travelMode: false,
    cloud_disabled: true,
    decision_log_ttl_days: 1,
    max_writes_per_minute: 60,
    recall_sensitivity: 0.8,
    privacy_epsilon: 0.01, 
    auto_approve_facts: true,
    sync_enabled: false,
    active_cluster: 'main',
    deep_recall_enabled: false,
    pii_filter_enabled: true,
    encryption_at_rest: false
  });
};

export const saveSettings = (settings: LLMSettings) => save(STORAGE_KEYS.SETTINGS, settings);
export const getMemories = (): Memory[] => {
  const hydrated = load<Memory[]>(STORAGE_KEYS.MEMORIES, []).map(m => ({ ...m, strength: deriveBaseStrength(m) }));
  return applyDecayToMemories(hydrated);
};

export const getPendingProjectDecision = (): PendingProjectDecision | null => {
  const stored = storage.getItem(STORAGE_KEYS.PENDING_PROJECT);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.warn('[Cliper] Failed to parse pending project decision', e);
    return null;
  }
};

export const savePendingProjectDecision = (pending: PendingProjectDecision | null) => {
  if (!pending) {
    storage.removeItem(STORAGE_KEYS.PENDING_PROJECT);
    return;
  }
  try {
    storage.setItem(STORAGE_KEYS.PENDING_PROJECT, JSON.stringify(pending));
  } catch (e) {
    console.error('[Cliper] Failed to persist pending project decision', e);
  }
};

export const getPendingPersonDecision = (): PendingPersonDecision | null => {
  const stored = storage.getItem(STORAGE_KEYS.PENDING_PERSON);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.warn('[Cliper] Failed to parse pending person decision', e);
    return null;
  }
};

export const savePendingPersonDecision = (pending: PendingPersonDecision | null) => {
  if (!pending) {
    storage.removeItem(STORAGE_KEYS.PENDING_PERSON);
    return;
  }
  try {
    storage.setItem(STORAGE_KEYS.PENDING_PERSON, JSON.stringify(pending));
  } catch (e) {
    console.error('[Cliper] Failed to persist pending person decision', e);
  }
};

export const addMemory = (params: any): Memory | null => {
  const settings = getSettings();
  const memories = getMemories();
  
  const newMemory: Memory = {
    id: crypto.randomUUID(),
    content: params.content,
    domain: params.domain || 'general',
    type: params.type || 'raw',
    entity: params.entity || 'unspecified',
    speaker: params.speaker || 'unknown',
    confidence: params.confidence ?? 0.9,
    salience: params.salience ?? 0.8,
    trust_score: params.trust_score ?? 1.0,
    confidence_history: [params.confidence ?? 0.9],
    status: 'active',
    recall_priority: params.recall_priority || 'normal',
    supersedes: null,
    source_hash: 'volatile',
    vocab_version: "v1.0",
    distilled_by: params.distilled_by || "cliper-core",
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    strength: clampStrength(params.strength ?? (0.6 + (params.salience ?? 0.8) * 0.15)),
    accessCount: 1,
    isLocked: false,
    isPendingApproval: params.isPendingApproval || false,
    isPinned: params.isPinned || false,
    justification: params.justification || "Session Insight",
    cluster: settings.active_cluster,
    metadata: params.metadata || undefined
  };

  save(STORAGE_KEYS.MEMORIES, [newMemory, ...memories]);
  return newMemory;
};

export const approveMemory = (id: string) => {
  const memories = getMemories();
  const idx = memories.findIndex(m => m.id === id);
  if (idx !== -1) {
    memories[idx].isPendingApproval = false;
    save(STORAGE_KEYS.MEMORIES, memories);
  }
};

export const updateMemory = (id: string, updates: Partial<Memory>) => {
  const memories = getMemories();
  const idx = memories.findIndex(m => m.id === id);
  if (idx !== -1) {
    const now = Date.now();
    const prior = memories[idx];
    memories[idx] = { ...prior, ...updates, updatedAt: new Date(now).toISOString() };

    const justificationSignals = [updates.justification, updates.metadata?.validation_reason].filter(Boolean).join(' ');
    const appearsCorrected = /correction|contradict|fix|revise|update/i.test(justificationSignals);
    const confidenceMoved =
      typeof updates.confidence === 'number' && typeof prior.confidence === 'number'
        ? updates.confidence - prior.confidence
        : 0;

    if (appearsCorrected || confidenceMoved < -0.05) {
      applyStrengthDelta(memories[idx], -0.04, 'Memory corrected or contradicted', now);
    } else if (confidenceMoved > 0.05) {
      applyStrengthDelta(memories[idx], 0.02, 'Memory reinforced by confirmation', now);
    }
    save(STORAGE_KEYS.MEMORIES, memories);
  }
};

export const deleteMemory = (id: string) => {
  const memories = getMemories();
  save(STORAGE_KEYS.MEMORIES, memories.filter(m => m.id !== id));
};

export const getMemoriesInFolder = (folderPrefix: string): Memory[] => {
  const normalized = folderPrefix.toLowerCase();
  return getMemories().filter(m => (m.metadata?.folder || '').toLowerCase().startsWith(normalized));
};

export const trackMemoryAccess = (id: string, reason: string = 'Retrieved for reasoning') => {
  const memories = getMemories();
  const idx = memories.findIndex(m => m.id === id);
  if (idx !== -1) {
    const nowIso = new Date().toISOString();
    memories[idx].accessCount++;
    memories[idx].lastAccessedAt = nowIso;
    applyStrengthDelta(memories[idx], 0.05, `${reason} (access count ${memories[idx].accessCount})`, Date.parse(nowIso));
    save(STORAGE_KEYS.MEMORIES, memories);
  }
};

export const registerMemoryIgnored = (ids: string[], reason: string = 'Surface ignored in retrieval') => {
  if (ids.length === 0) return;
  const memories = getMemories();
  let changed = false;

  ids.forEach(id => {
    const idx = memories.findIndex(m => m.id === id);
    if (idx !== -1) {
      applyStrengthDelta(memories[idx], -0.01, `${reason} (access count ${memories[idx].accessCount})`);
      changed = true;
    }
  });

  if (changed) save(STORAGE_KEYS.MEMORIES, memories);
};

// Backwards compatibility shim: rely on the hydrated identity-aware getter
export const getPeople = (): Person[] => {
  const hydrated = load<Person[]>(STORAGE_KEYS.PEOPLE, []).map(p => ({ ...p, identityConfidence: deriveIdentityConfidence(p) }));
  return applyIdentityConfidenceDecay(hydrated);
};
const adjustIdentityConfidence = (
  people: Person[],
  personId: string,
  delta: number,
  reason: string,
  snapshot?: { target?: Person; source?: Person }
) => {
  const idx = people.findIndex(p => p.id === personId);
  if (idx === -1) return null;
  const prior = deriveIdentityConfidence(people[idx]);
  const next = clampIdentityConfidence(prior + delta);
  if (Math.abs(next - prior) < 0.0005) {
    people[idx].identityConfidence = prior;
    return prior;
  }
  people[idx].identityConfidence = next;
  recordIdentityEvent({
    timestamp: Date.now(),
    personId,
    delta: next - prior,
    confidenceAfter: next,
    reason,
    snapshot
  });
  return next;
};

export const reinforceIdentity = (personId: string, reason: string) => {
  const people = getPeople();
  const updated = adjustIdentityConfidence(people, personId, 0.06, reason);
  if (updated !== null) save(STORAGE_KEYS.PEOPLE, people);
  return updated;
};

export const weakenIdentity = (personId: string, reason: string, sharp: boolean = false) => {
  const people = getPeople();
  const delta = sharp ? -0.25 : -0.08;
  const updated = adjustIdentityConfidence(people, personId, delta, reason);
  if (updated !== null) save(STORAGE_KEYS.PEOPLE, people);
  return updated;
};

export const mergeIdentities = (targetId: string, sourceId: string, reason: string) => {
  const people = getPeople();
  const targetIdx = people.findIndex(p => p.id === targetId);
  const sourceIdx = people.findIndex(p => p.id === sourceId);
  if (targetIdx === -1 || sourceIdx === -1) return null;

  const target = { ...people[targetIdx] };
  const source = { ...people[sourceIdx] };
  const snapshot = { target: { ...target }, source: { ...source } };

  const mergedFacts = [...target.facts];
  source.facts.forEach(f => {
    if (!mergedFacts.some(existing => existing.content === f.content)) mergedFacts.push(f);
  });

  const priorTargetConfidence = deriveIdentityConfidence(target);
  const priorSourceConfidence = deriveIdentityConfidence(source);
  const averagedConfidence = clampIdentityConfidence((priorTargetConfidence + priorSourceConfidence) / 2 + 0.1);

  people[targetIdx] = {
    ...target,
    facts: mergedFacts,
    identityConfidence: averagedConfidence,
    lastUpdated: new Date().toISOString()
  };

  people.splice(sourceIdx, 1);

  recordIdentityEvent({
    timestamp: Date.now(),
    personId: targetId,
    delta: averagedConfidence - priorTargetConfidence,
    confidenceAfter: averagedConfidence,
    reason,
    snapshot,
    mergeIds: { targetId, sourceId }
  });

  save(STORAGE_KEYS.PEOPLE, people);
  return { mergedInto: people[targetIdx], snapshot };
};

export const splitIdentityHypothesis = (sourceId: string, newName: string, factStr: string, reason: string) => {
  const people = getPeople();
  const sourceIdx = people.findIndex(p => p.id === sourceId);
  const now = new Date().toISOString();
  let sourceSnapshot: Person | undefined;
  if (sourceIdx !== -1) {
    sourceSnapshot = { ...people[sourceIdx] };
    adjustIdentityConfidence(people, sourceId, -0.12, `${reason} (source dampened)`, { target: sourceSnapshot });
  }

  const newPerson: Person = {
    id: crypto.randomUUID(),
    name: newName,
    relation: 'Contact',
    facts: [{ id: crypto.randomUUID(), content: factStr, source: 'user', timestamp: now }],
    consent_given: true,
    lastUpdated: now,
    identityConfidence: clampIdentityConfidence(0.45),
    mergedInto: undefined
  };

  people.push(newPerson);
  recordIdentityEvent({
    timestamp: Date.now(),
    personId: newPerson.id,
    delta: newPerson.identityConfidence || 0,
    confidenceAfter: newPerson.identityConfidence || 0.45,
    reason,
    snapshot: { source: sourceSnapshot }
  });
  save(STORAGE_KEYS.PEOPLE, people);
  return newPerson;
};

export const updatePerson = (name: string, factStr: string, relation: string = 'Contact') => {
  const people = getPeople();
  const idx = people.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
  if (idx >= 0) {
    people[idx].facts.push({ id: crypto.randomUUID(), content: factStr, source: 'inferred', timestamp: new Date().toISOString() });
    people[idx].lastUpdated = new Date().toISOString();
    adjustIdentityConfidence(people, people[idx].id, 0.04, 'New fact added without correction');
  } else {
    people.push({
      id: crypto.randomUUID(),
      name,
      relation,
      consent_given: true,
      facts: [{ id: crypto.randomUUID(), content: factStr, source: 'user', timestamp: new Date().toISOString() }],
      lastUpdated: new Date().toISOString(),
      identityConfidence: clampIdentityConfidence(0.55)
    });
  }
  save(STORAGE_KEYS.PEOPLE, people);
};

export const updatePersonConsent = (id: string, consent: boolean) => {
  const people = getPeople();
  const idx = people.findIndex(p => p.id === id);
  if (idx !== -1) {
    people[idx].consent_given = consent;
    save(STORAGE_KEYS.PEOPLE, people);
  }
};

export const addFactToPerson = (personId: string, content: string, source: 'user' | 'inferred' | 'system' = 'user') => {
  const people = getPeople();
  const idx = people.findIndex(p => p.id === personId);
  if (idx !== -1) {
    people[idx].facts.push({ id: crypto.randomUUID(), content, source, timestamp: new Date().toISOString() });
    people[idx].lastUpdated = new Date().toISOString();
    adjustIdentityConfidence(people, personId, 0.05, 'Identity reinforced by new linked fact');
    save(STORAGE_KEYS.PEOPLE, people);
  }
};

export const removeFactFromPerson = (personId: string, factId: string) => {
  const people = getPeople();
  const idx = people.findIndex(p => p.id === personId);
  if (idx !== -1) {
    people[idx].facts = people[idx].facts.filter(f => f.id !== factId);
    people[idx].lastUpdated = new Date().toISOString();
    save(STORAGE_KEYS.PEOPLE, people);
  }
};

export const getReminders = (): Reminder[] => load<Reminder[]>(STORAGE_KEYS.REMINDERS, []);
export const upsertReminder = (task: string, dueTime: string, completed: boolean = false): Reminder => {
  const reminders = getReminders();
  const normalizedTask = task.trim().toLowerCase();
  const existingIdx = reminders.findIndex(r => r.task.trim().toLowerCase() === normalizedTask);

  const updatedReminder: Reminder = existingIdx >= 0
    ? { ...reminders[existingIdx], task, dueTime, completed }
    : { id: crypto.randomUUID(), task, dueTime, completed };

  if (existingIdx >= 0) {
    reminders[existingIdx] = updatedReminder;
  } else {
    reminders.unshift(updatedReminder);
  }

  save(STORAGE_KEYS.REMINDERS, reminders);
  return updatedReminder;
};

export const completeReminder = (id: string, completed: boolean = true) => {
  const reminders = getReminders();
  const idx = reminders.findIndex(r => r.id === id);
  if (idx >= 0) {
    reminders[idx].completed = completed;
    save(STORAGE_KEYS.REMINDERS, reminders);
  }
};

export const rescheduleReminder = (id: string, dueTime: string) => {
  const reminders = getReminders();
  const idx = reminders.findIndex(r => r.id === id);
  if (idx >= 0) {
    reminders[idx].dueTime = dueTime;
    save(STORAGE_KEYS.REMINDERS, reminders);
  }
};
export const getSessions = (): ChatSession[] => load<ChatSession[]>(STORAGE_KEYS.SESSIONS, []);
export const createSession = (mode: 'active' | 'observer' = 'active'): ChatSession => {
  const s: ChatSession = { id: crypto.randomUUID(), title: 'Session ' + new Date().toLocaleTimeString(), messages: [], lastUpdated: Date.now(), mode };
  save(STORAGE_KEYS.SESSIONS, [s, ...getSessions()]);
  return s;
};
export const updateSession = (id: string, messages: ChatMessage[]) => save(STORAGE_KEYS.SESSIONS, getSessions().map(s => s.id === id ? { ...s, messages, lastUpdated: Date.now() } : s));
export const deleteSession = (id: string) => save(STORAGE_KEYS.SESSIONS, getSessions().filter(s => s.id !== id));

export const getUserProfile = (): UserProfile => load<UserProfile>(STORAGE_KEYS.USER_PROFILE, { 
  name: 'Operator', 
  bio: 'Cliper Active Session', 
  interests: [], 
  role: 'User', 
  onboardingComplete: true 
});

export const saveUserProfile = (profile: UserProfile) => save(STORAGE_KEYS.USER_PROFILE, profile);

export const getQueue = (): QueueItem[] => load<QueueItem[]>(STORAGE_KEYS.QUEUE, []);
export const addToQueue = (content: string, type: any = 'text') => save(STORAGE_KEYS.QUEUE, [...getQueue(), { id: crypto.randomUUID(), content, type, status: 'pending', timestamp: Date.now(), retryCount: 0 }]);
export const removeFromQueue = (id: string) => save(STORAGE_KEYS.QUEUE, getQueue().filter(i => i.id !== id));
export const updateQueueItem = (id: string, updates: any) => save(STORAGE_KEYS.QUEUE, getQueue().map(i => i.id === id ? { ...i, ...updates } : i));

export const getDecisionLogs = () => load<DecisionLog[]>(STORAGE_KEYS.DECISION_LOGS, []);
export const saveDecisionLog = (log: DecisionLog) => save(STORAGE_KEYS.DECISION_LOGS, [log, ...getDecisionLogs()].slice(0, 50));

export const getStorageUsage = () => ({ usedKB: 0, limitKB: 5000, percent: 0 });

export const runSystemBootCheck = () => {
  const errors: string[] = [];
  try {
      storage.setItem('cliper_boot_check', 'ok');
      storage.removeItem('cliper_boot_check');
  } catch (e) {
      errors.push("Volatile storage subsystem is unreachable.");
  }
  return errors;
};

export const runColdStorageMaintenance = () => {};
export const triggerSync = async () => {};
export const exportData = () => {};
export const importData = async (file: File) => true;
export const factoryReset = () => { storage.clear(); window.location.reload(); };

export const getTranscriptionLogs = (): TranscriptionLog[] => load<TranscriptionLog[]>(STORAGE_KEYS.TRANSCRIPTION_LOGS, []);
// Pseudocode for Word document ingestion:
// 1. Parse .docx text locally (e.g., using a client-side parser) to obtain raw text and author metadata.
// 2. Call addTranscriptionLog(parsedText, 'upload', undefined, { meetingId, meetingDate, participants, sourceType: 'document' }).
// 3. Store the resulting transcript memory under work/meetings/transcripts/{meetingId} with source=document.
// 4. Allow the automatic summary seeds above to populate work/meetings/summaries/{meetingId}.
export const addTranscriptionLog = (
  content: string,
  source: 'upload' | 'live',
  segments?: TranscriptSegment[],
  options?: {
    meetingId?: string;
    participants?: string[];
    meetingDate?: string;
    sourceType?: 'audio' | 'document';
  }
) => {
  const logs = getTranscriptionLogs();
  const meetingId = options?.meetingId || `meeting-${Date.now()}`;
  const meetingDate = options?.meetingDate || new Date().toISOString();
  const sourceType: 'audio' | 'document' = options?.sourceType || 'audio';

  const newLog: TranscriptionLog = { id: crypto.randomUUID(), content, source, timestamp: Date.now(), segments };
  save(STORAGE_KEYS.TRANSCRIPTION_LOGS, [newLog, ...logs]);

  // Persist the full transcript as high-trust, low-salience ground truth
  const transcriptMemory = addMemory({
    content,
    domain: 'work',
    type: 'raw',
    entity: meetingId,
    justification: 'Auto-ingested transcript',
    salience: 0.35,
    strength: 0.7,
    trust_score: 0.98,
    recall_priority: 'low',
    metadata: {
      folder: `work/meetings/transcripts/${meetingId}`,
      table: 'transcripts',
      topic: 'meeting transcript',
      owner: 'work',
      origin: 'transcript',
      meeting_id: meetingId,
      meeting_date: meetingDate,
      participants: options?.participants,
      source: sourceType
    }
  });

  // Seed a lightweight overview summary for quick retrieval
  const summarySeed = content.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ');
  addMemory({
    content: summarySeed || content.slice(0, 280),
    domain: 'work',
    type: 'summary',
    entity: meetingId,
    justification: 'Overview derived from transcript',
    salience: 0.7,
    strength: 0.65,
    metadata: {
      folder: `work/meetings/summaries/${meetingId}`,
      table: 'transcripts',
      topic: summarySeed ? summarySeed.slice(0, 60) : 'meeting overview',
      owner: 'work',
      origin: 'transcript',
      meeting_id: meetingId,
      meeting_date: meetingDate,
      participants: options?.participants,
      source: 'derived',
      summary_of: transcriptMemory?.id,
      summary_type: 'overview'
    }
  });

  // Attempt to capture decision and action hints without cloud inference
  const decisionLines = content
    .split(/\n|(?<=[.!?])\s+/)
    .filter(l => /(decided|agreed|approved|chose)/i.test(l))
    .slice(0, 3);
  const actionLines = content
    .split(/\n|(?<=[.!?])\s+/)
    .filter(l => /(action item|next step|todo|follow up|assign)/i.test(l))
    .slice(0, 3);

  if (decisionLines.length > 0) {
    addMemory({
      content: decisionLines.join(' ').slice(0, 320),
      domain: 'work',
      type: 'summary',
      entity: meetingId,
      justification: 'Decisions noted from transcript',
      salience: 0.65,
      strength: 0.62,
      metadata: {
        folder: `work/meetings/summaries/${meetingId}`,
        table: 'transcripts',
        topic: 'decisions',
        owner: 'work',
        origin: 'transcript',
        meeting_id: meetingId,
        meeting_date: meetingDate,
        participants: options?.participants,
        source: 'derived',
        summary_of: transcriptMemory?.id,
        summary_type: 'decisions'
      }
    });
  }

  if (actionLines.length > 0) {
    addMemory({
      content: actionLines.join(' ').slice(0, 320),
      domain: 'work',
      type: 'summary',
      entity: meetingId,
      justification: 'Action items noted from transcript',
      salience: 0.68,
      strength: 0.64,
      metadata: {
        folder: `work/meetings/summaries/${meetingId}`,
        table: 'transcripts',
        topic: 'action items',
        owner: 'work',
        origin: 'transcript',
        meeting_id: meetingId,
        meeting_date: meetingDate,
        participants: options?.participants,
        source: 'derived',
        summary_of: transcriptMemory?.id,
        summary_type: 'actions'
      }
    });
  }
};
export const deleteTranscriptionLog = (id: string) => save(STORAGE_KEYS.TRANSCRIPTION_LOGS, getTranscriptionLogs().filter(l => l.id !== id));

export const getPlaces = (): Place[] => load<Place[]>(STORAGE_KEYS.PLACES, []);
export const addPlace = (place: Partial<Place>) => {
  const places = getPlaces();
  const newPlace: Place = {
    id: crypto.randomUUID(),
    name: place.name || 'Unnamed Place',
    location: place.location || '',
    description: place.description || '',
    category: place.category || 'General',
    status: place.status || 'bucket_list',
    createdAt: new Date().toISOString()
  };
  save(STORAGE_KEYS.PLACES, [newPlace, ...places]);
};
export const updatePlaceStatus = (id: string, status: Place['status']) => save(STORAGE_KEYS.PLACES, getPlaces().map(p => p.id === id ? { ...p, status } : p));
export const deletePlace = (id: string) => save(STORAGE_KEYS.PLACES, getPlaces().filter(p => p.id !== id));

export const getRooms = (): Room[] => load<Room[]>(STORAGE_KEYS.ROOMS, [
  { id: '1', name: 'Living Room', type: 'living' },
  { id: '2', name: 'Bedroom', type: 'bedroom' },
  { id: '3', name: 'Kitchen', type: 'kitchen' }
]);
export const addRoom = (name: string, type: string) => save(STORAGE_KEYS.ROOMS, [...getRooms(), { id: crypto.randomUUID(), name, type }]);

export const getSmartDevices = (): SmartDevice[] => load<SmartDevice[]>(STORAGE_KEYS.SMART_DEVICES, []);
export const addSmartDevice = (device: Partial<SmartDevice>) => {
  const devices = getSmartDevices();
  save(STORAGE_KEYS.SMART_DEVICES, [...devices, { ...device, id: crypto.randomUUID() } as SmartDevice]);
};
export const updateSmartDevice = (id: string, updates: Partial<SmartDevice>) => save(STORAGE_KEYS.SMART_DEVICES, getSmartDevices().map(d => d.id === id ? { ...d, ...updates } : d));
export const deleteSmartDevice = (id: string) => save(STORAGE_KEYS.SMART_DEVICES, getSmartDevices().filter(d => d.id !== id));

export const purgeOldDecisionLogs = () => {};

export const storageAdapter: StorageAdapter = {
  initializeStorage,
  getSettings,
  saveSettings,
  getMemories,
  getPendingProjectDecision,
  savePendingProjectDecision,
  getPendingPersonDecision,
  savePendingPersonDecision,
  addMemory,
  approveMemory,
  updateMemory,
  deleteMemory,
  getMemoriesInFolder,
  trackMemoryAccess,
  registerMemoryIgnored,
  getPeople,
  reinforceIdentity,
  weakenIdentity,
  mergeIdentities,
  splitIdentityHypothesis,
  updatePerson,
  updatePersonConsent,
  addFactToPerson,
  removeFactFromPerson,
  getReminders,
  upsertReminder,
  completeReminder,
  rescheduleReminder,
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  getUserProfile,
  saveUserProfile,
  getQueue,
  addToQueue,
  removeFromQueue,
  updateQueueItem,
  getDecisionLogs,
  saveDecisionLog,
  getStorageUsage,
  runSystemBootCheck,
  runColdStorageMaintenance,
  triggerSync,
  exportData,
  importData,
  factoryReset,
  getTranscriptionLogs,
  addTranscriptionLog,
  deleteTranscriptionLog,
  getPlaces,
  addPlace,
  updatePlaceStatus,
  deletePlace,
  getRooms,
  addRoom,
  getSmartDevices,
  addSmartDevice,
  updateSmartDevice,
  deleteSmartDevice,
  purgeOldDecisionLogs
};
