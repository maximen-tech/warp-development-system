// Dashboard logic for index.html
const state = { events: [], counters: { total:0, errors:0, approvals:0 }, last: {}, approvals: [] };

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

function renderApprovals(){
  const el = document.getElementById('approvals');
  el.innerHTML='';
  for(const ap of state.approvals.slice(-20)){
    const row = document.createElement('div');
    row.className='row';
    row.style.justifyContent='space-between';
    const actionId = ap.data?.actionId || ap.actionId || null;
    const runId = ap.data?.runId || ap.runId || null;
    row.innerHTML = `<span class="small">${ap.phase||''} · ${ap.agent||''} · run=${runId||'-'}</span><button class="pill">Approve</button>`;
    row.querySelector('button').onclick = async (evt)=>{
      const btn = evt.currentTarget; btn.textContent='Processing…'; btn.disabled=true;
      await approveNow(actionId, runId);
      setTimeout(()=>{ btn.textContent='Approve'; btn.disabled=false; }, 1200);
    };
    el.prepend(row);
  }
}

function applyCounters(ev){
  state.counters.total++;
  if(ev.status==='error') state.counters.errors++;
  if(ev.kind==='action_proposed' && (ev.data?.approval==='manual')){ state.counters.approvals++; state.approvals.push(ev); renderApprovals(); }
  if(ev.phase) state.last.phase = ev.phase;
}

async function loadArtifacts(){
  try {
    const list = document.getElementById('artifacts');
    const meta = await (await fetch('/api/artifacts')).json();
    const items = meta.files||[];
    if(!items.length){ list.innerHTML = '<div class="small">No artifacts yet</div>'; return; }
    list.innerHTML = '';
    for(const f of items){
      const row = document.createElement('div'); row.className='row'; row.style.justifyContent='space-between';
      row.innerHTML = `<span>${f.name}</span><span class="small">${(f.size||0)} bytes</span>`;
      const actions = document.createElement('span'); actions.className='row';
      const btnPreview = document.createElement('button'); btnPreview.className='pill'; btnPreview.textContent='Preview';
      const btnCopy = document.createElement('button'); btnCopy.className='pill'; btnCopy.textContent='Copy';
      const btnOpen = document.createElement('a'); btnOpen.className='pill'; btnOpen.textContent='Open'; btnOpen.href=`/api/artifact/download/${f.name}`; btnOpen.target='_blank';
      actions.appendChild(btnPreview); actions.appendChild(btnCopy); actions.appendChild(btnOpen);
      row.appendChild(actions); list.appendChild(row);
      btnPreview.onclick = async ()=>{
        const text = await (await fetch(`/api/artifact/raw/${f.name}`)).text();
        const container = document.createElement('div'); container.className='card';
        const code = document.createElement('code');
        let lang = 'markup'; if(f.name.endsWith('.json')) lang='json'; else if(f.name.endsWith('.diff')) lang='diff'; else if(f.name.endsWith('.md')){ const marked = (await import('https://cdn.jsdelivr.net/npm/marked/+esm')).marked; container.innerHTML = marked.parse(text); list.appendChild(container); return; } else if(f.name.endsWith('.log')||f.name.endsWith('.txt')) lang='markup';
        const pre = document.createElement('pre'); pre.className=`language-${lang}`; code.className=`language-${lang}`; code.textContent=text; pre.appendChild(code); container.appendChild(pre); list.appendChild(container); if(window.Prism) Prism.highlightElement(code);
      };
      btnCopy.onclick = async ()=>{
        const text = await (await fetch(`/api/artifact/raw/${f.name}`)).text(); await navigator.clipboard.writeText(text);
      };
    }
  } catch {}
}

function drawSparkline(){
  const canvas = document.getElementById('sparkline'); if(!canvas) return; const ctx = canvas.getContext('2d');
  const now = Date.now()/1000; const windowMin = 15; const buckets = new Array(windowMin).fill(0);
  for(const ev of state.events){ const dt = Math.floor((now - (ev.ts||now))/60); if(dt>=0 && dt<windowMin) buckets[windowMin-1-dt]++; }
  ctx.clearRect(0,0,canvas.width,canvas.height); const max = Math.max(1, ...buckets);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--info'); ctx.beginPath();
  buckets.forEach((v,i)=>{ const x = i*(canvas.width/(windowMin-1)); const y = canvas.height - (v/max)*canvas.height; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
}
function drawHeatmap(){
  const canvas = document.getElementById('heatmap'); if(!canvas) return; const ctx = canvas.getContext('2d');
  const agents = ['planner','executor','validator']; const phases=['plan','execute','validate'];
  const grid = phases.map(()=>agents.map(()=>0));
  for(const ev of state.events){ const ai = agents.indexOf(ev.agent||''); const pi = phases.indexOf(ev.phase||''); if(ai>=0 && pi>=0) grid[pi][ai]++; }
  const cellW = canvas.width/agents.length; const cellH = canvas.height/phases.length; ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let r=0;r<phases.length;r++) for(let c=0;c<agents.length;c++){ const v = grid[r][c]; const alpha = Math.min(1, v/5); ctx.fillStyle = `rgba(106,183,255,${alpha})`; ctx.fillRect(c*cellW, r*cellH, cellW-2, cellH-2); }
}

// Console panel
let consolePaused = false; let consoleTimer = null; let lastConsole = '';
async function pollConsole(){ if(consolePaused) return; try{ const d = await (await fetch('/api/console')).json(); const el = document.getElementById('consoleOut'); if(!el) return; if(d.content!==lastConsole){ el.textContent = d.content||''; el.scrollTop = el.scrollHeight; lastConsole = d.content; } } catch {}
}
function initConsole(){ const pauseBtn = document.getElementById('pauseConsole'); const clearBtn = document.getElementById('clearConsole'); if(pauseBtn){ pauseBtn.onclick = ()=>{ consolePaused = !consolePaused; pauseBtn.textContent = consolePaused ? 'Resume' : 'Pause'; }; } if(clearBtn){ clearBtn.onclick = async ()=>{ await fetch('/api/clear-console',{method:'POST'}); lastConsole=''; pollConsole(); }; } consoleTimer = setInterval(pollConsole, 2000); }

export function initDashboard(){
  updateOverview();
  loadArtifacts();
  initConsole();
  const source = new EventSource('/events');
  source.onmessage = (e)=>{
    try{ const ev = JSON.parse(e.data); state.events.push(ev); applyCounters(ev); updateOverview(); renderTimeline(ev); drawSparkline(); drawHeatmap(); }catch{}
  };
  document.getElementById('refreshArtifacts')?.addEventListener('click', loadArtifacts);
  source.onerror = ()=>{
    const list = document.getElementById('timeline');
    const div = document.createElement('div');
    div.className='event';
    div.innerHTML = '<div class="small" style="color:var(--err)">SSE disconnected</div>';
    list.prepend(div);
  };
}

export async function runScenario(name){ await fetch(`/api/run/${name}`, { method:'POST' }); }
export async function approveNow(actionId, runId){
  const ev = { ts: Date.now()/1000, kind:'approval_granted', status:'ok', data:{ by:'ui', actionId: actionId||null, runId: runId||null } };
  await fetch('/api/events/append',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(ev)});
}
