#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { discoverOverpass } from './discovery-overpass.mjs';
import { normalizeDomain, normalizeEmail, normalizePhone, normalizeKey } from '../server/services.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = process.env.CAP_ACQUISITION_STATE_DIR || path.join(root, '.cap-state');
const outDir = process.env.CAP_ACQUISITION_OUTPUT_DIR || path.join(root, 'acquisition-output');
const target = Math.max(1, Number(process.env.CAP_ACQUISITION_BATCH_TARGET || 250));
const rawLimit = Math.max(target, Number(process.env.CAP_DISCOVERY_RAW_LIMIT || target * 8));
fs.mkdirSync(stateDir,{recursive:true}); fs.mkdirSync(outDir,{recursive:true});

const statePath=path.join(stateDir,'dedupe.json');
let state={keys:{},runs:[]};
try{state=JSON.parse(fs.readFileSync(statePath,'utf8'));}catch{}
state.keys ||= {}; state.runs ||= [];

const identity=(r)=>{
 const vals=[
  normalizeDomain(r.website||r.domain)&&'domain:'+normalizeDomain(r.website||r.domain),
  normalizeEmail(r.email)&&'email:'+normalizeEmail(r.email),
  normalizePhone(r.phone)&&'phone:'+normalizePhone(r.phone),
  (normalizeKey(r.name||r.business)||normalizeKey(r.location||r.address)) &&
    'company:'+normalizeKey(r.name||r.business)+'|'+normalizeKey(r.location||r.address),
  r.source_evidence?.element_type&&r.source_evidence?.element_id &&
    'source:'+r.source_evidence.element_type+':'+r.source_evidence.element_id
 ].filter(Boolean);
 return vals;
};
const discovered=await discoverOverpass({limit:rawLimit});
const accepted=[]; let duplicates=0; const now=new Date().toISOString();
for(const r of discovered){
 const ids=identity(r);
 if(!ids.length) continue;
 if(ids.some(k=>state.keys[k])){duplicates++;continue;}
 const acquisition_id='acq-'+createHash('sha256').update(ids.join('|')).digest('hex').slice(0,24);
 const lead={...r,acquisition_id,acquisition_date:now,lifecycle_stage:'ACQUIRED'};
 accepted.push(lead);
 for(const k of ids) state.keys[k]={acquisition_id,first_seen:now};
 if(accepted.length>=target) break;
}
const run={run_id:'run-'+now.replace(/[:.]/g,'-'),started_at:now,source:'openstreetmap-overpass',discovered:discovered.length,duplicates_rejected:duplicates,net_new_persisted:accepted.length,target,shortfall:Math.max(0,target-accepted.length)};
state.runs.push(run); state.runs=state.runs.slice(-200);
fs.writeFileSync(statePath,JSON.stringify(state,null,2));

const stamp=now.slice(0,10)+'T'+now.slice(11,19).replace(/:/g,'');
const jsonPath=path.join(outDir,`leads-${stamp}.json`);
const csvPath=path.join(outDir,`leads-${stamp}.csv`);
fs.writeFileSync(jsonPath,JSON.stringify({run,records:accepted},null,2));
const fields=['acquisition_id','name','category','location','website','phone','source','acquisition_date'];
const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';
fs.writeFileSync(csvPath,[fields.join(','),...accepted.map(r=>fields.map(f=>esc(r[f])).join(','))].join('\n'));
fs.writeFileSync(path.join(outDir,'latest-run.json'),JSON.stringify(run,null,2));
console.log(JSON.stringify(run,null,2));
// A shortfall is evidence, not a process failure. Never kill the worker merely because a source yielded < target.
