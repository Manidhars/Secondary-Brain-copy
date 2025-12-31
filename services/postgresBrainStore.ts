import { Pool } from 'pg';
import { toSql } from 'pgvector/pg';
import { Memory } from '../types';

export type VectorMemory = Memory & { embedding?: number[] };

export type WorkSearchResult = {
  summaries: Memory[];
  transcripts: Memory[];
  ignoredIds: string[];
  fallbackTriggered: boolean;
};

const SUMMARY_FOLDER_PREFIX = 'work/meetings/summaries';
const TRANSCRIPT_FOLDER_PREFIX = 'work/meetings/transcripts';

const isWorkSummary = (memory: Memory) =>
  (memory.metadata?.folder || '').toLowerCase().startsWith(SUMMARY_FOLDER_PREFIX);

const isWorkTranscript = (memory: Memory) =>
  (memory.metadata?.folder || '').toLowerCase().startsWith(TRANSCRIPT_FOLDER_PREFIX);

const toIsoString = (value: any) => {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value.toString();
};

export class PostgresBrainStore {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        domain TEXT,
        type TEXT,
        entity TEXT,
        justification TEXT,
        salience REAL,
        strength REAL,
        trust_score REAL,
        status TEXT,
        cluster TEXT,
        access_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
        metadata JSONB,
        embedding vector(1536)
      );
    `);
    // Parity: ensure new parity-critical columns exist even on pre-existing tables.
    await this.pool.query(`ALTER TABLE memories ADD COLUMN IF NOT EXISTS status TEXT`);
    await this.pool.query(`ALTER TABLE memories ADD COLUMN IF NOT EXISTS cluster TEXT`);
    await this.pool.query(`ALTER TABLE memories ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0`);
    await this.pool.query(`ALTER TABLE memories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
    await this.pool.query(`ALTER TABLE memories ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW()`);
  }

  async saveMemory(memory: VectorMemory) {
    // Parity: initialize defaults to match SessionStorageAdapter expectations.
    const nowIso = new Date().toISOString();
    const salience = memory.salience ?? 0.8;
    const trustScore = memory.trust_score ?? 1.0;
    const strength = memory.strength ?? Math.min(1.25, Math.max(0.05, 0.6 + salience * 0.15));
    const status = memory.status ?? 'active';
    const cluster = memory.cluster ?? (process.env.VITE_ACTIVE_CLUSTER as string) ?? 'main';
    const createdAt = memory.createdAt ?? nowIso;
    const updatedAt = memory.updatedAt ?? nowIso;
    const lastAccessedAt = memory.lastAccessedAt ?? nowIso;
    const accessCount = memory.accessCount ?? 1;

    const shouldEmbed = isWorkSummary(memory) || isWorkTranscript(memory);
    const embeddingValue = shouldEmbed && memory.embedding ? toSql(memory.embedding) : null;

    await this.pool.query(
      `INSERT INTO memories (id, content, domain, type, entity, justification, salience, strength, trust_score, status, cluster, access_count, created_at, updated_at, last_accessed_at, metadata, embedding)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         domain = EXCLUDED.domain,
         type = EXCLUDED.type,
         entity = EXCLUDED.entity,
         justification = EXCLUDED.justification,
         salience = EXCLUDED.salience,
         strength = EXCLUDED.strength,
         trust_score = EXCLUDED.trust_score,
         status = EXCLUDED.status,
         cluster = EXCLUDED.cluster,
         access_count = EXCLUDED.access_count,
         created_at = COALESCE(memories.created_at, EXCLUDED.created_at),
         updated_at = EXCLUDED.updated_at,
         last_accessed_at = EXCLUDED.last_accessed_at,
         metadata = EXCLUDED.metadata,
         embedding = EXCLUDED.embedding`,
      [
        memory.id,
        memory.content,
        memory.domain,
        memory.type,
        memory.entity,
        memory.justification,
        salience,
        strength,
        trustScore,
        status,
        cluster,
        accessCount,
        createdAt,
        updatedAt,
        lastAccessedAt,
        memory.metadata,
        embeddingValue
      ]
    );
  }

  async searchWorkMemories(queries: string[], embedding?: number[], limit = 8): Promise<WorkSearchResult> {
    const activeCluster = (process.env.VITE_ACTIVE_CLUSTER as string) || 'main';
    const summaryPatterns = queries.length > 0 ? queries.map(q => `%${q.toLowerCase()}%`) : [];

    // Parity: enforce cluster/status scope before ranking and ignored tracking.
    const summaryRes = await this.pool.query<Memory>(
      `SELECT * FROM memories
       WHERE LOWER(metadata->>'folder') LIKE $1
         AND COALESCE(status, 'active') = 'active'
         AND COALESCE(cluster, $2) = $2
       ${summaryPatterns.length > 0 ? 'AND (LOWER(content) LIKE ANY($3))' : ''}
       ORDER BY COALESCE(salience, 0.8) * COALESCE(trust_score, 1.0) * COALESCE(strength, 0.6) DESC
       LIMIT $4`,
      summaryPatterns.length > 0
        ? [
            `${SUMMARY_FOLDER_PREFIX}%`,
            activeCluster,
            summaryPatterns,
            limit
          ]
        : [`${SUMMARY_FOLDER_PREFIX}%`, activeCluster, limit]
    );

    const summaries = summaryRes.rows.map(row => ({
      ...row,
      salience: row.salience ?? 0.8,
      trust_score: row.trust_score ?? 1.0,
      strength: row.strength ?? 0.6,
      status: row.status ?? 'active',
      cluster: row.cluster ?? activeCluster,
      createdAt: toIsoString((row as any).created_at || row.createdAt || new Date().toISOString()),
      updatedAt: toIsoString((row as any).updated_at || row.updatedAt || new Date().toISOString()),
      lastAccessedAt: toIsoString((row as any).last_accessed_at || row.lastAccessedAt || new Date().toISOString()),
      accessCount: (row as any).access_count ?? row.accessCount ?? 0
    } as Memory));
    const coveredQueries = new Set<string>();
    summaries.forEach(m => {
      const lower = m.content.toLowerCase();
      queries.forEach(q => {
        if (lower.includes(q.toLowerCase())) coveredQueries.add(q.toLowerCase());
      });
    });

    const unresolvedQueries = queries.filter(q => !coveredQueries.has(q.toLowerCase()));
    const shouldFallback = summaries.length === 0 || unresolvedQueries.length > 0;
    let transcripts: Memory[] = [];

    if (shouldFallback) {
      if (embedding) {
        // Transcript fallback via vector similarity
        const transcriptRes = await this.pool.query<Memory>(
          `SELECT * FROM memories
           WHERE LOWER(metadata->>'folder') LIKE $1 AND embedding IS NOT NULL
             AND COALESCE(status, 'active') = 'active'
             AND COALESCE(cluster, $2) = $2
           ORDER BY embedding <-> $3
           LIMIT $4`,
          [`${TRANSCRIPT_FOLDER_PREFIX}%`, activeCluster, toSql(embedding), Math.max(1, limit - summaries.length)]
        );
        transcripts = transcriptRes.rows;
      } else if (summaryPatterns.length > 0) {
        // Parity: fallback to transcript text search when vectors are disabled.
        const transcriptRes = await this.pool.query<Memory>(
          `SELECT * FROM memories
           WHERE LOWER(metadata->>'folder') LIKE $1
             AND COALESCE(status, 'active') = 'active'
             AND COALESCE(cluster, $2) = $2
             AND (LOWER(content) LIKE ANY($3))
           ORDER BY COALESCE(salience, 0.8) * COALESCE(trust_score, 1.0) * COALESCE(strength, 0.6) DESC
           LIMIT $4`,
          [`${TRANSCRIPT_FOLDER_PREFIX}%`, activeCluster, summaryPatterns, Math.max(1, limit - summaries.length)]
        );
        transcripts = transcriptRes.rows;
      }
    }

    transcripts = transcripts.map(row => ({
      ...row,
      salience: row.salience ?? 0.8,
      trust_score: row.trust_score ?? 1.0,
      strength: row.strength ?? 0.6,
      status: row.status ?? 'active',
      cluster: row.cluster ?? activeCluster,
      createdAt: toIsoString((row as any).created_at || row.createdAt || new Date().toISOString()),
      updatedAt: toIsoString((row as any).updated_at || row.updatedAt || new Date().toISOString()),
      lastAccessedAt: toIsoString((row as any).last_accessed_at || row.lastAccessedAt || new Date().toISOString()),
      accessCount: (row as any).access_count ?? row.accessCount ?? 0
    } as Memory));

    const touchedIds = [...summaries, ...transcripts].map(m => m.id);
    if (touchedIds.length > 0) {
      // Parity: record lightweight access side effects without full decay.
      await this.pool.query(
        `UPDATE memories
         SET access_count = COALESCE(access_count, 0) + 1,
             last_accessed_at = NOW(),
             updated_at = NOW()
         WHERE id = ANY($1::text[])`,
        [touchedIds]
      );
    }

    const ignoredIds = new Set<string>();
    const summaryIds = new Set(summaries.map(s => s.id));
    if (summaries.length > 0) {
      const ignoredSummaryRows = await this.pool.query<{ id: string }>(
        `SELECT id FROM memories
         WHERE LOWER(metadata->>'folder') LIKE $1
           AND COALESCE(status, 'active') = 'active'
           AND COALESCE(cluster, $2) = $2
           AND id <> ALL($3)`,
        [`${SUMMARY_FOLDER_PREFIX}%`, activeCluster, Array.from(summaryIds)]
      );
      ignoredSummaryRows.rows.forEach(r => ignoredIds.add(r.id));
    }
    if (transcripts.length > 0) {
      const ignoredTranscriptRows = await this.pool.query<{ id: string }>(
        `SELECT id FROM memories
         WHERE LOWER(metadata->>'folder') LIKE $1
           AND COALESCE(status, 'active') = 'active'
           AND COALESCE(cluster, $2) = $2
           AND id <> ALL($3)` ,
        [`${TRANSCRIPT_FOLDER_PREFIX}%`, activeCluster, transcripts.map(t => t.id)]
      );
      ignoredTranscriptRows.rows.forEach(r => ignoredIds.add(r.id));
    }

    return { summaries, transcripts, ignoredIds: Array.from(ignoredIds), fallbackTriggered: shouldFallback };
  }
}
