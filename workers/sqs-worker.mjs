import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, ChangeMessageVisibilityCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import { createRepository } from '../db/repository.mjs';
import { sendTwilioSms, sendTermiiSms } from '../server/sms.mjs';

const queueUrl = process.env.CAP_SQS_QUEUE_URL;
const dlqUrl = process.env.CAP_SQS_DLQ_URL;
const repository = createRepository();
if (!queueUrl) throw new Error('CAP_SQS_QUEUE_URL is required');
if (!repository) throw new Error('DATABASE_URL is required');
const sqs = new SQSClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const maxAttempts = Number(process.env.CAP_WORKER_MAX_ATTEMPTS || 3);

async function processMessage(message) {
  const job = JSON.parse(message.Body);
  if (job.type !== 'SMS_SEND') return;
  if (process.env.CAP_SMS_SEND_ENABLED !== 'true') throw new Error('CAP_SMS_SEND_ENABLED is false');
  const result = job.provider === 'twilio' ? await sendTwilioSms({ to: job.to, body: job.body, statusCallback: process.env.SMS_STATUS_CALLBACK_URL }) : await sendTermiiSms({ to: job.to, body: job.body, statusCallback: process.env.SMS_STATUS_CALLBACK_URL });
  await repository.saveEvent({ type: 'sms.provider.accepted', entity_type: 'lead', entity_id: null, payload: { lead_id: job.lead_id, provider: result.provider, provider_id: result.provider_id, status: result.status } });
}

async function runOnce() {
  const response = await sqs.send(new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: 20, VisibilityTimeout: 60, AttributeNames: ['ApproximateReceiveCount'] }));
  for (const message of response.Messages || []) {
    const attempts = Number(message.Attributes?.ApproximateReceiveCount || 1);
    try { await processMessage(message); await sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle })); }
    catch (error) {
      console.error('JOB_FAILED', JSON.stringify({ error: error.message, attempts, message_id: message.MessageId }));
      if (attempts >= maxAttempts && dlqUrl) { await sqs.send(new SendMessageCommand({ QueueUrl: dlqUrl, MessageBody: message.Body })); await sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle })); }
      else await sqs.send(new ChangeMessageVisibilityCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle, VisibilityTimeout: Math.min(900, 2 ** attempts * 30) }));
    }
  }
}

console.log('CAP SQS worker started');
while (true) await runOnce();
