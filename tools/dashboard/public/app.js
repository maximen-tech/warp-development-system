// Dashboard logic for index.html
const state = { events: [], counters: { total:0, errors:0, approvals:0 }, last: {} };

function badge(cls, text){ return `<span class="badge ${cls}">${text}</span>` }
function clsFor(ev){ if(ev.status==='error') return 'err'; if(ev.status==='awaiting_approval') return 'warn'; if(ev.status==='validated'||ev.kind==='end') return 'ok'; return 'info'; }

function updateOverview(){
  const el = document.getElementById('overview');
  el.innerHTML = ''+
    `<div class="card"><div>Total events</div><div class="row"><span style="font-size:28px">${state.counters.total}</span></div></div>`+
    `<div class="card"><div>Errors</div><div class="row"><span style="font-size:28px;color:var(--err)">${state.counters.errors}</span></div></div>`+
    `<div class="card"><div>Awaiting approvals</div><div class="row"><span style="font-size:28px;color:var(--warn)">${state.counters.approvals}</span></div></div>`+
    `<div class="card"><div>Last phase</div><div class="row">${badge('info', state.last.phase||'-')}</div></div>`;
}

function renderTimeline(ev){
  const list = document.getElementById('timeline');
  const div = document.createElement('div');
  div.className = 'event';
  const ts = ev.ts ? new Date(ev.ts*1000).toLocaleTimeString() : '';
  const cls = clsFor(ev);
  const msg = JSON.stringify(ev.data||{}).replace(/</g,'&lt;');
  div.innerHTML = `<div class="small">${ts}</div><div class="row"><b>${ev.kind}</b> ${badge(cls, ev.status||'')} ${badge('info', ev.phase||'')} ${badge('info', ev.agent||'')}</div><div class="small">${msg}</div>`;
  list.prepend(div);
}

function applyCounters(ev){
  state.counters.total++;
  if(ev.status==='error') state.counters.errors++;
  if(ev.status==='awaiting_approval') state.counters.approvals++;
  if(ev.phase) state.last.phase = ev.phase;
}

export function initDashboard(){
  updateOverview();
  const source = new EventSource('/events');
  source.onmessage = (e)=>{
    try{ const ev = JSON.parse(e.data); state.events.push(ev); applyCounters(ev); updateOverview(); renderTimeline(ev);}catch{}
  };
  source.onerror = ()=>{
    const list = document.getElementById('timeline');
    const div = document.createElement('div');
    div.className='event';
    div.innerHTML = '<div class="small" style="color:var(--err)">SSE disconnected</div>';
    list.prepend(div);
  };
}

export async function runScenario(name){ await fetch(`/api/run/${name}`, { method:'POST' }); }
export async function approveNow(){
  const ev = { ts: Date.now()/1000, kind:'approval_granted', status:'ok', data:{ by:'ui' } };
  await fetch('/api/events/append',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(ev)});
}
