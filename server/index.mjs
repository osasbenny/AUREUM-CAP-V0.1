import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const leadsPath = path.join(repoRoot, 'data', 'leads.json');
const port = Number(process.env.PORT || 8787);

function configuredReadiness() {
  const sendEnabled = process.env.CAP_SEND_ENABLED === 'true';
  return {
    database: Boolean(process.env.DATABASE_URL),
    storage: Boolean(process.env.CAP_S3_BUCKET),
    queue: Boolean(process.env.CAP_SQS_QUEUE_URL),
    hunter: Boolean(process.env.HUNTER_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    email: sendEnabled && Boolean(process.env.SES_FROM_EMAIL),
    send_gate: sendEnabled ? Boolean(process.env.SES_FROM_EMAIL) : false,
  };
}

function readLeads() {
  return JSON.parse(fs.readFileSync(leadsPath, 'utf8'));
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  if (url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'aureum-cap-v0-1',
      region: process.env.AWS_REGION || 'eu-north-1',
      send_enabled: process.env.CAP_SEND_ENABLED === 'true',
    });
  }

  if (url.pathname === '/readiness') {
    const readiness = configuredReadiness();
    const blocked = Object.entries(readiness)
      .filter(([key, value]) => key !== 'send_gate' && !value)
      .map(([key]) => key);
    return json(res, blocked.length ? 503 : 200, {
      ready: blocked.length === 0,
      readiness,
      blocked,
      policy: 'No live send is permitted while CAP_SEND_ENABLED is not true and human approval is absent.',
    });
  }

  if (url.pathname === '/api/v1/pilot/summary') {
    const leads = readLeads();
    const byCategory = Object.fromEntries(
      [...new Set(leads.map((lead) => lead.category))].map((category) => [
        category,
        leads.filter((lead) => lead.category === category).length,
      ]),
    );
    return json(res, 200, {
      campaign: 'CAP V0.1 — Campaign 001 — Houston Website Opportunity',
      total_leads: leads.length,
      by_category: byCategory,
      send_enabled: process.env.CAP_SEND_ENABLED === 'true',
      mode: 'pilot-dry-run',
    });
  }

  return json(res, 404, { error: 'not_found' });
});

server.listen(port, '0.0.0.0', () => console.log(`CAP API listening on ${port}`));

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
