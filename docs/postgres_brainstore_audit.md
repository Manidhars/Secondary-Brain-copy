# PostgresBrainStore vs. SessionStorageAdapter Parity Audit

## Scope
Audit of the custom `PostgresBrainStore` against the baseline `SessionStorageAdapter` behaviors for work memories, with a focus on summary-first retrieval and transcript fallback semantics when vector search is disabled.

## Observed Behavioral Differences
- **Limited surface area vs. full adapter**: `PostgresBrainStore` only persists `memories` rows and exposes `saveMemory` and `searchWorkMemories`, whereas `SessionStorageAdapter` manages settings, sessions, decision logs, queues, people, and the same memories in a single key-value space. Any use of `PostgresBrainStore` bypasses strength/identity decay tracking, pending approvals, and event logging performed in `storage.ts` when memories are updated or accessed.【F:services/postgresBrainStore.ts†L23-L145】【F:services/storage.ts†L25-L208】

- **Default field handling**: Session-backed `addMemory` populates defaults (strength/salience/trust, timestamps, cluster, status) and applies decay/reinforcement on updates. `PostgresBrainStore.saveMemory` writes whatever shape is provided, so absent defaults remain `NULL` and can alter downstream ranking via `COALESCE` or filtering logic that expects `status === 'active'` and `cluster` matching the active cluster.【F:services/postgresBrainStore.ts†L54-L82】【F:services/storage.ts†L303-L357】【F:services/llm.ts†L1290-L1327】

- **Search scope and filters**: The session workflow filters search space by active cluster and `status === 'active'`, and further narrows by folder scopes before ranking. `PostgresBrainStore.searchWorkMemories` queries every row with a `metadata.folder` prefix, regardless of status/cluster, which can surface stale or cross-cluster items that the session adapter would exclude.【F:services/postgresBrainStore.ts†L84-L143】【F:services/llm.ts†L1290-L1327】

- **Ignored-memory handling**: Session retrieval calls `registerMemoryIgnored` with non-selected candidates drawn from the filtered search space. The Postgres store recomputes ignored IDs by selecting *all* other rows in the database with the same folder prefix, even if they were already filtered out in-memory (different cluster/status) or were never part of the current search space.【F:services/postgresBrainStore.ts†L127-L143】【F:services/llm.ts†L1346-L1353】

## Semantics When Vector Search Is Disabled
- Transcript fallback depends on an embedding input. When `embedding` is omitted, `shouldFallback` can be `true` (no/weak summaries), but transcript queries are skipped, returning only summary matches. The session path always falls back to text-matched transcripts and even creates micro-summaries, so the Postgres store does **not** match the transcript fallback semantics without vectors.【F:services/postgresBrainStore.ts†L167-L197】【F:services/llm.ts†L1206-L1243】

- Even with vectors disabled, the Postgres path still requires the `vector` extension at init, which differs from the session adapter’s zero-dependency startup path.【F:services/postgresBrainStore.ts†L30-L48】【F:services/storage.ts†L152-L171】

## Vector-Enabled vs. Non-Vector Retrieval
- **Ranking surface changes**: With an embedding provided, transcript fallback orders rows purely by vector distance and skips the salience/trust/strength weighting used by the text fallback, so the relative order of transcript candidates diverges from the non-vector path and the session baseline.【F:services/postgresBrainStore.ts†L171-L197】【F:services/llm.ts†L1210-L1238】

- **Query coverage loosened by vectors**: Vector-backed fallback ignores `queries` entirely, allowing transcripts with no lexical overlap to satisfy unresolved queries, whereas the text fallback (and the session planner) require `LOWER(content)` matches via `rankQueryMatches`. This can surface unrelated transcripts or leave queries unresolved despite a triggered fallback.【F:services/postgresBrainStore.ts†L167-L197】【F:services/llm.ts†L1206-L1238】

- **Zero-query behavior diverges**: When `queries` is empty and summaries are missing, the vector path still returns transcripts by similarity, but the non-vector path returns none because it requires `summaryPatterns` for transcript search. The session planner always works from decomposed queries, so the vector path introduces a new retrieval surface absent in the non-vector baseline.【F:services/postgresBrainStore.ts†L167-L197】【F:services/llm.ts†L1136-L1175】

## Edge Cases That May Diverge
- **Missing or inconsistent metadata**: Rows lacking `metadata.folder` are invisible to Postgres queries, while session retrieval could still include them if they reside in the in-memory search space filtered by cluster/status.
- **Ignored ID inflation**: Because Postgres recomputes ignored IDs across the whole table, ignored lists may contain memories outside the current user cluster or inactive items that the session adapter would never register.
- **Ranking changes from nulls**: `COALESCE` defaults (`salience`, `trust_score`, `strength`) differ from the initialized defaults in `addMemory`, potentially changing ordering relative to session-based ranking.【F:services/postgresBrainStore.ts†L91-L99】【F:services/storage.ts†L330-L357】
- **Access/decay side effects**: Session retrieval increments `accessCount`, updates `lastAccessedAt`, applies decay, and logs identity/memory adjustments; the Postgres store omits these side effects entirely, so downstream trust/strength evolution diverges over time.【F:services/storage.ts†L483-L551】

