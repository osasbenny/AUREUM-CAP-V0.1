import pg from 'pg';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;

export function createRepository() {
  if (!process.env.DATABASE_URL) return null;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }, max: Number(process.env.DATABASE_POOL_MAX || 5) });
  return {
    pool,
    async health() { const result = await pool.query('select 1 as ok'); return result.rows[0].ok === 1; },
    async bootstrap(manifest, campaignName) {
      await pool.query(`CREATE TABLE IF NOT EXISTS cap_leads (lead_id text PRIMARY KEY, business text NOT NULL, phone text NOT NULL, record jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE IF NOT EXISTS cap_queue_jobs (id uuid PRIMARY KEY, lead_id text NOT NULL, type text NOT NULL, provider text, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'QUEUED', attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
        CREATE INDEX IF NOT EXISTS cap_queue_jobs_status_idx ON cap_queue_jobs(status,available_at);
        CREATE TABLE IF NOT EXISTS cap_provider_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL, provider_event_id text, lead_id text, payload jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,provider_event_id));`);
      for (const record of manifest.records) await pool.query('INSERT INTO cap_leads(lead_id,business,phone,record) VALUES($1,$2,$3,$4) ON CONFLICT(lead_id) DO NOTHING', [String(record.lead_id), record.business, record.phone, record]);
      return { imported: manifest.records.length, campaign: campaignName };
    },
    async listLeads() { const result = await pool.query('SELECT record FROM cap_leads ORDER BY lead_id::int NULLS LAST, lead_id'); return result.rows.map((row) => row.record); },
    async saveLead(lead) { await pool.query('INSERT INTO cap_leads(lead_id,business,phone,record) VALUES($1,$2,$3,$4) ON CONFLICT(lead_id) DO UPDATE SET business=EXCLUDED.business,phone=EXCLUDED.phone,record=EXCLUDED.record,updated_at=now()', [String(lead.uid || lead.id), lead.name || lead.business, lead.phone, lead]); },
    async saveEvent(event) { await pool.query('INSERT INTO events(event_type,entity_type,entity_id,payload) VALUES($1,$2,$3,$4)', [event.type || event.event_type, event.entity_type || 'lead', event.entity_id || null, event.payload || {}]); },
    async enqueue(job) { await pool.query('INSERT INTO cap_queue_jobs(id,lead_id,type,provider,payload,status,attempts) VALUES($1,$2,$3,$4,$5,$6,$7)', [job.id, String(job.lead_id), job.type, job.provider, job, job.status || 'QUEUED', job.attempts || 0]); },
    async listQueue() { const result = await pool.query('SELECT payload AS job FROM cap_queue_jobs WHERE status IN (\'QUEUED\',\'RETRY\') ORDER BY created_at'); return result.rows.map((row) => row.job); },
    async claimNext() { const client = await pool.connect(); try { await client.query('BEGIN'); const result = await client.query(`UPDATE cap_queue_jobs SET status='PROCESSING',locked_at=now(),updated_at=now(),attempts=attempts+1 WHERE id=(SELECT id FROM cap_queue_jobs WHERE status IN ('QUEUED','RETRY') AND available_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`); await client.query('COMMIT'); return result.rows[0] || null; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } },
    async completeJob(id, status, error = null) { await pool.query('UPDATE cap_queue_jobs SET status=$2,last_error=$3,updated_at=now() WHERE id=$1', [id, status, error]); },
    async close() { await pool.end(); },
  };
}

export function newJobId() { return randomUUID(); }
