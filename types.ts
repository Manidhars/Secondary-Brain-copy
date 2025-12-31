
export type MemoryType = 'fact' | 'decision' | 'preference' | 'constraint' | 'task' | 'issue' | 'raw' | 'summary' | 'event' | 'insight';
export type MemoryDomain = 'work' | 'personal' | 'home' | 'health' | 'finance' | 'system' | 'general';
export type MemoryStatus = 'active' | 'completed' | 'archived' | 'decaying' | 'deprecated' | 'superseded' | 'cold_storage' | 'contradictory';
export type RecallPriority = 'high' | 'normal' | 'low';
export type LLMProvider = 'auto' | 'local';
export type ConnectionProtocol = 'wired' | 'wifi' | 'ble' | 'cloud';
export type MemoryCluster = 'main' | 'experimental';

export interface Memory {
  id: string;
  type: MemoryType;
  domain: MemoryDomain;
  entity: string; 
  content: string; 
  speaker: 'user' | 'external' | 'unknown';
  confidence: number;
  salience: number;
  trust_score: number;
  confidence_history: number[];
  strength?: number;
  status: MemoryStatus;
  recall_priority: RecallPriority;
  supersedes: string | null;
  source_hash: string; 
  vocab_version: string; 
  distilled_by: string; 
  createdAt: string;
  lastAccessedAt: string;
  updatedAt?: string; 
  accessCount: number;
  embedding?: number[];
  images?: string[];
  isLocked?: boolean; 
  isPendingApproval?: boolean; 
  isPinned?: boolean;
  justification?: string;
  cluster: MemoryCluster;
  metadata?: {
    is_drifting?: boolean;
    contradicts_id?: string;
    validation_reason?: string;
    last_edit_reason?: string;
    last_sync_at?: string;
    insight_source_ids?: string[];
    folder?: string;
    table?: string;
    topic?: string;
    owner?: 'self' | 'friend' | 'work' | 'system' | string;
    origin?: 'manual' | 'transcript' | 'reminder' | 'preference' | 'import';
    meeting_id?: string;
    meeting_date?: string;
    participants?: string[];
    source?: 'audio' | 'document' | 'derived';
    summary_of?: string;
    summary_type?: 'overview' | 'decisions' | 'actions' | 'micro';
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  intent?: string; 
  images?: string[];
  explanation?: {
    reasoning: string;
    citations: string[];
    assumptions?: string[];
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastUpdated: number;
  mode: 'active' | 'observer';
}

export interface LLMSettings {
  provider: LLMProvider;
  executionMode: 'auto' | 'manual';
  ollamaUrl: string;
  ollamaModel: string;
  mcpEnabled: boolean;
  mcpEndpoint: string;
  enableSimulation: boolean;
  orinMode: boolean; 
  travelMode: boolean;
  cloud_disabled: boolean;
  decision_log_ttl_days: number; 
  max_writes_per_minute: number;
  recall_sensitivity: number;
  privacy_epsilon: number; 
  auto_approve_facts: boolean; 
  sync_enabled: boolean; 
  sync_endpoint?: string;
  sync_encryption_key?: string; 
  active_cluster: MemoryCluster; 
  deep_recall_enabled: boolean;
  last_maintenance_at?: string;
  pii_filter_enabled: boolean; 
  encryption_at_rest: boolean; 
}

export interface DecisionLog {
  timestamp: number;
  query: string;
  memory_retrieval_used: boolean;
  memories_considered: number;
  memories_injected: number;
  injected_ids?: string[]; 
  cloud_called: boolean;
  decision_reason: string;
  retrieval_latency_ms: number;
  cognitive_load: number;
  assumptions?: string[];
  anomaly_score?: number;
}

export interface SystemHealth {
  status: 'nominal' | 'degraded' | 'safe_mode';
  storage_pressure: number; 
  avg_latency: number;
  queue_depth: number;
  boot_errors: string[];
  anomalies_detected: number;
  cognitive_saturation: number;
}

export enum View {
  ONBOARDING = 'onboarding',
  DASHBOARD = 'dashboard',
  CHAT = 'chat',
  MEMORIES = 'memories',
  PEOPLE = 'people',
  TRANSCRIBE = 'transcribe',
  SETTINGS = 'settings',
  PHOTO_FRAME = 'photo_frame',
  HOME = 'home',
  TIMELINE = 'timeline',
  AUDIT = 'audit'
}

export interface PersonFact {
  id: string;
  content: string;
  source: 'user' | 'inferred' | 'system';
  timestamp: string;
}

export interface Person {
  id: string;
  name: string;
  relation: string;
  facts: PersonFact[];
  consent_given: boolean; // New: Governance
  lastUpdated: string;
  identityConfidence?: number;
  mergedInto?: string;
}

export interface Reminder {
  id: string;
  task: string;
  dueTime: string;
  completed: boolean;
}

export interface Place {
  id: string;
  name: string;
  location: string;
  description: string;
  category: string;
  status: 'bucket_list' | 'visited' | 'archived';
  createdAt: string;
}

export interface UserProfile {
  name: string;
  bio: string;
  interests: string[];
  role: string;
  onboardingComplete: boolean;
}

export interface QueueItem {
  id: string;
  content: string;
  type: 'text' | 'image' | 'maintenance' | 'insight_gen' | 'diarization';
  status: 'pending' | 'processing' | 'failed';
  timestamp: number;
  retryCount: number;
  imageBase64?: string;
  error?: string;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp: number;
}

export interface PendingProjectDecision {
  projectName: string;
  existingMemoryId?: string;
  slug?: string;
  createdAt: string;
}

export interface PendingPersonDecision {
  name: string;
  matchedPersonId?: string;
  fact: string;
  createdAt: string;
  candidates?: { personId: string; confidence: number; evidence: string[] }[];
  lastPrompt?: string;
}

export interface TranscriptionLog {
  id: string;
  content: string;
  source: 'upload' | 'live';
  timestamp: number;
  segments?: TranscriptSegment[]; // New: Multi-speaker handling
}

export interface SmartDevice {
  id: string;
  name: string;
  type: 'light' | 'thermostat' | 'lock' | 'outlet' | 'sensor';
  status: string;
  room: string;
  protocol: ConnectionProtocol;
  powerUsage?: number;
  brightness?: number;
  battery?: number;
}

export interface Room {
  id: string;
  name: string;
  type: string;
}
