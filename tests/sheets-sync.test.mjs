import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HEADERS,LANES,normalize,plan,parseCSV,SheetsClient,sync } from '../scripts/sync-acquisition-to-sheets.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/acquisition.json',import.meta.url)));
const input=(changes={},lane='webdev')=>({record:{...fixture.records[0],...changes,acquisition_lane:lane},run:fixture.run,evidence:{artifact_id:1}});
class FakeSheets {
 constructor(){this.retried=0;this.data=Object.fromEntries([...LANES.map(l=>[l.toUpperCase(),[HEADERS]]),['OVERVIEW',[]]]);this.fail='';}
 async metadata(){return {sheets:Object.keys(this.data).map((title,i)=>({properties:{title,sheetId:i,gridProperties:{rowCount:100}}}))};}
 async read(range){const [tab,area]=range.split('!');const m=/([A-Z]+)(\d+):([A-Z]+)(\d+)/.exec(area);const col=s=>[...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;return this.data[tab].slice(+m[2]-1,+m[4]).map(r=>r.slice(col(m[1]),col(m[3])+1));}
 async write(range,values){const [tab,area]=range.split('!');if(tab===this.fail)throw Error('sheets_http_503');const m=/([A-Z]+)(\d+)/.exec(area);const col=[...m[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;values.forEach((r,i)=>{this.data[tab][+m[2]-1+i]||=[];r.forEach((v,j)=>this.data[tab][+m[2]-1+i][col+j]=v);});}
 async laneRows(s){return this.data[s.title].slice(1);}
 async grow(){}
}
test('deduplicates legacy/four-lane IDs using stable OSM source',()=>{
 const p=plan([input(),input({acquisition_id:'other-run-id',name:'Changed name'})]);assert.equal(p.rows.length,1);assert.equal(p.skipped.length,1);
 assert.equal(plan([input()],p.rows.map(r=>r.values)).rows.length,0);
});
test('routes all lanes and repeat sync is idempotent',async()=>{
 const c=new FakeSheets();const names={webdev:'Business',dating:'Senior center',hashnomads:'Bitcoin mining',books:'Bookstore'};
 const ins=LANES.map((l,i)=>input({acquisition_id:'a'+i,name:names[l],source_evidence:{element_type:'node',element_id:i+1}},l));
 let r=await sync(ins,c);assert.equal(r.inserted,4);for(const l of LANES)assert.equal(c.data[l.toUpperCase()][1][1],l);
 r=await sync(ins,c);assert.equal(r.inserted,0);assert.equal(r.skipped,4);assert.equal(c.data.OVERVIEW[1][1],1);
});
test('preserves original timestamps, evidence and separate outreach method without inventing completion',()=>{
 const r=normalize(input({email:'fixture@example.invalid',email_source:'https://example.invalid/evidence',outreach_method:'METHOD_B_ZOEY',outreach_status:'READY_FOR_PROVIDER'}).record,fixture.run);
 assert.equal(r.values[11],fixture.records[0].acquisition_date);assert.equal(r.values[9],'EMAIL_PRESENT');assert.equal(r.values[12],'UNKNOWN');assert.equal(r.values[14],'METHOD_B_ZOEY');assert.equal(r.values[15],'NOT_VERIFIED');
});
test('rejects historical false positives, personal-profile inputs, missing provenance and email evidence',()=>{
 for(const x of [input({name:'Happy Hours'},'dating'),input({name:'Construction mining'},'hashnomads'),input({lifecycle_stage:'REJECTED'}),input({email:'missing@example.invalid'}),input({acquisition_date:''})]) assert.equal(plan([x]).failed.length,1);
});
test('explicit manual B2B assignment retains qualification and consent distinction',()=>{
 const p=plan([input({source:'manual-client-entry',id:'manual-1',assigned_workers:['dating'],name:'Realtor',email:'test@example.invalid'},'dating')]);assert.equal(p.rows[0].values[13],'MANUAL_B2B_ASSIGNMENT');assert.equal(p.rows[0].values[12],'UNKNOWN');
});
test('bounded transient retries and terminal authorization failure',async()=>{
 let calls=0;const sleeps=[];const c=new SheetsClient('id','secret',{fetchImpl:async()=>({ok:++calls>2,status:429,headers:new Headers(),json:async()=>({values:[]})}),sleep:async ms=>sleeps.push(ms),maxRetries:3});await c.read('WEBDEV!A1:T1');assert.equal(c.retried,2);assert.equal(calls,3);assert.ok(sleeps.every(ms=>ms<=30000));
 const bad=new SheetsClient('id','secret',{fetchImpl:async()=>({ok:false,status:403}),sleep:async()=>{},maxRetries:3});await assert.rejects(bad.read('A1:B2'),/sheets_http_403/);assert.equal(bad.retried,0);
 const down=new SheetsClient('id','secret',{fetchImpl:async()=>({ok:false,status:503,headers:new Headers()}),sleep:async()=>{},maxRetries:2});await assert.rejects(down.read('A1:B2'),/retry_exhausted/);assert.equal(down.retried,2);
});
test('lost write response retries the same fixed range without duplicate append',async()=>{
 let calls=0;const urls=[];const c=new SheetsClient('id','secret',{fetchImpl:async(url,opt)=>{urls.push([url,opt.method,opt.body]);if(++calls===1)throw Error('response_lost');return {ok:true,json:async()=>({})};},sleep:async()=>{}});await c.write('WEBDEV!A2:T2',[normalize(input().record).values]);assert.deepEqual(urls[0],urls[1]);assert.equal(urls[0][1],'PUT');
});
test('lane failure reports failure while other lanes continue',async()=>{
 const c=new FakeSheets();c.fail='WEBDEV';const r=await sync([input(),input({name:'Bookstore',acquisition_id:'book'},'books')],c);assert.equal(r.status,'FAILED');assert.equal(r.lanes.webdev.status,'FAILED');assert.equal(r.lanes.books.inserted,1);assert.equal(r.failed,1);
});
test('CSV quotes, multiline and literal formulas remain plain strings',()=>{
 const rows=parseCSV('name,email\n"=IMPORTXML(\"\"x\"\")",""\n"A\nB","a@example.invalid"');assert.equal(rows[1].name,'A\nB');assert.ok(rows[0].name.startsWith('='));
});
test('acquisition workflows have no downstream auth or Sheets dependencies',()=>{
 for(const file of ['cap-four-lane-acquisition.yml','cap-autonomous-acquisition.yml']){const s=fs.readFileSync(new URL('../.github/workflows/'+file,import.meta.url),'utf8');assert.doesNotMatch(s,/id-token|google-github-actions|SheetsClient|needs:/);}
 const s=fs.readFileSync(new URL('../.github/workflows/cap-four-lane-acquisition.yml',import.meta.url),'utf8');assert.match(s,/17 \*\/6 \* \* \*/);
});
test('geographic names and website paths cannot qualify unrelated audience organizations',()=>{
 const r=input({name:'JINYA Ramen Bar',category:'restaurant',location:'College Station',website:'https://example.invalid/university'},'books');assert.equal(plan([r]).failed[0].reason,'historical_lane_mismatch');
 const privateProfile=input({source:'private-dating-profile',name:'Senior center'},'dating');assert.equal(plan([privateProfile]).failed[0].reason,'unsupported_source');
});
test('later public email evidence upgrades duplicates while retaining first acquisition date',async()=>{
 const later=input({acquisition_id:'later-id',acquisition_date:'2026-10-09T00:00:00Z',email:'fixture@example.invalid',email_source:'https://openstreetmap.org/node/123'});
 const p=plan([input(),later]);assert.equal(p.rows.length,1);assert.equal(p.rows[0].values[7],later.record.email);assert.equal(p.rows[0].values[11],fixture.records[0].acquisition_date);
 const c=new FakeSheets();await sync([input()],c);const r=await sync([later],c);assert.equal(r.updated,1);assert.equal(r.inserted,0);assert.equal(c.data.WEBDEV[1][11],fixture.records[0].acquisition_date);assert.equal((await sync([later],c)).updated,0);
});
test('books excludes themed hospitality and hair salons but retains educational institutions',()=>{
 for(const [name,category] of [['The Library','bar'],['Old School Burger','fast_food'],['Therapy Hair Studio','hairdresser']]) assert.equal(plan([input({name,category},'books')]).rows.length,0);
 assert.equal(plan([input({name:'Regency Beauty Institute',category:'college'},'books')]).rows.length,1);
});
test('specialized source queries acquire relevant organizations directly',async()=>{
 const {buildQuery}=await import('../scripts/discovery-overpass.mjs');assert.match(buildQuery('0,0,1,1','books'),/library/);assert.match(buildQuery('0,0,1,1','dating'),/community_centre:for/);assert.match(buildQuery('0,0,1,1','hashnomads'),/bitcoin/);assert.match(buildQuery('0,0,1,1','webdev'),/restaurant/);
});
