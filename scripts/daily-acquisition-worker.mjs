#!/usr/bin/env node
/**
 * DEPRECATED: the old fixture-based worker is intentionally non-executable.
 * Production acquisition runs through PostgreSQL -> SQS -> workers/sqs-worker.mjs.
 * This guard prevents the historical 100-lead / CAP_SEND_ENABLED / simulated-SES
 * path from being invoked accidentally.
 */
console.error('DEPRECATED: use `npm run worker` with CAP_SQS_QUEUE_URL and DATABASE_URL, or the production acquisition scheduler. No fixture-based sending is supported.');
process.exitCode = 1;
