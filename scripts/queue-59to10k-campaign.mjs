#!/usr/bin/env node
/** Deprecated legacy campaign guard. Production outreach is campaign-scoped, PostgreSQL-reserved, SQS-backed, and SES-accepted only. */
console.error('DEPRECATED: the 59to10k campaign queue is retired and cannot create jobs. Use the controlled CAP campaign queue endpoint.');
process.exitCode = 1;
