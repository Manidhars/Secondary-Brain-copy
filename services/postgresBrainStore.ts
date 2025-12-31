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
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        embedding vector(1536)
      );
    `);
  }

  async saveMemory(memory: VectorMemory) {
    const shouldEmbed = isWorkSummary(memory) || isWorkTranscript(memory);
    const embeddingValue = shouldEmbed && memory.embedding ? toSql(memory.embedding) : null;

    await this.pool.query(
      `INSERT INTO memories (id, content, domain, type, entity, justification, salience, strength, trust_score, metadata, embedding)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         domain = EXCLUDED.domain,
         type = EXCLUDED.type,
         entity = EXCLUDED.entity,
         justification = EXCLUDED.justification,
         salience = EXCLUDED.salience,
         strength = EXCLUDED.strength,
         trust_score = EXCLUDED.trust_score,
         metadata = EXCLUDED.metadata,
         embedding = EXCLUDED.embedding`,
      [
        memory.id,
        memory.content,
        memory.domain,
        memory.type,
        memory.entity,
        memory.justification,
        memory.salience,
        memory.strength,
        memory.trust_score,
        memory.metadata,
        embeddingValue
      ]
    );
  }

  async searchWorkMemories(queries: string[], embedding?: number[], limit = 8): Promise<WorkSearchResult> {
    const summaryPatterns = queries.length > 0 ? queries.map(q => `%${q.toLowerCase()}%`) : [];

    const summaryRes = await this.pool.query<Memory>(
      `SELECT * FROM memories
       WHERE LOWER(metadata->>'folder') LIKE $1
       ${summaryPatterns.length > 0 ? 'AND (LOWER(content) LIKE ANY($2))' : ''}
       ORDER BY COALESCE(salience, 0.5) * COALESCE(trust_score, 0.6) * COALESCE(strength, 0.6) DESC
       LIMIT $3`,
      summaryPatterns.length > 0
        ? [
            `${SUMMARY_FOLDER_PREFIX}%`,
            summaryPatterns,
            limit
          ]
        : [`${SUMMARY_FOLDER_PREFIX}%`, limit]
    );

    const summaries = summaryRes.rows;
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

    if (shouldFallback && embedding) {
      // Transcript fallback via vector similarity
      const transcriptRes = await this.pool.query<Memory>(
        `SELECT * FROM memories
         WHERE LOWER(metadata->>'folder') LIKE $1 AND embedding IS NOT NULL
         ORDER BY embedding <-> $2
         LIMIT $3`,
        [`${TRANSCRIPT_FOLDER_PREFIX}%`, toSql(embedding), Math.max(1, limit - summaries.length)]
      );
      transcripts = transcriptRes.rows;
    }

    const ignoredIds = new Set<string>();
    const summaryIds = new Set(summaries.map(s => s.id));
    if (summaries.length > 0) {
      const ignoredSummaryRows = await this.pool.query<{ id: string }>(
        `SELECT id FROM memories WHERE LOWER(metadata->>'folder') LIKE $1 AND id <> ALL($2)`,
        [`${SUMMARY_FOLDER_PREFIX}%`, Array.from(summaryIds)]
      );
      ignoredSummaryRows.rows.forEach(r => ignoredIds.add(r.id));
    }
    if (transcripts.length > 0) {
      const ignoredTranscriptRows = await this.pool.query<{ id: string }>(
        `SELECT id FROM memories WHERE LOWER(metadata->>'folder') LIKE $1 AND id <> ALL($2)` ,
        [`${TRANSCRIPT_FOLDER_PREFIX}%`, transcripts.map(t => t.id)]
      );
      ignoredTranscriptRows.rows.forEach(r => ignoredIds.add(r.id));
    }

    return { summaries, transcripts, ignoredIds: Array.from(ignoredIds), fallbackTriggered: shouldFallback };
  }
}
