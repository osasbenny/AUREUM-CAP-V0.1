import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createRepository } from '../db/repository.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required; private RDS access must come from a VPC-connected runner');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } });
const schema = await fs.readFile(path.join(root, 'db', 'schema.sql'), 'utf8');
await pool.query(schema);
const manifest = JSON.parse(await fs.readFile(path.join(root, 'data', 'activation-manifest.json'), 'utf8'));
const repository = createRepository();
await repository.bootstrap(manifest, manifest.campaign);
const check = await pool.query("select count(*)::int as organizations from organizations; select count(*)::int as campaigns from campaigns; select count(*)::int as cap_leads from cap_leads;");
console.log(JSON.stringify({ ok: true, checks: check.map((r) => r.rows[0]) }, null, 2));
await repository.close();
await pool.end();
