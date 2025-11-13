import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3030;
const runtimeDir = path.resolve(__dirname, '../../runtime');
const eventsFile = path.join(runtimeDir, 'events.jsonl');
const changeLogFile = path.join(runtimeDir, 'agents_changes.jsonl');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' }));

// Agents API (read/write .warp/agents/*)
const repoRoot = path.resolve(__dirname, '../../');
const agentsDir = path.join(repoRoot, '.warp', 'agents');
const agentsFile = path.join(agentsDir, 'agents.yml');
const skillsFile = path.join(agentsDir, 'skills.yml');
const backupDir = path.join(runtimeDir, 'backups');

function ensureDirs(){
  if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
}
function logChange(kind, details){
  try{
    const entry = { ts: Date.now()/1000, kind, details };
    fs.appendFileSync(changeLogFile, JSON.stringify(entry)+'\n','utf-8');
  }catch{}
}
async function readYAMLList(file, key){
  const YAML = (await import('yaml')).default;
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf-8').trim(); if(!raw) return [];
  const parsed = YAML.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed[key])) return parsed[key];
  return [];
}
async function writeYAMLList(file, key, list){
  const YAML = (await import('yaml')).default;
  const doc = {}; doc[key] = list || [];
  const text = YAML.stringify(doc);
  fs.writeFileSync(file, text, 'utf-8');
}

// Raw YAML read (legacy)
app.get('/api/agents', (_req, res) => {
  try {
    const agents = fs.existsSync(agentsFile) ? fs.readFileSync(agentsFile, 'utf-8') : '';
    const skills = fs.existsSync(skillsFile) ? fs.readFileSync(skillsFile, 'utf-8') : '';
    res.json({ agents, skills });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Raw YAML write (legacy)
app.put('/api/agents', (req, res) => {
  try {
    ensureDirs();
    const { agents, skills } = req.body || {};
    const ts = Date.now();
    if (typeof agents === 'string') {
      if (fs.existsSync(agentsFile)) fs.copyFileSync(agentsFile, path.join(backupDir, `agents.${ts}.yml`));
      fs.writeFileSync(agentsFile, agents, 'utf-8');
    }
    if (typeof skills === 'string') {
      if (fs.existsSync(skillsFile)) fs.copyFileSync(skillsFile, path.join(backupDir, `skills.${ts}.yml`));
      fs.writeFileSync(skillsFile, skills, 'utf-8');
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Validate YAML for agents/skills (requires 'yaml' dependency)
app.post('/api/agents/validate', async (req, res) => {
  try {
    const { agents, skills } = req.body || {};
    const YAML = (await import('yaml')).default;
    const errors = [];
    try { if (typeof agents === 'string') YAML.parse(agents); } catch (e) { errors.push({ file: 'agents.yml', error: String(e) }); }
    try { if (typeof skills === 'string') YAML.parse(skills); } catch (e) { errors.push({ file: 'skills.yml', error: String(e) }); }
    res.json({ ok: errors.length === 0, errors });
  } catch (e) {
    res.status(500).json({ error: 'YAML module missing or parse error', details: String(e) });
  }
});

// JSON-native APIs for no-code UI
app.get('/api/agents/list', async (_req, res) => {
  try {
    const agents = await readYAMLList(agentsFile, 'agents');
    const skills = await readYAMLList(skillsFile, 'skills');
    res.json({ agents, skills });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/agents/save', async (req, res) => {
  try {
    ensureDirs();
    const { agents, skills, validateOnly, reason } = req.body || {};
    const YAML = (await import('yaml')).default;
    const errors = [];
    try { YAML.parse(YAML.stringify({ agents: agents||[] })); } catch (e) { errors.push({ file: 'agents.yml', error: String(e) }); }
    try { YAML.parse(YAML.stringify({ skills: skills||[] })); } catch (e) { errors.push({ file: 'skills.yml', error: String(e) }); }
    if (errors.length) return res.json({ ok:false, errors });
    if (validateOnly) return res.json({ ok:true, validated:true });
    const ts = Date.now();
    const beforeAgents = fs.existsSync(agentsFile) ? `agents.${ts}.yml` : null;
    const beforeSkills = fs.existsSync(skillsFile) ? `skills.${ts}.yml` : null;
    if (beforeAgents) fs.copyFileSync(agentsFile, path.join(backupDir, beforeAgents));
    if (beforeSkills) fs.copyFileSync(skillsFile, path.join(backupDir, beforeSkills));
    await writeYAMLList(agentsFile, 'agents', agents||[]);
    await writeYAMLList(skillsFile, 'skills', skills||[]);
    logChange('save', { beforeAgents, beforeSkills, reason: reason||null });
    res.json({ ok:true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/agents/validate-json', async (req, res) => {
  try {
    const { agents, skills } = req.body || {};
    const YAML = (await import('yaml')).default;
    const errors = [];
    try { YAML.parse(YAML.stringify({ agents: agents||[] })); } catch (e) { errors.push({ file:'agents.yml', error:String(e) }); }
    try { YAML.parse(YAML.stringify({ skills: skills||[] })); } catch (e) { errors.push({ file:'skills.yml', error:String(e) }); }
    // Uniqueness and references
    const seenAgents = new Set();
    for (const a of (agents||[])){
      const name = (a && a.name) || null;
      if(!name) errors.push({ file:'agents.yml', error:'agent missing name' });
      else if (seenAgents.has(name)) errors.push({ file:'agents.yml', error:`duplicate agent name: ${name}` });
      else seenAgents.add(name);
    }
    const skillNames = new Set((skills||[]).map(s=>s && s.name).filter(Boolean));
    const seenSkills = new Set();
    for (const s of (skills||[])){
      const nm = (s && s.name) || null; if(!nm) errors.push({ file:'skills.yml', error:'skill missing name' });
      else if (seenSkills.has(nm)) errors.push({ file:'skills.yml', error:`duplicate skill name: ${nm}` });
      else seenSkills.add(nm);
    }
    for (const a of (agents||[])){
      const list = Array.isArray(a?.skills) ? a.skills : [];
      for (const sk of list){ if (!skillNames.has(sk)) errors.push({ file:'agents.yml', error:`agent ${a.name}: references unknown skill ${sk}` }); }
    }
    res.json({ ok: errors.length===0, errors });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Atomic CRUD for single agent/skill
app.post('/api/agents/item', async (req,res)=>{
  try{
    ensureDirs();
    const { agent } = req.body||{}; if(!agent || !agent.name) return res.status(400).json({ error:'missing agent.name' });
    const agents = await readYAMLList(agentsFile,'agents');
    const skills = await readYAMLList(skillsFile,'skills');
    // validate
    const v = await (await fetchLikeValidate({ agents: mergeOne(agents, agent), skills })).json();
    if(!v.ok) return res.json(v);
    const ts = Date.now(); if (fs.existsSync(agentsFile)) fs.copyFileSync(agentsFile, path.join(backupDir, `agents.${ts}.yml`));
await writeYAMLList(agentsFile,'agents', mergeOne(agents, agent));
    logChange('agent_upsert', { name: agent.name, backup: `agents.${ts}.yml` });
    return res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});
app.delete('/api/agents/item', async (req,res)=>{
  try{
    ensureDirs();
    const name = (req.query.name||'').trim(); if(!name) return res.status(400).json({ error:'missing name' });
    const agents = await readYAMLList(agentsFile,'agents');
    const next = agents.filter(a=>(a?.name)!==name);
    const ts = Date.now(); if (fs.existsSync(agentsFile)) fs.copyFileSync(agentsFile, path.join(backupDir, `agents.${ts}.yml`));
await writeYAMLList(agentsFile,'agents', next);
    logChange('agent_delete', { name, backup: `agents.${ts}.yml` });
    return res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});
app.post('/api/skills/item', async (req,res)=>{
  try{
    ensureDirs();
    const { skill } = req.body||{}; if(!skill || !skill.name) return res.status(400).json({ error:'missing skill.name' });
    const skills = await readYAMLList(skillsFile,'skills');
    const next = mergeOne(skills, skill);
    // validate against agents references
    const agents = await readYAMLList(agentsFile,'agents');
    const v = await (await fetchLikeValidate({ agents, skills: next })).json();
    if(!v.ok) return res.json(v);
    const ts = Date.now(); if (fs.existsSync(skillsFile)) fs.copyFileSync(skillsFile, path.join(backupDir, `skills.${ts}.yml`));
await writeYAMLList(skillsFile,'skills', next);
    logChange('skill_upsert', { name: skill.name, backup: `skills.${ts}.yml` });
    return res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});
app.delete('/api/skills/item', async (req,res)=>{
  try{
    ensureDirs();
    const name = (req.query.name||'').trim(); if(!name) return res.status(400).json({ error:'missing name' });
    const skills = await readYAMLList(skillsFile,'skills');
    const next = skills.filter(s=>(s?.name)!==name);
    // detach from agents
    const agents = await readYAMLList(agentsFile,'agents');
    for (const a of agents){ a.skills = (a.skills||[]).filter(n=>n!==name); }
    const v = await (await fetchLikeValidate({ agents, skills: next })).json();
    if(!v.ok) return res.json(v);
    const ts = Date.now(); if (fs.existsSync(skillsFile)) fs.copyFileSync(skillsFile, path.join(backupDir, `skills.${ts}.yml`));
    if (fs.existsSync(agentsFile)) fs.copyFileSync(agentsFile, path.join(backupDir, `agents.${ts}.yml`));
    await writeYAMLList(skillsFile,'skills', next);
await writeYAMLList(agentsFile,'agents', agents);
    logChange('skill_delete', { name, backupSkills: `skills.${ts}.yml`, backupAgents: `agents.${ts}.yml` });
    return res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

function mergeOne(list, item){ const i = list.findIndex(x=>(x?.name)===item.name); if(i>=0){ const copy = list.slice(); copy[i]=item; return copy; } return [...list, item]; }
async function fetchLikeValidate(body){
  // local helper to reuse validate-json logic
  const req = { body };
  const res = { json: (x)=>x };
  const YAML = (await import('yaml')).default;
  const errors = [];
  try { YAML.parse(YAML.stringify({ agents: body.agents||[] })); } catch (e) { errors.push({ file:'agents.yml', error:String(e) }); }
  try { YAML.parse(YAML.stringify({ skills: body.skills||[] })); } catch (e) { errors.push({ file:'skills.yml', error:String(e) }); }
  const seenAgents = new Set(); for(const a of (body.agents||[])){ const n=a?.name; if(!n) errors.push({file:'agents.yml', error:'agent missing name'}); else if(seenAgents.has(n)) errors.push({file:'agents.yml', error:`duplicate agent name: ${n}`}); else seenAgents.add(n); }
  const seenSkills = new Set(); for(const s of (body.skills||[])){ const n=s?.name; if(!n) errors.push({file:'skills.yml', error:'skill missing name'}); else if(seenSkills.has(n)) errors.push({file:'skills.yml', error:`duplicate skill name: ${n}`}); else seenSkills.add(n); }
  const skillNames = new Set((body.skills||[]).map(s=>s?.name).filter(Boolean));
  for(const a of (body.agents||[])){ for(const sk of (a.skills||[])){ if(!skillNames.has(sk)) errors.push({file:'agents.yml', error:`agent ${a.name}: references unknown skill ${sk}`}); } }
  return { json: async (x)=>x, ok: errors.length===0, errors };
}

// Export / Import JSON/CSV
app.get('/api/agents/export', async (req,res)=>{
  try{
    const format = String(req.query.format||'json').toLowerCase();
    const agents = await readYAMLList(agentsFile,'agents');
    const skills = await readYAMLList(skillsFile,'skills');
    const names = (req.query.names||'').split(',').map(s=>s.trim()).filter(Boolean);
    const selAgents = names.length? agents.filter(a=>names.includes(a?.name)): agents;
    if(format==='csv'){
      const rows = ['name,role,model,skills'];
      for(const a of selAgents){ rows.push(`${a.name||''},${a.role||''},${a.model||''},"${(a.skills||[]).join('|').replace(/"/g,'\"')}"`); }
      res.setHeader('Content-Type','text/csv');
      return res.send(rows.join('\n'));
    }
    res.json({ agents: selAgents, skills });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});
app.post('/api/agents/import', async (req,res)=>{
  try{
    ensureDirs();
    const { agents, skills, partial, dryRun } = req.body||{};
    const curAgents = await readYAMLList(agentsFile,'agents');
    const curSkills = await readYAMLList(skillsFile,'skills');
    let nextAgents = Array.isArray(agents)? (partial? mergeMany(curAgents, agents) : agents) : curAgents;
    let nextSkills = Array.isArray(skills)? (partial? mergeMany(curSkills, skills) : skills) : curSkills;
    const v = await (await fetchLikeValidate({ agents: nextAgents, skills: nextSkills })).json();
    if(!v.ok) return res.json(v);
if(dryRun) return res.json({ ok:true, dryRun:true });
    const ts = Date.now();
    const beforeAgents = fs.existsSync(agentsFile) ? `agents.${ts}.yml` : null;
    const beforeSkills = fs.existsSync(skillsFile) ? `skills.${ts}.yml` : null;
    if (beforeAgents) fs.copyFileSync(agentsFile, path.join(backupDir, beforeAgents));
    if (beforeSkills) fs.copyFileSync(skillsFile, path.join(backupDir, beforeSkills));
    await writeYAMLList(agentsFile,'agents', nextAgents);
    await writeYAMLList(skillsFile,'skills', nextSkills);
    logChange('import', { partial: !!partial, beforeAgents, beforeSkills });
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});
function mergeMany(cur, items){ const map = new Map(cur.map(x=>[x?.name, x])); for(const it of (items||[])){ if(it?.name) map.set(it.name, it); } return Array.from(map.values()); }

// Diffs and rollback batch
function diffText(a,b){ const al=(a||'').split('\n'), bl=(b||'').split('\n'); const max=Math.max(al.length, bl.length); const out=[]; for(let i=0;i<max;i++){ const L=al[i]??'', R=bl[i]??''; if(L===R) out.push('  '+R); else { if(R!=='') out.push('+ '+R); if(L!=='') out.push('- '+L); } } return out.join('\n'); }
app.get('/api/agents/diff', async (req,res)=>{
  try{
    const name = (req.query.name||'').trim();
    const targetAgents = fs.existsSync(agentsFile) ? fs.readFileSync(agentsFile,'utf-8') : '';
    const targetSkills = fs.existsSync(skillsFile) ? fs.readFileSync(skillsFile,'utf-8') : '';
    if(!name){ return res.json({ agentsDiff:'', skillsDiff:'' }); }
    const src = path.join(backupDir, name); if(!fs.existsSync(src)) return res.status(404).json({ error:'not found' });
    const backupText = fs.readFileSync(src,'utf-8');
    const isAgents = name.startsWith('agents');
    const agentsDiff = isAgents ? diffText(backupText, targetAgents) : '';
    const skillsDiff = !isAgents ? diffText(backupText, targetSkills) : '';
    res.json({ agentsDiff, skillsDiff });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});
app.post('/api/agents/rollback-group', async (req,res)=>{
  try{
    ensureDirs();
    const { names } = req.body||{}; if(!Array.isArray(names) || !names.length) return res.status(400).json({ error:'missing names[]' });
    const ts = Date.now(); if (fs.existsSync(agentsFile)) fs.copyFileSync(agentsFile, path.join(backupDir, `agents.${ts}.yml`)); if (fs.existsSync(skillsFile)) fs.copyFileSync(skillsFile, path.join(backupDir, `skills.${ts}.yml`));
for(const nm of names){ const src = path.join(backupDir, nm); if(fs.existsSync(src)){ if(nm.startsWith('agents')) fs.copyFileSync(src, agentsFile); else if(nm.startsWith('skills')) fs.copyFileSync(src, skillsFile); } }
    logChange('rollback', { names });
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

// Skills usage stats
app.get('/api/skills/usage', async (_req,res)=>{
  try{ const agents = await readYAMLList(agentsFile,'agents'); const usage={}; for(const a of agents){ for(const s of (a.skills||[])){ usage[s] = usage[s] || { usedBy:[], count:0 }; usage[s].usedBy.push(a.name); usage[s].count++; } } res.json({ usage }); }catch(e){ res.status(500).json({ error:String(e) }); }
});
// Changelog read
app.get('/api/agents/changelog', (_req,res)=>{
  try{ if(!fs.existsSync(changeLogFile)) return res.json({ entries: [] }); const lines = fs.readFileSync(changeLogFile,'utf-8').trim().split('\n').filter(Boolean); const last = lines.slice(-200).map(l=>{ try{return JSON.parse(l);}catch{return null} }).filter(Boolean); res.json({ entries:last }); }catch(e){ res.status(500).json({ error:String(e) }); }
});
// Export one JSON/YAML
app.get('/api/agents/export-one', async (req,res)=>{
  try{ const name = (req.query.name||'').trim(); if(!name) return res.status(400).json({ error:'missing name' }); const agents = await readYAMLList(agentsFile,'agents'); const a = agents.find(x=>x?.name===name); if(!a) return res.status(404).json({ error:'not found' }); const fmt = String(req.query.format||'json').toLowerCase(); if(fmt==='yaml'){ const YAML = (await import('yaml')).default; const text = YAML.stringify({ agents:[a] }); res.setHeader('Content-Type','text/plain'); return res.send(text); } return res.json(a); }catch(e){ res.status(500).json({ error:String(e) }); }
});
app.get('/api/skills/export-one', async (req,res)=>{
  try{ const name = (req.query.name||'').trim(); if(!name) return res.status(400).json({ error:'missing name' }); const skills = await readYAMLList(skillsFile,'skills'); const s = skills.find(x=>x?.name===name); if(!s) return res.status(404).json({ error:'not found' }); const fmt = String(req.query.format||'json').toLowerCase(); if(fmt==='yaml'){ const YAML = (await import('yaml')).default; const text = YAML.stringify({ skills:[s] }); res.setHeader('Content-Type','text/plain'); return res.send(text); } return res.json(s); }catch(e){ res.status(500).json({ error:String(e) }); }
});
// Connectors test stub
app.post('/api/connectors/test', (req,res)=>{ try{ const { type, config } = req.body||{}; res.json({ ok:true, type, echo: config||{} }); }catch(e){ res.status(500).json({ error:String(e) }); } });

// Agent logs (last N entries)
app.get('/api/agents/logs', (req,res)=>{
  try{ const agent = (req.query.agent||'').trim(); const limit = Math.max(1, Math.min(500, parseInt(req.query.limit||'100',10))); if(!agent) return res.status(400).json({ error:'missing agent' }); if(!fs.existsSync(eventsFile)) return res.json({ events:[] }); const lines = fs.readFileSync(eventsFile,'utf-8').trim().split('\n').filter(Boolean).reverse(); const out=[]; for(const line of lines){ try{ const ev = JSON.parse(line); if(ev.agent===agent){ out.push(ev); if(out.length>=limit) break; } }catch{} } res.json({ events: out.reverse() }); }catch(e){ res.status(500).json({ error:String(e) }); }
});
app.get('/api/agents/history', (_req, res) => {
  try {
    if (!fs.existsSync(backupDir)) return res.json({ backups: [] });
    const files = fs.readdirSync(backupDir).filter(f=>/^(agents|skills)\.\d+\.yml$/.test(f)).map(name=>({ name, ts: parseInt(name.split('.')[1],10), kind: name.startsWith('agents')?'agents':'skills' }));
    res.json({ backups: files.sort((a,b)=>b.ts-a.ts).slice(0,100) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/agents/rollback', async (req, res) => {
  try {
    ensureDirs();
    const { name } = req.body||{}; if(!name) return res.status(400).json({ error:'missing name' });
    const src = path.join(backupDir, name);
    if (!fs.existsSync(src)) return res.status(404).json({ error:'not found' });
    const ts = Date.now();
    const target = name.startsWith('agents') ? agentsFile : skillsFile;
    if (fs.existsSync(target)) fs.copyFileSync(target, path.join(backupDir, `${name.split('.')[0]}.${ts}.yml`));
    fs.copyFileSync(src, target);
    res.json({ ok:true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.get('/api/agents/status', async (req, res) => {
  try {
    const windowSec = (req.query.window? parseInt(req.query.window,10) : 3600) || 3600;
    const agents = await readYAMLList(agentsFile, 'agents');
    const names = agents.map(a=>a.name||a.id||a.role||'');
const status = {};
    if (fs.existsSync(eventsFile)){
      const lines = fs.readFileSync(eventsFile,'utf-8').trim().split('\n').filter(Boolean).slice(-5000);
      const now = Date.now()/1000;
      for(const n of names){ status[n] = { lastTs: null, healthy: false, lastError: null, traffic: 0, errors:0, calls:0, avgLatencyMs:0 }; }
      const reqTs = {};
      for(const line of lines){ try{ const ev = JSON.parse(line); const an = ev.agent||null; if(!an || !status[an]) continue; if(typeof ev.ts==='number' && (now - ev.ts) <= windowSec){
            status[an].traffic++;
            if(ev.status==='error'){ status[an].errors++; status[an].lastError = ev; }
            status[an].lastTs = Math.max(status[an].lastTs||0, ev.ts||0);
            if(ev.kind==='agent_request'){ reqTs[an] = reqTs[an]||[]; reqTs[an].push(ev.ts); }
            if(ev.kind==='agent_response' && reqTs[an] && reqTs[an].length){ const start = reqTs[an].shift(); if(typeof start==='number'){ const ms = Math.max(0, (ev.ts - start)*1000); const s=status[an]; s.calls++; s.avgLatencyMs = ((s.avgLatencyMs*(s.calls-1))+ms)/s.calls; } }
          } } catch{} }
      for(const n of Object.keys(status)){ const s = status[n]; s.healthy = !!(s.lastTs && (now - s.lastTs) < windowSec && !s.lastError); }
    }
    res.json({ status });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/agents/reload', (_req, res) => {
  try { const ev = { ts: Date.now()/1000, kind:'agents_reload', status:'ok', data:{ by:'ui' } }; fs.appendFileSync(eventsFile, JSON.stringify(ev)+'\n','utf-8'); res.json({ ok:true }); } catch (e) { res.status(500).json({ error:String(e) }); }
});
app.post('/api/agents/test', async (req, res) => {
  try {
    const { agent, prompt } = req.body||{}; if(!agent) return res.status(400).json({ error:'missing agent' });
    const now = Date.now()/1000; const logs = [];
    const write = (obj)=>{ const line = JSON.stringify(obj); fs.appendFileSync(eventsFile, line+'\n','utf-8'); logs.push(line); };
    write({ ts: now, kind:'agent_test_start', status:'ok', agent, data:{ prompt: (prompt||'').slice(0,200) } });
    write({ ts: now+0.1, kind:'agent_test_output', status:'ok', agent, data:{ message:'Test executed (stub)' } });
    write({ ts: now+0.2, kind:'agent_test_end', status:'ok', agent });
    res.json({ ok:true, logs });
  } catch (e) { res.status(500).json({ error:String(e) }); }
});

// Skills alias endpoints
app.get('/api/skills', async (_req, res) => { try{ const skills = await readYAMLList(skillsFile,'skills'); res.json({ skills }); } catch(e){ res.status(500).json({ error:String(e) }); } });
app.post('/api/skills/save', async (req, res) => { try{ ensureDirs(); const { skills } = req.body||{}; await writeYAMLList(skillsFile,'skills', skills||[]); res.json({ ok:true }); } catch(e){ res.status(500).json({ error:String(e) }); } });
app.get('/api/skills/history', (req,res)=>{ try{ if(!fs.existsSync(backupDir)) return res.json({ backups:[] }); const files = fs.readdirSync(backupDir).filter(f=>/^skills\.\d+\.yml$/.test(f)).map(name=>({ name, ts: parseInt(name.split('.')[1],10) })); res.json({ backups: files.sort((a,b)=>b.ts-a.ts)}); } catch(e){ res.status(500).json({ error:String(e) }); } });
app.post('/api/skills/rollback', (req,res)=>{ try{ ensureDirs(); const { name } = req.body||{}; const src = path.join(backupDir, name); if(!fs.existsSync(src)) return res.status(404).json({ error:'not found' }); fs.copyFileSync(src, skillsFile); res.json({ ok:true }); } catch(e){ res.status(500).json({ error:String(e) }); } });

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send last 50 lines if exists
  try {
    if (fs.existsSync(eventsFile)) {
      const content = fs.readFileSync(eventsFile, 'utf-8').trim().split('\n');
      const tail = content.slice(-50);
      for (const line of tail) {
        res.write(`data: ${line}\n\n`);
      }
    }
  } catch {}

  const watcher = chokidar.watch(eventsFile, { persistent: true, ignoreInitial: true });
  const onChange = () => {
    try {
      const stream = fs.createReadStream(eventsFile, { encoding: 'utf-8', start: fs.statSync(eventsFile).size - 1024*64 });
      let buffer = '';
      stream.on('data', chunk => { buffer += chunk; });
      stream.on('end', () => {
        const lines = buffer.trim().split('\n');
        for (const line of lines) res.write(`data: ${line}\n\n`);
      });
    } catch {}
  };
  watcher.on('change', onChange);

  req.on('close', () => {
    watcher.close().catch(()=>{});
    res.end();
  });
});

// Append custom events (for UI interactions / approvals simulation)
app.post('/api/events/append', (req, res) => {
  try {
    const payload = req.body || {};
    const line = JSON.stringify(payload);
    fs.appendFileSync(eventsFile, line + '\n', 'utf-8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Artifacts API
app.get('/api/artifact/plan', (_req, res) => {
  try {
    const planPath = path.join(runtimeDir, 'plan.md');
    const content = fs.existsSync(planPath) ? fs.readFileSync(planPath, 'utf-8') : '';
    res.json({ content });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
app.get('/api/artifacts', (_req, res) => {
  try {
    const result = [];
    if (fs.existsSync(runtimeDir)) {
      const allowed = new Set(['.md', '.json', '.txt', '.diff', '.log']);
      for (const name of fs.readdirSync(runtimeDir)) {
        const ext = path.extname(name).toLowerCase();
        if (!allowed.has(ext)) continue;
        const p = path.join(runtimeDir, name);
        if (fs.statSync(p).isFile()) {
          const st = fs.statSync(p);
          result.push({ name, size: st.size, mtime: st.mtimeMs });
        }
      }
    }
    res.json({ files: result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
app.get('/api/artifact/download/:name', (req, res) => {
  const name = req.params.name;
  const p = path.join(runtimeDir, name);
  if (!fs.existsSync(p)) return res.status(404).end();
  res.setHeader('Content-Type', 'text/plain');
  fs.createReadStream(p).pipe(res);
});
app.get('/api/artifact/raw/:name', (req, res) => {
  try {
    const name = req.params.name;
    const p = path.join(runtimeDir, name);
    if (!fs.existsSync(p)) return res.status(404).end();
    res.setHeader('Content-Type', 'text/plain');
    res.send(fs.readFileSync(p, 'utf-8'));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Run E2E scenarios from UI (best-effort)
function runScenario(script) {
  const scriptPath = path.join(__dirname, '../../tools/e2e', script);
  const cmd = process.platform === 'win32' ? 'python' : 'python3';
  const logPath = path.join(runtimeDir, 'console.log');
  const out = fs.createWriteStream(logPath, { flags: 'a' });
  const child = spawn(cmd, [scriptPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => out.write(`[stdout] ${String(d)}`));
  child.stderr.on('data', (d) => out.write(`[stderr] ${String(d)}`));
  child.on('close', (code) => { out.write(`[close] code=${code}\n`); out.end(); });
}
app.post('/api/run/:name', (req, res) => {
  const name = req.params.name;
  const map = { happy: 'run_happy.py', escalation: 'run_escalation.py', edge: 'run_edge.py' };
  const script = map[name];
  if (!script) return res.status(400).json({ error: 'unknown scenario' });
  try { runScenario(script); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Run segments (start..end) and export
app.get('/api/runs/segments', (_req, res) => {
  try {
    if (!fs.existsSync(eventsFile)) return res.json({ runs: [] });
    const lines = fs.readFileSync(eventsFile, 'utf-8').trim().split('\n').filter(Boolean);
    const runs = [];
    let current = null; let idx = 0;
    for (let i=0;i<lines.length;i++){
      const ev = JSON.parse(lines[i]);
      if (ev.kind === 'start') {
        const runId = (ev.data && (ev.data.runId || ev.data.run_id)) || null;
        current = { idx: idx++, runId, startLine: i, startTs: ev.ts, count:0, errors:0, approvals:0 };
      }
      if (current) {
        current.count++;
        if (ev.status==='error') current.errors++;
        if (ev.status==='awaiting_approval') current.approvals++;
      }
      if (ev.kind === 'end' && current) { current.endLine = i; current.endTs = ev.ts; runs.push(current); current = null; }
    }
    res.json({ runs });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// KPI aggregation endpoint
function parseWindowParam(q){
  const w = String(q.window||'15m').toLowerCase();
  if (w.endsWith('m')) return Math.max(1, parseInt(w,10)) * 60; // seconds
  if (w.endsWith('h')) return Math.max(1, parseInt(w,10)) * 3600;
  if (w.endsWith('d')) return Math.max(1, parseInt(w,10)) * 86400;
  const n = parseInt(w,10); return isNaN(n) ? 900 : n; // default 15m
}
function median(arr){ if(!arr.length) return 0; const a = [...arr].sort((x,y)=>x-y); const m = Math.floor(a.length/2); return a.length%2 ? a[m] : (a[m-1]+a[m])/2; }
app.get('/api/kpi', (req, res) => {
  try {
    if (!fs.existsSync(eventsFile)) return res.json({ window: req.query.window||'15m', runId: req.query.runId||null, metrics: {} });
    const windowSec = parseWindowParam(req.query);
    const nowSec = Date.now()/1000;
    const since = nowSec - windowSec;
    const runFilter = (req.query.runId||'').trim() || null;
    const lines = fs.readFileSync(eventsFile, 'utf-8').trim().split('\n').filter(Boolean);

    // Collect events in window, optionally filter by runId
    const events = [];
    for (const line of lines){
      try { const ev = JSON.parse(line); if (typeof ev.ts !== 'number' || ev.ts < since) continue; if (runFilter){ const rid = (ev.data && (ev.data.runId||ev.data.run_id)) || null; if (rid !== runFilter) continue; } events.push(ev); } catch {}
    }

    // Group by runId for per-run metrics
    const byRun = new Map();
    for (const ev of events){
      const rid = (ev.data && (ev.data.runId||ev.data.run_id)) || 'unknown';
      if (!byRun.has(rid)) byRun.set(rid, []);
      byRun.get(rid).push(ev);
    }

    // Success rate and avg actions/run (consider runs that started in window)
    let started = 0, completedOk = 0, totalActions = 0, runCountForActions = 0;
    const approvalWaits = [];
    const perAgentPhaseTime = {}; // key `${phase}:${agent}` -> seconds
    const sparkline = []; // minute buckets counts for events density
    const buckets = Math.max(1, Math.floor(windowSec/60));
    for (let i=0;i<buckets;i++) sparkline.push(0);

    for (const ev of events){ const dt = Math.floor((nowSec - (ev.ts||nowSec))/60); if (dt>=0 && dt<buckets) sparkline[buckets-1-dt]++; }

    for (const [rid, evs] of byRun){
      // sort by ts
      evs.sort((a,b)=> (a.ts||0)-(b.ts||0));
      const startEv = evs.find(e=>e.kind==='start');
      if (startEv) started++;
      // actions count
      const actions = evs.filter(e=> e.kind==='action_proposed').length;
      if (startEv){ totalActions += actions; runCountForActions++; }
      // success detection
      const endEv = [...evs].reverse().find(e=> e.kind==='end');
      if (startEv && endEv){ if ((endEv.status||'ok') !== 'error'){ completedOk++; } }
      // approval waits (pair action_proposed -> approval_granted)
      const approvals = evs.filter(e=> e.kind==='approval_granted');
      const actionsManual = evs.filter(e=> e.kind==='action_proposed' && ((e.data&&e.data.approval)==='manual'));
      for (const a of actionsManual){
        const aid = (a.data&&a.data.actionId)||null;
        const match = approvals.find(x=> { const xid = (x.data&&x.data.actionId)||null; return aid ? (xid===aid) : true; });
        if (match && typeof a.ts==='number' && typeof match.ts==='number' && match.ts>=a.ts) approvalWaits.push(match.ts - a.ts);
      }
      // time per phase×agent via adjacent deltas
      for (let i=0;i<evs.length-1;i++){
        const e = evs[i], n = evs[i+1];
        if (typeof e.ts==='number' && typeof n.ts==='number' && e.phase){
          const key = `${e.phase}:${e.agent||''}`;
          perAgentPhaseTime[key] = (perAgentPhaseTime[key]||0) + Math.max(0, n.ts - e.ts);
        }
      }
    }

    const metrics = {
      window: req.query.window||'15m',
      runId: runFilter,
      startedRuns: started,
      successRate: started ? (completedOk/started) : 0,
      avgActionsPerRun: runCountForActions ? (totalActions/runCountForActions) : 0,
      medianTimeToApprovalSec: median(approvalWaits),
      maxApprovalWaitSec: approvalWaits.length ? Math.max(...approvalWaits) : 0,
      perAgentPhaseTimeSec: perAgentPhaseTime,
      sparklinePerMin: sparkline,
    };

    const format = String(req.query.format||'json').toLowerCase();
    if (format==='csv'){
      // Flat CSV for top-level metrics; perAgentPhaseTime serialized as JSON
      const csv = [
        'window,runId,startedRuns,successRate,avgActionsPerRun,medianTimeToApprovalSec,maxApprovalWaitSec,perAgentPhaseTimeSec,sparklinePerMin',
        `${metrics.window},${metrics.runId||''},${metrics.startedRuns},${metrics.successRate},${metrics.avgActionsPerRun},${metrics.medianTimeToApprovalSec},${metrics.maxApprovalWaitSec},"${JSON.stringify(metrics.perAgentPhaseTimeSec).replace(/"/g,'\"')}","${JSON.stringify(metrics.sparklinePerMin).replace(/"/g,'\"')}"`
      ].join('\n');
      res.setHeader('Content-Type','text/csv');
      return res.send(csv);
    }

    res.json({ metrics });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
function exportRunSlice(idx){
  if (!fs.existsSync(eventsFile)) return null;
  const lines = fs.readFileSync(eventsFile, 'utf-8').trim().split('\n').filter(Boolean);
  let cur = -1; let start=-1; let end=-1;
  for (let i=0;i<lines.length;i++){
    const ev = JSON.parse(lines[i]);
    if (ev.kind==='start'){ cur++; if (cur===idx) start=i; }
    if (ev.kind==='end' && cur===idx){ end=i; break; }
  }
  if (start===-1) return null;
  return lines.slice(start, end===-1? lines.length : end+1);
}
app.get('/api/runs/export/:idx', (req, res) => {
  try {
    const idx = parseInt(req.params.idx, 10);
    const slice = exportRunSlice(idx);
    if (!slice) return res.status(404).end();
    res.setHeader('Content-Type', 'text/plain');
    res.send(slice.join('\n'));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/runs/replay/:idx', (req, res) => {
  try {
    const idx = parseInt(req.params.idx, 10);
    const slice = exportRunSlice(idx);
    if (!slice) return res.status(404).json({ error: 'not found' });
    const goal = (req.body||{}).goal || undefined;
    const constraints = (req.body||{}).constraints || undefined;
    const newRun = (Math.random().toString(16).slice(2,10));
    const now = Date.now()/1000;
    const out = [];
    for (let j=0;j<slice.length;j++){
      const ev = JSON.parse(slice[j]);
      ev.ts = now + j*0.01;
      ev.data = ev.data || {};
      ev.data.runId = newRun;
      if (j===0 && ev.kind==='start'){
        ev.data.replayOf = (ev.data && ev.data.runId) || 'unknown';
        if (goal) ev.data.goal = goal;
        if (constraints) ev.data.constraints = constraints;
      }
      out.push(JSON.stringify(ev));
    }
    fs.appendFileSync(eventsFile, out.join('\n')+'\n', 'utf-8');
    res.json({ ok: true, runId: newRun });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Console tail
app.get('/api/console', (req, res) => {
  try {
    const logPath = path.join(runtimeDir, 'console.log');
    if (!fs.existsSync(logPath)) return res.json({ content: '' });
    const size = fs.statSync(logPath).size; const start = Math.max(0, size - 1024 * 64);
    const fd = fs.openSync(logPath, 'r'); const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start); fs.closeSync(fd);
    res.json({ content: buf.toString('utf-8') });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/clear-console', (_req, res) => {
  try { const logPath = path.join(runtimeDir, 'console.log'); fs.writeFileSync(logPath, '', 'utf-8'); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Theme persist
const themeFile = path.join(runtimeDir, 'theme.txt');
app.get('/api/theme', (_req, res) => {
  try { const t = fs.existsSync(themeFile) ? fs.readFileSync(themeFile, 'utf-8').trim() : 'dark'; res.json({ theme: t || 'dark' }); } catch { res.json({ theme: 'dark' }); }
});
app.post('/api/theme', (req, res) => {
  try { const t = (req.body || {}).theme || 'dark'; fs.writeFileSync(themeFile, t, 'utf-8'); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Approval mode persist ('strict'|'permissive')
const approvalModeFile = path.join(runtimeDir, 'approval_mode.txt');
app.get('/api/approval-mode', (_req, res) => {
  try { const m = fs.existsSync(approvalModeFile) ? fs.readFileSync(approvalModeFile, 'utf-8').trim() : 'strict'; res.json({ mode: m || 'strict' }); } catch { res.json({ mode: 'strict' }); }
});
app.post('/api/approval-mode', (req, res) => {
  try { const m = (req.body || {}).mode || 'strict'; fs.writeFileSync(approvalModeFile, m, 'utf-8'); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.listen(PORT, () => {
  if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
  if (!fs.existsSync(eventsFile)) fs.writeFileSync(eventsFile, '', 'utf-8');
  console.log(`[dashboard] listening on http://localhost:${PORT}`);
});
