import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRepository } from '../db/repository.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = createRepository();

if (!repository) {
  console.error('ERROR: DATABASE_URL environment variable is required to connect to production RDS.');
  process.exit(1);
}

console.log('Connecting to production PostgreSQL RDS to fetch captured leads...');

try {
  const leads = await repository.listLeads();
  console.log(`Successfully fetched ${leads.length} records from production RDS!`);

  const headers = ['ID', 'Business Name', 'Category', 'Location', 'Phone', 'Email', 'Website', 'Stage', 'Acquired At'];
  const rows = [headers.join(',')];

  for (const l of leads) {
    const record = l.record || l;
    const row = [
      record.id || record.uid || '',
      `"${String(record.name || record.business || '').replace(/"/g, '""')}"`,
      `"${String(record.category || '').replace(/"/g, '""')}"`,
      `"${String(record.location || '').replace(/"/g, '""')}"`,
      `"${String(record.phone || '').replace(/"/g, '""')}"`,
      `"${String(record.email || '').replace(/"/g, '""')}"`,
      `"${String(record.website || '').replace(/"/g, '""')}"`,
      `"${String(record.lifecycle_stage || record.stage || '').replace(/"/g, '""')}"`,
      `"${String(record.acquisition_date || record.discovered_at || '').replace(/"/g, '""')}"`,
    ];
    rows.push(row.join(','));
  }

  const outputPath = path.join(root, 'data', 'production-rds-leads-export.csv');
  fs.writeFileSync(outputPath, rows.join('\n') + '\n');
  console.log(`Production export complete! CSV saved to ${outputPath}`);
  await repository.close();
} catch (error) {
  console.error('Failed to fetch leads from production RDS:', error.message);
  process.exit(1);
}
