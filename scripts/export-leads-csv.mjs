import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leadsPath = path.join(root, 'data', 'leads.json');
const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));

console.log(`Exporting ${leads.length} leads to CSV for Google Sheets...`);

const headers = ['ID', 'Business Name', 'Category', 'Location', 'Phone', 'Email', 'Website', 'Website Status', 'Email Status', 'Stage'];
const rows = [headers.join(',')];

for (const l of leads) {
  const row = [
    l.id || l.uid || '',
    `"${String(l.name || '').replace(/"/g, '""')}"`,
    `"${String(l.category || '').replace(/"/g, '""')}"`,
    `"${String(l.location || '').replace(/"/g, '""')}"`,
    `"${String(l.phone || '').replace(/"/g, '""')}"`,
    `"${String(l.email || '').replace(/"/g, '""')}"`,
    `"${String(l.website || '').replace(/"/g, '""')}"`,
    `"${String(l.website_status || l.websiteStatus || '').replace(/"/g, '""')}"`,
    `"${String(l.emailStatus || '').replace(/"/g, '""')}"`,
    `"${String(l.lifecycle_stage || l.stage || '').replace(/"/g, '""')}"`,
  ];
  rows.push(row.join(','));
}

const outputPath = path.join(root, 'data', 'all-682-leads-export.csv');
fs.writeFileSync(outputPath, rows.join('\n') + '\n');
console.log(`Export complete! CSV saved to ${outputPath}`);
