import './style.css'

const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.cactusdigitalmedia.ng').replace(/\/$/, '')

const state = {
  user: null,
  view: 'overview',
  dashboard: {},
  readiness: null,
  leads: [],
  queue: [],
  campaigns: [],
  revenue: [],
  selected: new Set(),
  search: '',
  stage: 'ALL',
  presence: 'ALL',
  page: 1,
  pageSize: 30,
  busy: false,
  notice: null,
  drawerLead: null,
  refreshedAt: null,
}

const app = document.querySelector('#app')

const esc = (v='') => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
const fmt = n => Number(n || 0).toLocaleString()
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0))
const when = v => v ? new Date(v).toLocaleString() : '—'
const uid = l => l.uid || l.id
const stageOf = l => l.lifecycle_stage || l.stage || 'IMPORTED'
const presenceOf = l => l.internet_presence || l.website_presence || l.website_status || (l.website ? 'WEBSITE' : 'NO_WEB_PRESENCE')
const highIntent = l => Boolean(l.high_intent || l.requested_information || l.rfi || /REQUEST|INTEREST|RFI/i.test(stageOf(l)))

async function api(path, opts={}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: {'Content-Type':'application/json', ...(opts.headers||{})},
    ...opts,
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
  })
  let payload = null
  try { payload = await res.json() } catch { payload = {} }
  if (!res.ok) {
    const err = new Error(payload?.message || payload?.error || `HTTP ${res.status}`)
    err.status = res.status
    err.payload = payload
    throw err
  }
  return payload
}

async function bootstrap() {
  try {
    const me = await api('/api/v1/auth/me')
    state.user = me.user
    await refreshAll()
  } catch (e) {
    if (e.status !== 401) state.notice = {type:'error', text:`API: ${e.message}`}
  }
  render()
}

async function refreshAll() {
  if (!state.user) return
  state.busy = true; render()
  const results = await Promise.allSettled([
    api('/api/v1/dashboard'), api('/readiness'), api('/api/v1/leads'), api('/api/v1/queue'),
    api('/api/v1/campaigns'), api('/api/v1/revenue')
  ])
  const [dash, ready, leads, queue, campaigns, revenue] = results
  if (dash.status === 'fulfilled') state.dashboard = dash.value || {}
  if (ready.status === 'fulfilled') state.readiness = ready.value
  else if (ready.reason?.payload) state.readiness = ready.reason.payload
  if (leads.status === 'fulfilled') state.leads = leads.value.data || []
  if (queue.status === 'fulfilled') state.queue = queue.value.data || []
  if (campaigns.status === 'fulfilled') state.campaigns = campaigns.value.data || []
  if (revenue.status === 'fulfilled') state.revenue = revenue.value.data || []
  const failed = results.filter(r => r.status === 'rejected' && r.reason?.status !== 503)
  if (failed.length) state.notice = {type:'error',text:`${failed.length} live data request${failed.length>1?'s':''} failed. Refresh to retry.`}
  state.refreshedAt = new Date(); state.busy = false; render()
}

function loginView() {
  return `<div class="login-shell"><form class="login-card" id="loginForm">
    <div class="brand-mark">A</div><div class="eyebrow">AUREUM CAP V0.1</div><h1>Command Center</h1>
    <p>Internal client-acquisition operations console.</p>
    <label>Email<input name="email" type="email" autocomplete="username" required></label>
    <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
    <button class="btn primary wide" type="submit">Sign in</button>
    ${state.notice ? `<div class="notice ${state.notice.type}">${esc(state.notice.text)}</div>`:''}
  </form></div>`
}

const nav = [
  ['overview','Overview','◫'],['prospects','Prospects','◎'],['intent','High Intent','◆'],['acquisition','Acquisition','↗'],
  ['outreach','Outreach','✉'],['pipeline','Pipeline','⌁'],['jobs','Jobs','⚙'],['providers','Providers','◉'],
  ['analytics','Analytics','▥'],['settings','Settings','⚙']
]

function shell() {
  return `<div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark small">A</div><div><b>AUREUM</b><span>CAP V0.1</span></div></div>
      <nav>${nav.map(([id,label,icon])=>`<button data-nav="${id}" class="nav-item ${state.view===id?'active':''}"><span>${icon}</span>${label}${id==='intent'&&intentLeads().length?`<em>${intentLeads().length}</em>`:''}</button>`).join('')}</nav>
      <div class="sidebar-foot"><span class="live-dot"></span> Production API<br><small>${esc(API.replace('https://',''))}</small></div>
    </aside>
    <main class="main">
      <header class="topbar"><div><div class="eyebrow">CLIENT ACQUISITION ENGINE</div><h1>${titleForView()}</h1></div>
        <div class="top-actions"><span class="refresh-time">${state.refreshedAt ? `Updated ${state.refreshedAt.toLocaleTimeString()}` : 'Live data'}</span><button class="icon-btn" data-action="refresh">↻</button><button class="user-chip" data-action="logout"><span>${esc((state.user?.name||'A')[0])}</span>${esc(state.user?.name||state.user?.email||'Operator')}</button></div>
      </header>
      ${state.notice ? `<div class="notice ${state.notice.type}">${esc(state.notice.text)}<button data-action="dismiss">×</button></div>`:''}
      <section class="content ${state.busy?'is-loading':''}">${view()}</section>
    </main>
    ${drawer()}
  </div>`
}

function titleForView(){ return ({overview:'Command Center',prospects:'Prospects',intent:'High Intent',acquisition:'Acquisition',outreach:'Outreach',pipeline:'Pipeline',jobs:'Jobs',providers:'Providers',analytics:'Analytics',settings:'Settings'})[state.view] }

function view(){
  if(state.view==='overview') return overview()
  if(state.view==='prospects') return prospects(false)
  if(state.view==='intent') return prospects(true)
  if(state.view==='acquisition') return acquisition()
  if(state.view==='outreach') return outreach()
  if(state.view==='pipeline') return pipeline()
  if(state.view==='jobs') return jobs()
  if(state.view==='providers') return providers()
  if(state.view==='analytics') return analytics()
  return settings()
}

function metric(label,value,sub='',cls='') { return `<article class="metric ${cls}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>` }

function overview(){
  const d=state.dashboard, total=state.leads.length || d.imported || 0, target=1000
  const acquiredToday = Number(d.acquired_today || d.new_today || 0)
  const intent=intentLeads().length, engaged=Number(d.replied||0)+intent
  const rate= total ? ((engaged/total)*100).toFixed(1) : '0.0'
  return `<div class="hero"><div><div class="eyebrow">PRODUCTION OPERATIONS</div><h2>Acquire deliberately. <i>Prioritize replies.</i></h2><p>Live prospecting, enrichment, qualification and outreach controls backed by CAP production data.</p></div><div class="hero-target"><strong>${fmt(acquiredToday)} / ${fmt(target)}</strong><span>acquired today</span><div class="progress"><i style="width:${Math.min(100,acquiredToday/target*100)}%"></i></div></div></div>
  <div class="metric-grid">${metric('Unique prospects',fmt(total),'authoritative lead records')}${metric('High intent',fmt(intent),'requests / strong intent','accent')}${metric('Replies',fmt(d.replied),'inbound responses')}${metric('Outreach today',`${fmt(d.sent||0)} / 250`,'email daily ceiling')}${metric('Pipeline',money(d.pipeline_value),'open opportunity value')}${metric('Won revenue',money(d.won_revenue),'attributed closed revenue')}</div>
  <div class="two-col"><section class="panel"><div class="panel-head"><div><span class="eyebrow">PRIORITY QUEUE</span><h3>High-intent prospects</h3></div><button class="btn" data-nav="intent">View all</button></div>${leadTable(intentLeads().slice(0,8),false)}</section>
  <aside class="panel"><div class="panel-head"><div><span class="eyebrow">SYSTEM</span><h3>Provider health</h3></div><button class="btn" data-nav="providers">Details</button></div>${providerList(8)}<div class="health-score"><strong>${rate}%</strong><span>engagement signal</span></div></aside></div>
  <div class="two-col bottom"><section class="panel"><div class="panel-head"><div><span class="eyebrow">PIPELINE</span><h3>Stage distribution</h3></div><button class="btn" data-nav="pipeline">Open pipeline</button></div>${stageBars()}</section>
  <section class="panel"><div class="panel-head"><div><span class="eyebrow">RECENT OPERATIONS</span><h3>Queue activity</h3></div><button class="btn" data-nav="jobs">All jobs</button></div>${jobMini()}</section></div>`
}

function filteredLeads(forceIntent=false){
  let arr=[...state.leads]
  if(forceIntent) arr=arr.filter(highIntent)
  const q=state.search.toLowerCase().trim()
  if(q) arr=arr.filter(l=>`${l.name||''} ${l.category||''} ${l.location||''} ${l.email||''} ${l.phone||''}`.toLowerCase().includes(q))
  if(state.stage!=='ALL') arr=arr.filter(l=>stageOf(l)===state.stage)
  if(state.presence!=='ALL') arr=arr.filter(l=>presenceOf(l)===state.presence)
  return arr
}
function intentLeads(){ return state.leads.filter(highIntent) }

function prospects(forceIntent=false){
  const arr=filteredLeads(forceIntent), totalPages=Math.max(1,Math.ceil(arr.length/state.pageSize)); if(state.page>totalPages) state.page=1
  const slice=arr.slice((state.page-1)*state.pageSize,state.page*state.pageSize)
  const stages=['ALL',...new Set(state.leads.map(stageOf).filter(Boolean))]
  const pres=['ALL',...new Set(state.leads.map(presenceOf).filter(Boolean))]
  return `<div class="toolbar"><div class="search"><span>⌕</span><input id="leadSearch" placeholder="Search business, category, location, email or phone" value="${esc(state.search)}"></div>
  <select id="stageFilter">${stages.map(s=>`<option ${state.stage===s?'selected':''}>${esc(s)}</option>`).join('')}</select><select id="presenceFilter">${pres.map(s=>`<option ${state.presence===s?'selected':''}>${esc(s)}</option>`).join('')}</select><button class="btn" data-action="refresh">Refresh</button></div>
  <div class="selection-bar ${state.selected.size?'show':''}"><b>${state.selected.size}</b> selected <button class="btn" data-action="bulk-approve">Approve selected</button><button class="btn danger" data-action="clear-selection">Clear</button></div>
  <section class="panel"><div class="panel-head"><div><span class="eyebrow">${forceIntent?'PRIORITY':'DATABASE'}</span><h3>${forceIntent?'High-intent prospects':'All prospects'}</h3><small>${fmt(arr.length)} matching records</small></div></div>${leadTable(slice,true)}
  <div class="pager"><button class="btn" data-action="prev-page" ${state.page<=1?'disabled':''}>Previous</button><span>Page ${state.page} of ${totalPages}</span><button class="btn" data-action="next-page" ${state.page>=totalPages?'disabled':''}>Next</button></div></section>`
}

function leadTable(leads,selectable=true){ if(!leads.length) return `<div class="empty">No prospects match this view.</div>`
  return `<div class="table-wrap"><table><thead><tr>${selectable?'<th><input type="checkbox" id="selectVisible"></th>':''}<th>Business</th><th>Presence</th><th>Stage</th><th>Contact</th><th>Category</th><th>Action</th></tr></thead><tbody>${leads.map(l=>`<tr data-lead="${esc(uid(l))}">${selectable?`<td><input class="lead-check" data-id="${esc(uid(l))}" type="checkbox" ${state.selected.has(uid(l))?'checked':''}></td>`:''}<td><button class="lead-link" data-open-lead="${esc(uid(l))}"><b>${esc(l.name||'Unnamed')}</b><span>${esc(l.location||'')}</span></button></td><td><span class="pill ${/NO_WEB|WEAK|OUTDATED|SOCIAL|DIRECTORY/i.test(presenceOf(l))?'amber':'muted'}">${esc(presenceOf(l))}</span></td><td><span class="pill ${highIntent(l)?'purple':'green'}">${esc(stageOf(l))}</span></td><td><span class="contact-cell">${esc(l.email||l.phone||'No contact')}</span></td><td>${esc(l.category||'—')}</td><td><button class="kebab" data-open-lead="${esc(uid(l))}">•••</button></td></tr>`).join('')}</tbody></table></div>`
}

function acquisition(){
  const noWeb=state.leads.filter(l=>/NO_WEB|SOCIAL_ONLY|DIRECTORY_ONLY/i.test(presenceOf(l))).length
  const weak=state.leads.filter(l=>/WEAK|OUTDATED/i.test(presenceOf(l))).length
  return `<div class="hero compact"><div><div class="eyebrow">AUTONOMOUS ACQUISITION</div><h2>1,000 new unique prospects / day</h2><p>EventBridge → ECS Fargate → discovery → dedupe → classification → enrichment → qualification → PostgreSQL.</p></div><div class="hero-actions"><span class="status-dot green">Scheduler configured</span><button class="btn primary" data-action="acquisition-run" title="Requires a production acquisition control endpoint">Run acquisition now</button></div></div>
  <div class="metric-grid four">${metric('Target','1,000','new unique / day')}${metric('No-web / social',fmt(noWeb),'priority website prospects')}${metric('Weak / outdated',fmt(weak),'upgrade opportunities')}${metric('Total database',fmt(state.leads.length),'current unique prospects')}</div>
  <div class="two-col"><section class="panel"><div class="panel-head"><div><span class="eyebrow">PRESENCE MIX</span><h3>Digital presence classification</h3></div></div>${presenceBars()}</section><section class="panel"><div class="panel-head"><div><span class="eyebrow">RUN CONTROL</span><h3>Acquisition operations</h3></div></div><div class="control-list"><div><b>Discovery provider</b><span>Overpass / OpenStreetMap</span></div><div><b>Daily target</b><span>1,000 new unique</span></div><div><b>Deduplication</b><span>Domain · email · phone · company/location</span></div><div><b>Domain required</b><span>No</span></div><div><b>Hunter</b><span>Conditional enrichment only</span></div></div><p class="hint">“Run acquisition now” calls the production control endpoint when available. The daily scheduler remains independent.</p></section></div>`
}

function outreach(){ const d=state.dashboard; const pending=state.leads.filter(l=>l.approval_state==='PENDING'); const approved=state.leads.filter(l=>l.approval_state==='APPROVED');
 return `<div class="metric-grid four">${metric('Awaiting approval',fmt(pending.length),'operator review')}${metric('Approved',fmt(approved.length),'eligible after checks')}${metric('Queued',fmt(d.queued),'provider queue')}${metric('Sent',fmt(d.sent),'accepted outbound')}</div><section class="panel"><div class="panel-head"><div><span class="eyebrow">APPROVAL GATE</span><h3>Pending outreach decisions</h3></div></div>${leadTable(pending.slice(0,50),true)}</section>` }

function pipeline(){ const columns=['IMPORTED','QUALIFIED','APPROVED','MESSAGE_READY','SENT','REPLIED','OPPORTUNITY','WON']; return `<div class="kanban">${columns.map(s=>{const ls=state.leads.filter(l=>stageOf(l)===s); return `<section class="kan-col"><header><b>${s}</b><span>${ls.length}</span></header>${ls.slice(0,12).map(l=>`<button class="kan-card" data-open-lead="${esc(uid(l))}"><b>${esc(l.name)}</b><span>${esc(l.category||'')}</span></button>`).join('')||'<div class="empty small">No records</div>'}</section>`}).join('')}</div>` }

function jobs(){ const jobs=state.queue; return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">WORKER QUEUE</span><h3>Operational jobs</h3><small>${fmt(jobs.length)} current records</small></div><button class="btn" data-action="refresh">Refresh</button></div>${jobs.length?`<div class="table-wrap"><table><thead><tr><th>Type</th><th>Lead</th><th>Status</th><th>Attempts</th><th>Provider</th><th>Created</th></tr></thead><tbody>${jobs.slice().reverse().slice(0,100).map(j=>`<tr><td><b>${esc(j.type)}</b></td><td>${esc(j.lead_id||'—')}</td><td><span class="pill ${/COMPLETE|SENT/i.test(j.status)?'green':/FAIL|DLQ/i.test(j.status)?'red':'amber'}">${esc(j.status||'QUEUED')}</span></td><td>${fmt(j.attempts)}</td><td>${esc(j.provider||'—')}</td><td>${when(j.created_at)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No active queue records.</div>'}</section>` }

function providers(){ return `<section class="panel"><div class="panel-head"><div><span class="eyebrow">LIVE READINESS</span><h3>Production providers</h3></div><button class="btn" data-action="refresh">Recheck</button></div><div class="provider-grid">${providerCards()}</div></section>` }

function analytics(){ const d=state.dashboard; return `<div class="metric-grid four">${metric('Pipeline',money(d.pipeline_value),'open value')}${metric('Expected',money(d.expected_revenue),'weighted estimate')}${metric('Won',money(d.won_revenue),'closed revenue')}${metric('Positive replies',fmt(d.positive_replies),'qualified responses')}</div><div class="two-col"><section class="panel"><div class="panel-head"><h3>Category distribution</h3></div>${categoryBars()}</section><section class="panel"><div class="panel-head"><h3>Revenue records</h3></div>${state.revenue.length?state.revenue.slice(0,20).map(r=>`<div class="row-line"><span>${esc(r.name||r.lead_name||r.type||'Revenue')}</span><b>${money(r.amount||r.value)}</b></div>`).join(''):'<div class="empty">No attributed revenue records yet.</div>'}</section></div>` }

function settings(){ const c=state.campaigns[0]; return `<div class="two-col"><section class="panel"><div class="panel-head"><div><span class="eyebrow">CAMPAIGN CONTROL</span><h3>${esc(c?.name||'Primary campaign')}</h3></div><span class="pill ${c?.status==='ACTIVE'?'green':'amber'}">${esc(c?.status||'UNKNOWN')}</span></div>${c?`<div class="button-grid"><button class="btn" data-campaign="approve" data-id="${esc(c.id)}">Approve</button><button class="btn primary" data-campaign="start" data-id="${esc(c.id)}">Start</button><button class="btn" data-campaign="pause" data-id="${esc(c.id)}">Pause</button><button class="btn" data-campaign="resume" data-id="${esc(c.id)}">Resume</button><button class="btn danger" data-campaign="stop" data-id="${esc(c.id)}">Stop</button></div>`:'<div class="empty">No campaign returned by API.</div>'}</section><section class="panel"><div class="panel-head"><h3>Production gates</h3></div><div class="control-list"><div><b>Email send gate</b><span class="pill ${state.dashboard.send_enabled?'green':'red'}">${state.dashboard.send_enabled?'ENABLED':'DISABLED'}</span></div><div><b>SMS send gate</b><span class="pill ${state.dashboard.sms_send_enabled?'green':'red'}">${state.dashboard.sms_send_enabled?'ENABLED':'DISABLED'}</span></div><div><b>Daily email ceiling</b><span>250</span></div><div><b>Acquisition target</b><span>1,000</span></div></div><p class="hint">Secrets and provider credentials remain managed in AWS Secrets Manager, not this UI.</p></section></div>` }

function readinessEntries(){ const r=state.readiness?.readiness || {}; return Object.entries(r).filter(([k])=>k!=='fallback_messages') }
function providerList(limit=99){ const entries=readinessEntries().slice(0,limit); if(!entries.length)return '<div class="empty">Readiness data unavailable.</div>'; return `<div class="provider-list">${entries.map(([k,v])=>{const ok=typeof v==='boolean'?v:Boolean(v?.ready??v?.status==='READY'); const detail=typeof v==='object'?(v.message||v.status||v.reason||''):(v?'Ready':'Blocked'); return `<div><span><i class="health ${ok?'ok':'bad'}"></i>${esc(k.replaceAll('_',' '))}</span><b>${esc(detail|| (ok?'READY':'BLOCKED'))}</b></div>`}).join('')}</div>` }
function providerCards(){ return readinessEntries().map(([k,v])=>{const ok=typeof v==='boolean'?v:Boolean(v?.ready??v?.status==='READY'); const detail=typeof v==='object'?(v.message||v.reason||v.status||''):(v?'Operational':'Unavailable');return `<article class="provider-card"><div><i class="health ${ok?'ok':'bad'}"></i><b>${esc(k.replaceAll('_',' '))}</b></div><strong>${ok?'READY':'ATTENTION'}</strong><p>${esc(detail)}</p></article>`}).join('')||'<div class="empty">Readiness data unavailable.</div>' }
function groupCount(fn){ const m={}; state.leads.forEach(l=>{const k=fn(l)||'UNKNOWN';m[k]=(m[k]||0)+1}); return m }
function bars(map){ const max=Math.max(1,...Object.values(map)); return `<div class="bars">${Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>`<div><span>${esc(k)}</span><div><i style="width:${v/max*100}%"></i></div><b>${v}</b></div>`).join('')}</div>` }
function stageBars(){ return bars(groupCount(stageOf)) }
function presenceBars(){ return bars(groupCount(presenceOf)) }
function categoryBars(){ return bars(state.dashboard.by_category || groupCount(l=>l.category||'Unknown')) }
function jobMini(){ if(!state.queue.length)return '<div class="empty">No queued jobs.</div>'; return state.queue.slice().reverse().slice(0,7).map(j=>`<div class="row-line"><span><b>${esc(j.type)}</b><small>${esc(j.lead_id||'')}</small></span><span class="pill muted">${esc(j.status||'QUEUED')}</span></div>`).join('') }

function drawer(){ const l=state.drawerLead; if(!l)return ''; const id=uid(l); return `<div class="drawer-backdrop" data-action="close-drawer"></div><aside class="drawer"><header><div><span class="eyebrow">PROSPECT DETAIL</span><h2>${esc(l.name)}</h2><p>${esc(l.location||'')}</p></div><button class="icon-btn" data-action="close-drawer">×</button></header><div class="drawer-body"><div class="detail-grid"><div><span>Stage</span><b>${esc(stageOf(l))}</b></div><div><span>Presence</span><b>${esc(presenceOf(l))}</b></div><div><span>Category</span><b>${esc(l.category||'—')}</b></div><div><span>Source</span><b>${esc(l.source||l.discovery_source||'—')}</b></div></div><section><h3>Contact</h3><p>Email: ${esc(l.email||'—')}<br>Phone: ${esc(l.phone||'—')}<br>Website: ${l.website?`<a href="${esc(l.website)}" target="_blank" rel="noreferrer">${esc(l.website)}</a>`:'—'}</p></section><section><h3>Qualification</h3><pre>${esc(JSON.stringify(l.openai_qualification||l.qualification||l.product_fits||{},null,2))}</pre></section><section><h3>Actions</h3><div class="button-grid"><button class="btn" data-lead-action="verify" data-id="${esc(id)}">Verify website</button><button class="btn" data-lead-action="prepare" data-id="${esc(id)}">Prepare email</button><button class="btn primary" data-lead-action="approve" data-id="${esc(id)}">Approve</button><button class="btn" data-lead-action="prepare-sms" data-id="${esc(id)}">Prepare SMS</button><button class="btn" data-lead-action="approve-sms" data-id="${esc(id)}">Approve SMS</button><button class="btn" data-lead-action="queue-sms" data-id="${esc(id)}">Queue SMS</button><button class="btn danger" data-lead-action="suppress" data-id="${esc(id)}">Suppress</button></div></section><section><h3>Lifecycle stage</h3><select id="drawerStage">${['IMPORTED','QUALIFIED','APPROVED','MESSAGE_READY','SENT','REPLIED','OPPORTUNITY','PROPOSAL','WON','LOST','SUPPRESSED'].map(s=>`<option ${stageOf(l)===s?'selected':''}>${s}</option>`).join('')}</select><button class="btn" data-action="save-stage" data-id="${esc(id)}">Save stage</button></section></div></aside>` }

function render(){ app.innerHTML = state.user ? shell() : loginView(); bind() }

function bind(){
  document.querySelector('#loginForm')?.addEventListener('submit', login)
  document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',()=>{state.view=el.dataset.nav;state.page=1;render()}))
  document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',handleAction))
  document.querySelectorAll('[data-open-lead]').forEach(el=>el.addEventListener('click',()=>{state.drawerLead=state.leads.find(l=>uid(l)===el.dataset.openLead);render()}))
  document.querySelectorAll('[data-lead-action]').forEach(el=>el.addEventListener('click',()=>leadAction(el.dataset.id,el.dataset.leadAction)))
  document.querySelectorAll('[data-campaign]').forEach(el=>el.addEventListener('click',()=>campaignAction(el.dataset.id,el.dataset.campaign)))
  document.querySelectorAll('.lead-check').forEach(el=>el.addEventListener('change',()=>{el.checked?state.selected.add(el.dataset.id):state.selected.delete(el.dataset.id);render()}))
  document.querySelector('#selectVisible')?.addEventListener('change',e=>{document.querySelectorAll('.lead-check').forEach(c=>e.target.checked?state.selected.add(c.dataset.id):state.selected.delete(c.dataset.id));render()})
  document.querySelector('#leadSearch')?.addEventListener('input',e=>{state.search=e.target.value;state.page=1;render()})
  document.querySelector('#stageFilter')?.addEventListener('change',e=>{state.stage=e.target.value;state.page=1;render()})
  document.querySelector('#presenceFilter')?.addEventListener('change',e=>{state.presence=e.target.value;state.page=1;render()})
}

async function login(e){ e.preventDefault(); const fd=new FormData(e.target); state.notice=null; try{const r=await api('/api/v1/auth/login',{method:'POST',body:{email:fd.get('email'),password:fd.get('password')}});state.user=r.user;await refreshAll()}catch(err){state.notice={type:'error',text:err.message};render()} }
async function logout(){ try{await api('/api/v1/auth/logout',{method:'POST'})}catch{} state.user=null;state.leads=[];render() }
async function leadAction(id,action){ try{state.busy=true;render();await api(`/api/v1/leads/${encodeURIComponent(id)}/${action}`,{method:'POST'});state.notice={type:'success',text:`${action} completed.`};state.drawerLead=null;await refreshAll()}catch(e){state.busy=false;state.notice={type:'error',text:e.message};render()} }
async function campaignAction(id,action){ try{await api(`/api/v1/campaigns/${encodeURIComponent(id)}/${action}`,{method:'POST'});state.notice={type:'success',text:`Campaign ${action} completed.`};await refreshAll()}catch(e){state.notice={type:'error',text:e.message};render()} }
async function bulkApprove(){ if(!state.selected.size)return; try{const r=await api('/api/v1/approvals/bulk',{method:'POST',body:{ids:[...state.selected]}});state.notice={type:'success',text:`Approved ${r.approved?.length||0} prospects.`};state.selected.clear();await refreshAll()}catch(e){state.notice={type:'error',text:e.message};render()} }
async function saveStage(id){const stage=document.querySelector('#drawerStage')?.value;if(!stage)return;try{await api(`/api/v1/leads/${encodeURIComponent(id)}`,{method:'PATCH',body:{lifecycle_stage:stage}});state.notice={type:'success',text:`Stage updated to ${stage}.`};state.drawerLead=null;await refreshAll()}catch(e){state.notice={type:'success',text:e.message};render()} }
async function acquisitionRun(){ try{state.busy=true;render();await api('/api/v1/acquisition/run',{method:'POST'});state.notice={type:'success',text:'Acquisition run requested.'};await refreshAll()}catch(e){state.busy=false;state.notice={type:'error',text:e.status===404?'Manual acquisition endpoint is not yet exposed by the production API. Daily EventBridge scheduling is unaffected.':e.message};render()} }
function handleAction(e){ const a=e.currentTarget.dataset.action,id=e.currentTarget.dataset.id;if(a==='refresh')refreshAll();if(a==='logout')logout();if(a==='dismiss'){state.notice=null;render()}if(a==='close-drawer'){state.drawerLead=null;render()}if(a==='bulk-approve')bulkApprove();if(a==='clear-selection'){state.selected.clear();render()}if(a==='prev-page'){state.page=Math.max(1,state.page-1);render()}if(a==='next-page'){state.page++;render()}if(a==='save-stage')saveStage(id);if(a==='acquisition-run')acquisitionRun() }

bootstrap()
