import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreLead, matchProducts, fallbackMessage, normalizeKey } from '../server/services.mjs';
import { routeSms, smsOpener } from '../server/sms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rfiPath = 'C:/Users/Lenovo/Downloads/requests-for-information.csv';
const bizPath = 'C:/Users/Lenovo/Downloads/businesses.csv';
const leadsPath = path.join(root, 'data', 'leads.json');

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === header.length) {
      const obj = {};
      header.forEach((h, idx) => obj[h] = values[idx]);
      rows.push(obj);
    }
  }
  return rows;
}

function parseCSVLine(text) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(s => s.replace(/^"|"$/g, ''));
}

const rfiContent = fs.readFileSync(rfiPath, 'utf8');
const bizContent = fs.readFileSync(bizPath, 'utf8');

const rfiRows = parseCSV(rfiContent);
const bizRows = parseCSV(bizContent);

console.log(`Parsed RFI rows: ${rfiRows.length}`);
console.log(`Parsed Business rows: ${bizRows.length}`);

// Load original 100 leads to preserve their structure
const originalLeads = JSON.parse(fs.readFileSync(leadsPath, 'utf8')).slice(0, 100);

let nextId = 101;
const allNewLeads = [];

// Process RFI rows
for (const row of rfiRows) {
  allNewLeads.push({
    id: nextId++,
    name: row.company || 'Unknown Company',
    category: 'Website Design / Redesign',
    location: row.location || 'Unknown Location',
    phone: row.phone || '',
    email: row.email || null,
    website: row.website || null,
    websiteStatus: 'Unverified',
    emailStatus: row.email ? 'Supplied' : 'Not supplied',
    score: null,
    stage: 'RFI_INBOUND',
    request_type: 'website design/redesign'
  });
}

// Process Business rows
for (const row of bizRows) {
  allNewLeads.push({
    id: nextId++,
    name: row.company || 'Unknown Company',
    category: row.type || 'Business',
    location: row.location || 'Unknown Location',
    phone: row.phone || '',
    email: row.email || null,
    website: row.website || null,
    websiteStatus: 'Unverified',
    emailStatus: row.email ? 'Supplied' : 'Not supplied',
    score: null,
    stage: row.status || 'IMPORTED',
    status: row.status || 'IMPORTED'
  });
}

const combined = [...originalLeads, ...allNewLeads];
fs.writeFileSync(leadsPath, JSON.stringify(combined, null, 2) + '\n');
console.log(`Successfully imported all leads. Total leads in repository: ${combined.length}`);
