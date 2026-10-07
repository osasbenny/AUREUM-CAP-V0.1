#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { discoverOverpass } from './discovery-overpass.mjs';
import { normalizeDomain, normalizeEmail, normalizePhone, normalizeKey } from '../server/services.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lane=(process.env.CAP_ACQUISITION_LANE||'webdev').toLowerCase();
const stateDir=process.env.CAP_ACQUISITION_STATE_DIR||path.join(root,'.cap-state',lane);
const outDir=process.env.CAP_ACQUISITION_OUTPUT_DIR||path.join(root,'acquisition-output',lane);
const target=Math.max(1,Number(process.env.CAP_ACQUISITION_BATCH_TARGET||250));
const rawLimit=Math.max(target,Number(process.env.CAP_DISCOVERY_RAW_LIMIT||target*8));
fs.mkdirSync(stateDir,{recursive:true}); fs.mkdirSync(outDir,{recursive:true});
const statePath=path.join(stateDir,'dedupe.json'); let state={keys:{},runs:[]};
try{state=JSON.parse(fs.readFileSync(statePath,'utf8'));}catch{} state.keys||={}; state.runs||=[];

const laneMatch=(r)=>{
 const s=[r.name,r.category,r.website,r.location].filter(Boolean).join(' ').toLowerCase();
 if(lane==='webdev') return true;
 if(lane==='hashnomads') return /(bitcoin|crypto|blockchain|mining|miner|asic|investment|trading|financial|fintech|computer|electronics|data center|hosting)/.test(s);
 if(lane==='books') return /(book|library|education|school|college|university|child|kids|family|parent|psychology|therapy|coach|business|entrepreneur|technology|computer|ai|art|stationery)/.test(s);
 // Dating lane deliberately acquires opt-in/audience-source organizations, never private dating profiles.
 if(lane==='dating') return /(senior|retirement|community|social club|community centre|community center|adult education|library|recreation|event|association)/.test(s);
 return false;
};
const identity=(r)=>[
 normalizeDomain(r.website||r.domain)&&'domain:'+normalizeDomain(r.website||r.domain),
 normalizeEmail(r.email)&&'email:'+normalizeEmail(r.email),
 normalizePhone(r.phone)&&'phone:'+normalizePhone(r.phone),
 (normalizeKey(r.name||r.business)||normalizeKey(r.location||r.address))&&'company:'+normalizeKey(r.name||r.business)+'|'+normalizeKey(r.location||r.address),
 r.source_evidence?.element_type&&r.source_evidence?.element_id&&'source:'+r.source_evidence.element_type+':'+r.source_evidence.element_id
].filter(Boolean);

const discovered=await discoverOverpass({limit:rawLimit}); const candidates=discovered.filter(laneMatch);
const accepted=[]; let duplicates=0; const now=new Date().toISOString();
for(const r of candidates){const ids=identity(r); if(!ids.length)continue; if(ids.some(k=>state.keys[k])){duplicates++;continue;}
 const acquisition_id='acq-'+createHash('sha256').update(lane+'|'+ids.join('|')).digest('hex').slice(0,24);
 const lead={...r,acquisition_id,acquisition_lane:lane,acquisition_date:now,lifecycle_stage:'ACQUIRED',email_completion_status:r.email?'EMAIL_PRESENT':'EMAIL_DISCOVERY_REQUIRED'};
 accepted.push(lead); for(const k of ids)state.keys[k]={acquisition_id,first_seen:now}; if(accepted.length>=target)break;}
const run={run_id:'run-'+lane+'-'+now.replace(/[:.]/g,'-'),lane,started_at:now,source:'openstreetmap-overpass',discovered:discovered.length,lane_candidates:candidates.length,duplicates_rejected:duplicates,net_new_persisted:accepted.length,email_present_at_acquisition:accepted.filter(x=>x.email).length,email_discovery_required:accepted.filter(x=>!x.email).length,target,shortfall:Math.max(0,target-accepted.length)};
state.runs.push(run); state.runs=state.runs.slice(-200); fs.writeFileSync(statePath,JSON.stringify(state,null,2));
const stamp=now.slice(0,10)+'T'+now.slice(11,19).replace(/:/g,''); const fields=['acquisition_id','acquisition_lane','name','category','location','website','phone','email','email_completion_status','source','acquisition_date'];
const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(outDir,`leads-${stamp}.json`),JSON.stringify({run,records:accepted},null,2));
fs.writeFileSync(path.join(outDir,`leads-${stamp}.csv`),[fields.join(','),...accepted.map(r=>fields.map(f=>esc(r[f])).join(','))].join('\n'));
fs.writeFileSync(path.join(outDir,'latest-run.json'),JSON.stringify(run,null,2)); console.log(JSON.stringify(run,null,2));
// Raw persistence is independent. Email completion is downstream and may never block acquisition.
