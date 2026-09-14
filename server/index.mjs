import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port=Number(process.env.PORT||8787);
const readiness={database:!!process.env.DATABASE_URL,storage:!!process.env.CAP_S3_BUCKET,queue:!!process.env.CAP_SQS_QUEUE_URL,hunter:!!process.env.HUNTER_API_KEY,openai:!!process.env.OPENAI_API_KEY,email:process.env.CAP_SEND_ENABLED==='true'&&!!process.env.SES_FROM_EMAIL};
const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/health'){res.writeHead(200);return res.end(JSON.stringify({ok:true,service:'aureum-cap-v0-1',region:process.env.AWS_REGION||'eu-north-1'}));}
  if(req.url==='/readiness'){const blocked=Object.entries(readiness).filter(([,v])=>!v).map(([k])=>k);res.writeHead(blocked.length?503:200);return res.end(JSON.stringify({ready:blocked.length===0,readiness,blocked}));}
  res.writeHead(404);res.end(JSON.stringify({error:'not_found'}));
});
server.listen(port,'0.0.0.0',()=>console.log(`CAP API listening on ${port}`));
