#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { qualifies } from './acquisition-qualification.mjs';
export { qualifies } from './acquisition-qualification.mjs';

export const LANES = ['webdev', 'dating', 'hashnomads', 'books'];
export const HEADERS = ['acquisition_id','lane','name','category','location','website','phone','email','email_source','email_completion_status','source','acquisition_date','consent_status','qualification_status','outreach_method','outreach_status','source_id','source_evidence','lifecycle_stage','sync_evidence'];
const hash = x => createHash('sha256').update(x).digest('hex');
const text = x => String(x ?? '');
export function sourceId(r) {
  const e = r.source_evidence;
  if (e?.element_type && e.element_id) return `osm:${e.element_type}:${e.element_id}`;
  if (r.source_id) return text(r.source_id);
  if (r.source === 'manual-client-entry' && r.id) return `manual:${r.id}`;
  // CSV exports lack OSM evidence; retain an exact business/location fingerprint.
  return 'business:' + hash(JSON.stringify([r.source,r.name,r.location,r.website,r.phone].map(x=>text(x).trim().toLowerCase())));
}
export function normalize(r, run = {}, evidence = {}) {
  const lane = r.acquisition_lane || r.lane || run.lane || 'webdev';
  if (!LANES.includes(lane)) throw Error('invalid_lane');
  if (!['openstreetmap-overpass','manual-client-entry'].includes(r.source)) throw Error('unsupported_source');
  if (!r.acquisition_id || !r.acquisition_date || !r.source || !r.name) throw Error('missing_acquisition_provenance');
  if (!Number.isFinite(Date.parse(r.acquisition_date))) throw Error('invalid_timestamp');
  if (r.lifecycle_stage && r.lifecycle_stage !== 'ACQUIRED') throw Error('non_acquired_record');
  if (r.rejected || /REJECTED|INELIGIBLE/i.test(text(r.qualification_status))) throw Error('rejected_record');
  if (!qualifies(r,lane)) throw Error('historical_lane_mismatch');
  const manual = r.source === 'manual-client-entry';
  const emailSource = text(r.email_source || (manual && r.email ? 'manual-client-entry' : ''));
  if (r.email && !emailSource) throw Error('missing_email_evidence');
  const qualification = r.qualification_status || (manual ? 'MANUAL_B2B_ASSIGNMENT' : lane === 'webdev' ? 'RAW_BUSINESS' : 'AUDIENCE_ORGANIZATION_MATCH');
  const sid = sourceId(r);
  const vals = [r.acquisition_id,lane,r.name,r.category,r.location,r.website,r.phone,r.email,emailSource,r.email?'EMAIL_PRESENT':'EMAIL_DISCOVERY_REQUIRED',r.source,r.acquisition_date,r.consent_status || 'UNKNOWN',qualification,r.outreach_method || 'UNASSIGNED','NOT_VERIFIED',sid,JSON.stringify(r.source_evidence || {}),'ACQUIRED',JSON.stringify({ ...evidence,run_id:run.run_id,qualification_rule:'2026-10-09',original_qualification_status:r.qualification_status || null,original_outreach_status:r.outreach_status || null })].map(text);
  if (vals.some(x=>x.length>49000)) throw Error('cell_too_large');
  return { lane, id:r.acquisition_id, sid, values:vals };
}
export function parseCSV(input) {
  const rows = []; let row=[], value='', quoted=false;
  for(let i=0;i<input.length;i++) { const c=input[i];
    if(c==='"') { if(quoted && input[i+1]==='"'){value+='"';i++;} else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(value);value='';}
    else if(c==='\n'&&!quoted){row.push(value.replace(/\r$/,''));rows.push(row);row=[];value='';}
    else value+=c;
  }
  if(quoted) throw Error('invalid_csv');
  if(value||row.length){row.push(value.replace(/\r$/,''));rows.push(row);}
  const headers=rows.shift() || [];
  return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i] || ''])));
}
export function loadInputs(dir) {
  const result=[];
  function walk(folder) { for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const p=path.join(folder,entry.name);
    if(entry.isDirectory()) walk(p);
    else if(/^leads-.*\.json$/.test(entry.name)) {
      const data=JSON.parse(fs.readFileSync(p,'utf8'));
      if(!Array.isArray(data.records) || !data.run) throw Error('invalid_acquisition_json');
      let evidence={file:path.relative(dir,p),sha256:hash(fs.readFileSync(p))};
      const manifest=path.join(folder,'manifest.json');
      if(fs.existsSync(manifest)) evidence={...evidence,...JSON.parse(fs.readFileSync(manifest,'utf8'))};
      result.push(...data.records.map(r=>({record:r,run:data.run,evidence})));
    } else if(/^leads-.*\.csv$/.test(entry.name) && !fs.existsSync(p.replace(/\.csv$/,'.json'))) {
      result.push(...parseCSV(fs.readFileSync(p,'utf8')).map(record=>({record,run:{},evidence:{file:path.relative(dir,p),sha256:hash(fs.readFileSync(p))}})));
    }
  }}
  walk(dir);
  return result.sort((a,b)=>text(a.record.acquisition_date).localeCompare(text(b.record.acquisition_date)));
}
export function plan(inputs, existing=[]) {
  const ids=new Map(), sources=new Map(), legacy=new Set(), updates=new Map();
  existing.forEach((row,i)=>{
    if(!row?.[0]) return;
    const entry={values:[...row],rowNumber:i+2,existing:true};
    ids.set(text(row[0]),entry);
    if(row[16]) sources.set(text(row[16]),entry);
    else legacy.add(JSON.stringify([row[10],row[2],row[4],row[5],row[6]].map(x=>text(x).trim().toLowerCase())));
  });
  const rows=[], skipped=[], failed=[];
  for(const input of inputs) {
    try { const r=normalize(input.record,input.run,input.evidence);
      const fallback=JSON.stringify([r.values[10],r.values[2],r.values[4],r.values[5],r.values[6]].map(x=>text(x).trim().toLowerCase()));
      const duplicate=sources.get(r.sid) || ids.get(r.id);
      if(duplicate || legacy.has(fallback)) {
        // Upgrade only an absent email from an exact stable-identity match.
        // Leave first acquisition metadata and all human qualification/consent fields intact.
        if(duplicate && !duplicate.values[7] && r.values[7]) {
          duplicate.values[7]=r.values[7];duplicate.values[8]=r.values[8];duplicate.values[9]='EMAIL_PRESENT';
          let evidence={};try{evidence=JSON.parse(duplicate.values[19]||'{}');}catch{}
          duplicate.values[19]=JSON.stringify({...evidence,email_observation:JSON.parse(r.values[19])});
          if(duplicate.existing) updates.set(duplicate.rowNumber,duplicate);
        }
        skipped.push({id:r.id,reason:'duplicate'});continue;
      }
      ids.set(r.id,r);sources.set(r.sid,r);rows.push(r);
    } catch(e) { failed.push({id:input.record.acquisition_id || null,reason:e.message}); }
  }
  return {rows,updates:[...updates.values()],skipped,failed};
}
export class SheetsClient {
  constructor(id, token, {fetchImpl=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),maxRetries=7}={}) {
    this.base=`https://sheets.googleapis.com/v4/spreadsheets/${id}`;this.token=token;this.fetch=fetchImpl;this.sleep=sleep;this.maxRetries=maxRetries;this.retried=0;
  }
  async request(suffix, method='GET', body) {
    for(let n=0;;n++) {
      let res;
      try { res=await this.fetch(this.base+suffix,{method,headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)}); }
      catch { if(n===this.maxRetries) throw Error('sheets_transport_retry_exhausted'); }
      if(res?.ok) return res.json();
      if(res && ![429,500,502,503,504].includes(res.status)) throw Error(`sheets_http_${res.status}`);
      if(n===this.maxRetries) throw Error(`sheets_retry_exhausted_${res?.status || 'network'}`);
      this.retried++;
      const retryAfter=Number(res?.headers?.get('retry-after') || 0)*1000;
      await this.sleep(Math.min(30000,Math.max(retryAfter,500*2**n)+Math.floor(Math.random()*250)));
    }
  }
  async read(range) { return (await this.request('/values/'+encodeURIComponent(range)+'?valueRenderOption=UNFORMATTED_VALUE')).values || []; }
  async write(range,values) { return this.request('/values/'+encodeURIComponent(range)+'?valueInputOption=RAW','PUT',{range,majorDimension:'ROWS',values}); }
  async metadata() {return this.request('?fields=sheets.properties');}
  async grow(sheet, rows) {
    if(rows <= sheet.gridProperties.rowCount) return;
    // Absolute assignment makes retries idempotent, unlike appendDimension.
    await this.request(':batchUpdate','POST',{requests:[{updateSheetProperties:{properties:{sheetId:sheet.sheetId,gridProperties:{rowCount:rows+1000}},fields:'gridProperties.rowCount'}}]});
    sheet.gridProperties.rowCount=rows+1000;
  }
  async laneRows(sheet) {
    const rows=[];
    // Ten bounded ranges per request keep full-grid audits below Sheets quotas.
    for(let base=2;base<=sheet.gridProperties.rowCount;base+=10000) {
      const ranges=[];
      for(let start=base;start<=sheet.gridProperties.rowCount && start<base+10000;start+=1000) {
        ranges.push(`${sheet.title}!A${start}:T${Math.min(sheet.gridProperties.rowCount,start+999)}`);
      }
      const query=new URLSearchParams({valueRenderOption:'UNFORMATTED_VALUE'});
      for(const range of ranges) query.append('ranges',range);
      const result=await this.request('/values:batchGet?'+query);
      if(result.valueRanges?.length!==ranges.length) throw Error('incomplete_readback');
      for(let chunk=0;chunk<ranges.length;chunk++) {
        const part=result.valueRanges[chunk].values || [];
        for(let i=0;i<part.length;i++) rows[base-2+chunk*1000+i]=part[i];
      }
    }
    return rows;
  }
}
export async function sync(inputs, client, report={}) {
  report.attempted=inputs.length;report.inserted=0;report.updated=0;report.skipped=0;report.failed=0;report.lanes={};report.errors=[];
  const metadata=await client.metadata();
  const sheets=new Map(metadata.sheets.map(s=>[s.properties.title,s.properties]));
  for(const lane of LANES) {
    const laneInputs=inputs.filter(x=>(x.record.acquisition_lane||x.record.lane||x.run.lane||'webdev')===lane);
    const stat=report.lanes[lane]={attempted:laneInputs.length,inserted:0,updated:0,skipped:0,failed:0};
    try {
      const sheet=sheets.get(lane.toUpperCase());if(!sheet) throw Error('missing_tab');
      const header=(await client.read(`${sheet.title}!A1:T1`))[0] || [];
      if(!HEADERS.slice(0,16).every((h,i)=>header[i]===h) || header.slice(16).some((h,i)=>h && h!==HEADERS[16+i])) throw Error('unexpected_headers');
      await client.write(`${sheet.title}!Q1:T1`,[HEADERS.slice(16)]);
      const existing=await client.laneRows(sheet);
      const p=plan(laneInputs,existing);
      stat.skipped=p.skipped.length;stat.failed=p.failed.length;report.errors.push(...p.failed.map(e=>({...e,lane})));
      for(const update of p.updates) {
        const row=update.rowNumber;
        if((await client.read(`${sheet.title}!A${row}:A${row}`))[0]?.[0]!==update.values[0]) throw Error('destination_changed');
        await client.write(`${sheet.title}!H${row}:J${row}`,[update.values.slice(7,10)]);
        await client.write(`${sheet.title}!T${row}:T${row}`,[[update.values[19]]]);
        if((await client.read(`${sheet.title}!H${row}:J${row}`))[0]?.[0]!==update.values[7]) throw Error('readback_mismatch');
        stat.updated++;
      }
      let start=existing.length+2;
      for(let i=0;i<p.rows.length;i+=200) {
        const chunk=p.rows.slice(i,i+200);const end=start+chunk.length-1;
        await client.grow(sheet,end);
        const range=`${sheet.title}!A${start}:T${end}`;
        if((await client.read(range)).some(r=>r.some(v=>v!==''))) throw Error('destination_changed');
        // Fixed-position RAW update is an append without ambiguous append retries.
        await client.write(range,chunk.map(r=>r.values));
        const verified=await client.read(range);
        if(!chunk.every((r,j)=>verified[j]?.[0]===r.id && verified[j]?.[16]===r.sid)) throw Error('readback_mismatch');
        stat.inserted+=chunk.length;start=end+1;
      }
      const readback=await client.laneRows(sheet);
      stat.total=readback.filter(r=>r?.[0]).length;
      stat.email_present=readback.filter(r=>r?.[9]==='EMAIL_PRESENT').length;
      stat.unique=new Set(readback.filter(r=>r?.[0]).map(r=>r[16]||r[0])).size;
      stat.status=stat.failed?'PARTIAL_REJECTED_INPUTS':'VERIFIED';
    } catch(e) { stat.failed=Math.max(stat.failed,stat.attempted-stat.inserted-stat.skipped);stat.status='FAILED';report.errors.push({lane,reason:e.message}); }
    report.inserted+=stat.inserted;report.updated+=stat.updated;report.skipped+=stat.skipped;report.failed+=stat.failed;
  }
  const unknown=inputs.filter(x=>!LANES.includes(x.record.acquisition_lane||x.record.lane||x.run.lane||'webdev'));
  report.failed+=unknown.length;report.errors.push(...unknown.map(x=>({id:x.record.acquisition_id,reason:'invalid_lane'})));
  report.retried=client.retried;report.finished_at=new Date().toISOString();
  report.status=report.errors.some(e=>!['historical_lane_mismatch','rejected_record'].includes(e.reason))?'FAILED':report.failed?'VERIFIED_WITH_EXCLUSIONS':'VERIFIED';
  const overview=[['lane','verified_rows','unique_sources','email_present','email_discovery_required','sync_status','last_sync_utc','inserted_this_sync','skipped_this_sync','excluded_or_failed','retries_total'],...LANES.map(l=>{const s=report.lanes[l];return [l,s.total??'',s.unique??'',s.email_present??'',s.total===undefined?'':s.total-s.email_present,s.status,report.finished_at,s.inserted,s.skipped,s.failed,report.retried];}),['production_auth',process.env.GITHUB_ACTIONS==='true'?'WIF_JOB_EXECUTED':'LOCAL_OR_CONNECTOR_BACKFILL'],['run_url',process.env.GITHUB_RUN_ID?`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:''],['outreach','Acquisition is not consent or outreach completion; no messages sent.']];
  await client.write('OVERVIEW!A1:K8',overview);
  return report;
}
async function main() {
  const out=process.env.CAP_SYNC_REPORT || 'sync-report.json';const report={started_at:new Date().toISOString()};
  try {
    const inputs=loadInputs(process.env.CAP_SYNC_INPUT_DIR || 'acquisition-output');
    if(process.argv.includes('--dry-run')) {
      report.attempted=inputs.length;report.lanes={};
      for(const l of LANES) {const p=plan(inputs.filter(x=>(x.record.acquisition_lane||x.run.lane||'webdev')===l));report.lanes[l]={insertable:p.rows.length,skipped:p.skipped.length,excluded:p.failed.length,errors:p.failed};}
      report.status='DRY_RUN';
    } else {
      if(!process.env.GOOGLE_ACCESS_TOKEN || !process.env.CAP_SHEETS_ID) throw Error('missing_auth_configuration');
      await sync(inputs,new SheetsClient(process.env.CAP_SHEETS_ID,process.env.GOOGLE_ACCESS_TOKEN),report);
      if(report.status==='FAILED') process.exitCode=1;
    }
  } catch(e) {report.status='FAILED';report.error=e.message;process.exitCode=1;}
  finally {report.finished_at=new Date().toISOString();fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,attempted:report.attempted,inserted:report.inserted,skipped:report.skipped,failed:report.failed,retried:report.retried,report:out}));}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main();
