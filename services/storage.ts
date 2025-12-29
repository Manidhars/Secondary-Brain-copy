import { 
  Memory, Person, Reminder, Place, MemoryType, MemoryDomain, ChatMessage, MemoryStatus, 
  ChatSession, LLMSettings, UserProfile, QueueItem, TranscriptionLog, 
  SmartDevice, Room, ConnectionProtocol, RecallPriority, DecisionLog, PersonFact, TranscriptSegment 
} from '../types';

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
  DECISION_LOGS: 'cliper_decision_logs'
};

type StorageAdapter = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  keys: () => string[];
};

const memoryFallback: Record<string, string> = {};

let storageMode: 'session' | 'memory' = 'session';

const createStorageAdapter = (): StorageAdapter => {
  try {
    const sess = window.sessionStorage;
    const probeKey = '__cliper_probe__';
    sess.setItem(probeKey, 'ok');
    sess.removeItem(probeKey);

    return {
      getItem: (key: string) => sess.getItem(key),
      setItem: (key: string, value: string) => sess.setItem(key, value),
      removeItem: (key: string) => sess.removeItem(key),
      clear: () => sess.clear(),
      keys: () => Array.from({ length: sess.length }).map((_, idx) => sess.key(idx) || '')
    };
  } catch (e) {
    console.warn('[Cliper] Falling back to in-memory storage. SessionStorage unavailable.', e);
    storageMode = 'memory';
    return {
      getItem: (key: string) => memoryFallback[key] ?? null,
      setItem: (key: string, value: string) => { memoryFallback[key] = value; },
      removeItem: (key: string) => { delete memoryFallback[key]; },
      clear: () => { Object.keys(memoryFallback).forEach(k => delete memoryFallback[k]); },
      keys: () => Object.keys(memoryFallback)
    };
  }
};

const storage: StorageAdapter = createStorageAdapter();

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
    console.log("[Cliper] Volatile memory initialized.");
};

export const getSettings = (): LLMSettings => {
  return load<LLMSettings>(STORAGE_KEYS.SETTINGS, {
    provider: 'gemini',
    executionMode: 'auto',
    ollamaUrl: '',
    ollamaModel: '',
    local_llm_endpoint: 'http://localhost:8000/generate',
    local_llm_model: 'mistral',
    local_transcription_endpoint: 'http://localhost:8000/transcribe',
    local_api_key: '',
    mcpEnabled: false,
    mcpEndpoint: '',
    enableSimulation: false,
    orinMode: true,
    travelMode: false,
    cloud_disabled: false,
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
export const getMemories = (): Memory[] => load<Memory[]>(STORAGE_KEYS.MEMORIES, []);

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
    trust_score: 1.0,
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
    accessCount: 1,
    isLocked: false, 
    isPendingApproval: params.isPendingApproval || false,
    isPinned: params.isPinned || false,
    justification: params.justification || "Session Insight",
    cluster: settings.active_cluster
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
    memories[idx] = { ...memories[idx], ...updates, updatedAt: new Date().toISOString() };
    save(STORAGE_KEYS.MEMORIES, memories);
  }
};

export const deleteMemory = (id: string) => {
  const memories = getMemories();
  save(STORAGE_KEYS.MEMORIES, memories.filter(m => m.id !== id));
};

export const trackMemoryAccess = (id: string) => {
  const memories = getMemories();
  const idx = memories.findIndex(m => m.id === id);
  if (idx !== -1) {
    memories[idx].accessCount++;
    memories[idx].lastAccessedAt = new Date().toISOString();
    save(STORAGE_KEYS.MEMORIES, memories);
  }
};

export const getPeople = (): Person[] => load<Person[]>(STORAGE_KEYS.PEOPLE, []);
export const updatePerson = (name: string, factStr: string, relation: string = 'Contact') => {
  const people = getPeople();
  const idx = people.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
  if (idx >= 0) {
    people[idx].facts.push({ id: crypto.randomUUID(), content: factStr, source: 'inferred', timestamp: new Date().toISOString() });
    people[idx].lastUpdated = new Date().toISOString();
  } else {
    people.push({ id: crypto.randomUUID(), name, relation, consent_given: true, facts: [{ id: crypto.randomUUID(), content: factStr, source: 'user', timestamp: new Date().toISOString() }], lastUpdated: new Date().toISOString() });
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

export const getStorageUsage = () => {
  const keys = storage.keys();
  const usedKB = keys.reduce((acc, key) => {
    const value = storage.getItem(key) || '';
    return acc + (key.length + value.length) * 2 / 1024; // UTF-16 bytes -> KB
  }, 0);

  // SessionStorage nominal quota ~5MB; keep conservative headroom for fallback memory mode too.
  const limitKB = 5000;
  const percent = Math.min(100, Math.round((usedKB / limitKB) * 100));

  return { usedKB, limitKB, percent };
};

export const runSystemBootCheck = () => {
  const errors: string[] = [];
  try {
      storage.setItem('cliper_boot_check', 'ok');
      storage.removeItem('cliper_boot_check');
  } catch (e) {
      errors.push("Volatile storage subsystem is unreachable.");
  }

  const usage = getStorageUsage();
  if (usage.percent >= 90) {
      errors.push(`Storage pressure high (${usage.percent}%). Aging logs will purge automatically.`);
  }

  if (storageMode === 'memory') {
      errors.push('Operating in RAM fallback mode. Data will be lost on refresh.');
  }

  return errors;
};

export const runColdStorageMaintenance = () => {};
export const triggerSync = async () => {};
export const exportData = () => {};
export const importData = async (file: File) => true;
export const factoryReset = () => { storage.clear(); window.location.reload(); };

export const getTranscriptionLogs = (): TranscriptionLog[] => load<TranscriptionLog[]>(STORAGE_KEYS.TRANSCRIPTION_LOGS, []);
export const addTranscriptionLog = (content: string, source: 'upload' | 'live', segments?: TranscriptSegment[]) => {
  const logs = getTranscriptionLogs();
  const newLog: TranscriptionLog = { id: crypto.randomUUID(), content, source, timestamp: Date.now(), segments };
  save(STORAGE_KEYS.TRANSCRIPTION_LOGS, [newLog, ...logs]);
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

export const purgeOldDecisionLogs = () => {
  const settings = getSettings();
  const ttlMs = (settings.decision_log_ttl_days ?? 1) * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - ttlMs;
  const filtered = getDecisionLogs().filter(log => log.timestamp >= cutoff);
  if (filtered.length !== getDecisionLogs().length) {
    save(STORAGE_KEYS.DECISION_LOGS, filtered);
  }
};
