import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { scaffoldProject, getAvailableTemplates } from './lib/scaffolder.js';
import { analyzeCodebase } from './lib/analyzer.js';
import { optimizeProject } from './lib/optimizer.js';
import CodeWatcher from './lib/code-watcher.js';
import { spawn } from 'child_process';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3030;
const runtimeDir = path.resolve(__dirname, '../../runtime');
const eventsFile = path.join(runtimeDir, 'events.jsonl');
const changeLogFile = path.join(runtimeDir, 'agents_changes.jsonl');
const versionPtrFile = path.join(runtimeDir, 'agents_version.txt');

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
    // advance pointer to latest backup (agents wins if present)
    const ptr = beforeAgents || beforeSkills || '';
    if(ptr) fs.writeFileSync(versionPtrFile, ptr, 'utf-8');
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
    const ptr = beforeAgents || beforeSkills || '';
    if(ptr) fs.writeFileSync(versionPtrFile, ptr, 'utf-8');
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
    // set pointer to last applied name
    fs.writeFileSync(versionPtrFile, names[names.length-1], 'utf-8');
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

// Marketplace: import skills by URL (preview only)
app.post('/api/skills/import-url', async (req,res)=>{
  try{
    const { url } = req.body||{}; if(!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error:'invalid url' });
    const { default: fetch } = await import('node-fetch');
    const r = await fetch(url, { redirect:'follow' }); if(!r.ok) return res.status(400).json({ error:`fetch failed ${r.status}` });
    const text = await r.text(); const trimmed = text.trim(); let skills=[];
    try{
      if(trimmed.startsWith('{') || trimmed.startsWith('[')){
        const parsed = JSON.parse(trimmed); if(Array.isArray(parsed)) skills = parsed; else if(Array.isArray(parsed.skills)) skills = parsed.skills; else return res.status(400).json({ error:'no skills array found' });
      } else {
        const YAML = (await import('yaml')).default; const y = YAML.parse(trimmed); if(Array.isArray(y)) skills = y; else if(Array.isArray(y.skills)) skills = y.skills; else return res.status(400).json({ error:'no skills array found' });
      }
    } catch(e){ return res.status(400).json({ error: 'parse failed', details:String(e) }); }
    // validate shape roughly
    const bad = skills.filter(s=> !s || !s.name);
    if(bad.length) return res.status(400).json({ error:'invalid skills entries' });
    res.json({ ok:true, skills });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

// Agent logs (last N entries)
app.get('/api/agents/logs', (req,res)=>{
  try{ const agent = (req.query.agent||'').trim(); const limit = Math.max(1, Math.min(500, parseInt(req.query.limit||'100',10))); if(!agent) return res.status(400).json({ error:'missing agent' }); if(!fs.existsSync(eventsFile)) return res.json({ events:[] }); const lines = fs.readFileSync(eventsFile,'utf-8').trim().split('\n').filter(Boolean).reverse(); const out=[]; for(const line of lines){ try{ const ev = JSON.parse(line); if(ev.agent===agent){ out.push(ev); if(out.length>=limit) break; } }catch{} } res.json({ events: out.reverse() }); }catch(e){ res.status(500).json({ error:String(e) }); }
});
app.get('/api/agents/history', (_req, res) => {
  try {
    if (!fs.existsSync(backupDir)) return res.json({ backups: [] });
    const files = fs.readdirSync(backupDir).filter(f=>/^(agents|skills)\.\d+\.yml$/.test(f)).map(name=>({ name, ts: parseInt(name.split('.')[1],10), kind: name.startsWith('agents')?'agents':'skills' }));
    res.json({ backups: files.sort((a,b)=>b.ts-a.ts).slice(0,200) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
// Versions pointer + undo/redo
function listBackups(){ if (!fs.existsSync(backupDir)) return []; return fs.readdirSync(backupDir).filter(f=>/^(agents|skills)\.\d+\.yml$/.test(f)).map(name=>({ name, ts: parseInt(name.split('.')[1],10), kind: name.startsWith('agents')?'agents':'skills' })).sort((a,b)=>a.ts-b.ts); }
app.get('/api/agents/versions', (_req,res)=>{
  try { const backups = listBackups(); const ptr = fs.existsSync(versionPtrFile) ? fs.readFileSync(versionPtrFile,'utf-8').trim() : (backups.length? backups[backups.length-1].name : null); res.json({ backups, pointer: ptr }); } catch(e){ res.status(500).json({ error:String(e) }); }
});
function applyBackupByName(name){ const src = path.join(backupDir, name); if(!fs.existsSync(src)) return false; if(name.startsWith('agents')) fs.copyFileSync(src, agentsFile); else if(name.startsWith('skills')) fs.copyFileSync(src, skillsFile); return true; }
app.post('/api/agents/undo', (req,res)=>{
  try{ const backups = listBackups(); if(!backups.length) return res.json({ ok:false, error:'no backups' }); const cur = fs.existsSync(versionPtrFile) ? fs.readFileSync(versionPtrFile,'utf-8').trim() : backups[backups.length-1].name; const idx = Math.max(0, backups.findIndex(b=>b.name===cur)-1); const name = backups[idx].name; if(!applyBackupByName(name)) return res.json({ ok:false }); fs.writeFileSync(versionPtrFile, name, 'utf-8'); logChange('undo',{ to:name }); res.json({ ok:true, to:name }); } catch(e){ res.status(500).json({ error:String(e) }); }
});
app.post('/api/agents/redo', (req,res)=>{
  try{ const backups = listBackups(); if(!backups.length) return res.json({ ok:false, error:'no backups' }); const cur = fs.existsSync(versionPtrFile) ? fs.readFileSync(versionPtrFile,'utf-8').trim() : backups[backups.length-1].name; const idx = Math.min(backups.length-1, backups.findIndex(b=>b.name===cur)+1); const name = backups[idx].name; if(!applyBackupByName(name)) return res.json({ ok:false }); fs.writeFileSync(versionPtrFile, name, 'utf-8'); logChange('redo',{ to:name }); res.json({ ok:true, to:name }); } catch(e){ res.status(500).json({ error:String(e) }); }
});
app.get('/api/agents/backup-content', (req,res)=>{
  try{ const name = (req.query.name||'').trim(); if(!name) return res.status(400).end(); const p = path.join(backupDir, name); if(!fs.existsSync(p)) return res.status(404).end(); res.setHeader('Content-Type','text/plain'); res.send(fs.readFileSync(p,'utf-8')); } catch(e){ res.status(500).json({ error:String(e) }); }
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
// Agent-specific KPI aggregation
app.get('/api/agents/kpi', (req,res)=>{
  try{
    const agent = (req.query.agent||'').trim(); if(!agent) return res.status(400).json({ error:'missing agent' });
    const windowSec = (req.query.window? parseInt(req.query.window,10) : 3600) || 3600;
    if (!fs.existsSync(eventsFile)) return res.json({ agent, metrics:{} });
    const nowSec = Date.now()/1000; const since = nowSec - windowSec;
    const lines = fs.readFileSync(eventsFile,'utf-8').trim().split('\n').filter(Boolean);
    const evs = [];
    for(const line of lines){ try{ const ev = JSON.parse(line); if((ev.agent||'')===agent && typeof ev.ts==='number' && ev.ts>=since) evs.push(ev); }catch{} }
    // metrics
    let calls=0, errors=0; let latList=[]; const waits=[]; const buckets = new Array(Math.max(1, Math.floor(windowSec/60))).fill(0);
    const reqQ = [];
    for(const ev of evs){ const dt = Math.floor((nowSec - (ev.ts||nowSec))/60); if(dt>=0 && dt<buckets.length) buckets[buckets.length-1-dt]++; if(ev.kind==='agent_request') reqQ.push(ev.ts); if(ev.kind==='agent_response'){ const start = reqQ.shift(); if(typeof start==='number'){ latList.push((ev.ts-start)*1000); calls++; } }
      if(ev.status==='error') errors++; }
    // approval waits
    const approvals = evs.filter(e=> e.kind==='approval_granted');
    const actionsManual = evs.filter(e=> e.kind==='action_proposed' && ((e.data&&e.data.approval)==='manual'));
    for(const a of actionsManual){ const aid = (a.data&&a.data.actionId)||null; const m = approvals.find(x=> { const xid=(x.data&&x.data.actionId)||null; return aid? (xid===aid):true; }); if(m && m.ts>=a.ts) waits.push(m.ts-a.ts); }
    const median = (arr)=>{ if(!arr.length) return 0; const s=[...arr].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2? s[m] : (s[m-1]+s[m])/2; };
    const successRate = calls? (1 - (errors/calls)) : 0;
    res.json({ agent, metrics:{ calls, errors, avgLatencyMs: latList.length? (latList.reduce((a,b)=>a+b,0)/latList.length) : 0, medianTimeToApprovalSec: median(waits), successRate, sparklinePerMin: buckets } });
  } catch(e){ res.status(500).json({ error:String(e) }); }
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

// SSE for changelog (agents_changes.jsonl)
app.get('/agents-changes', (req,res)=>{
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.flushHeaders();
  try{ if(fs.existsSync(changeLogFile)){ const lines = fs.readFileSync(changeLogFile,'utf-8').trim().split('\n').slice(-50); for(const l of lines){ res.write(`data: ${l}\n\n`);} } }catch{}
  const watcher = chokidar.watch(changeLogFile,{ persistent:true, ignoreInitial:true });
  const onChange = ()=>{ try{ const content = fs.readFileSync(changeLogFile,'utf-8').trim().split('\n'); const tail = content.slice(-20); for(const l of tail) res.write(`data: ${l}\n\n`); }catch{} };
  watcher.on('change', onChange);
  req.on('close', ()=>{ watcher.close().catch(()=>{}); res.end(); });
});

// Remote terminal (JSONL + SSE)
const termLogFile = path.join(runtimeDir, 'terminal.jsonl');
app.get('/terminal-stream', (req,res)=>{
  res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache'); res.setHeader('Connection','keep-alive'); res.flushHeaders();
  try{ if(fs.existsSync(termLogFile)){ const lines = fs.readFileSync(termLogFile,'utf-8').trim().split('\n').slice(-200); for(const l of lines){ res.write(`data: ${l}\n\n`);} } }catch{}
  const watcher = chokidar.watch(termLogFile,{ persistent:true, ignoreInitial:true });
  watcher.on('change', ()=>{ try{ const content = fs.readFileSync(termLogFile,'utf-8').trim().split('\n'); const tail = content.slice(-50); for(const l of tail) res.write(`data: ${l}\n\n`); }catch{} });
  req.on('close', ()=>{ watcher.close().catch(()=>{}); res.end(); });
});
app.get('/api/terminal/history', (_req,res)=>{ try{ const lines = fs.existsSync(termLogFile)? fs.readFileSync(termLogFile,'utf-8').trim().split('\n').filter(Boolean).slice(-500).map(l=>JSON.parse(l)) : []; res.json({ entries: lines }); } catch(e){ res.status(500).json({ error:String(e) }); } });
app.post('/api/terminal/clear', (_req,res)=>{ try{ fs.writeFileSync(termLogFile,'','utf-8'); res.json({ ok:true }); }catch(e){ res.status(500).json({ error:String(e) }); } });
const termFavFile = path.join(runtimeDir, 'terminal_favorites.json');
app.get('/api/terminal/favorites', (_req,res)=>{ try{ const j = fs.existsSync(termFavFile)? JSON.parse(fs.readFileSync(termFavFile,'utf-8')||'[]') : []; res.json({ favorites:j }); }catch(e){ res.status(500).json({ error:String(e) }); } });
app.post('/api/terminal/favorites', (req,res)=>{ try{ const favs = Array.isArray((req.body||{}).favorites)? (req.body||{}).favorites : []; fs.writeFileSync(termFavFile, JSON.stringify(favs,null,2),'utf-8'); res.json({ ok:true }); }catch(e){ res.status(500).json({ error:String(e) }); } });
app.post('/api/terminal/exec', (req,res)=>{
  try{
    const { cmd, cwd, env } = req.body||{}; if(!cmd) return res.status(400).json({ error:'missing cmd' });
    const shell = process.platform==='win32' ? 'pwsh' : 'bash';
    const args = process.platform==='win32' ? ['-NoLogo','-NoProfile','-Command', cmd] : ['-lc', cmd];
    const child = spawn(shell, args, { cwd: cwd||repoRoot, env: { ...process.env, ...(env||{}) } });
    const append = (obj)=>{ const line = JSON.stringify({ ts: Date.now()/1000, ...obj }); fs.appendFileSync(termLogFile, line+'\n','utf-8'); };
    append({ kind:'term_start', cmd });
    child.stdout.on('data', d=> append({ kind:'term', stream:'stdout', data: String(d) }));
    child.stderr.on('data', d=> append({ kind:'term', stream:'stderr', data: String(d) }));
    child.on('close', code=> append({ kind:'term_end', code }));
    // audit to events as well
    fs.appendFileSync(eventsFile, JSON.stringify({ ts: Date.now()/1000, kind:'terminal_exec', status:'ok', data:{ cmd }})+'\n','utf-8');
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

// Prompt factory
const promptLogFile = path.join(runtimeDir, 'prompts.jsonl');
app.get('/api/prompts', (_req,res)=>{ try{ const lines = fs.existsSync(promptLogFile)? fs.readFileSync(promptLogFile,'utf-8').trim().split('\n').filter(Boolean).slice(-200).map(l=>JSON.parse(l)) : []; res.json({ entries: lines }); }catch(e){ res.status(500).json({ error:String(e) }); } });
app.post('/api/prompts/save', (req,res)=>{ try{ const { id, title, body, tags, model, notes } = req.body||{}; const promptId = id || Math.random().toString(16).slice(2,10); const rec = { ts: Date.now()/1000, id: promptId, title, body, tags: tags||[], model: model||'router', notes: notes||'', version: 1 }; fs.appendFileSync(promptLogFile, JSON.stringify({ kind:'prompt_save', ...rec })+'\n','utf-8'); const db = loadPromptsDb(); db[promptId] = rec; savePromptsDb(db); res.json({ ok:true, id: promptId }); }catch(e){ res.status(500).json({ error:String(e) }); } });
app.post('/api/prompts/run', (req,res)=>{ try{ const { id, body, model, optimizeIdea } = req.body||{}; const promptText = body||''; const out = `[stub:${model||'router'}] ${promptText.slice(0,200)}\nSuggestion: ${optimizeIdea||''}`; const now=Date.now()/1000; const evReq = { ts: now, kind:'agent_request', status:'ok', agent:'prompt_factory', data:{ model:model||'router', prompt: promptText.slice(0,200)} }; const evRes = { ts: now+0.05, kind:'agent_response', status:'ok', agent:'prompt_factory', data:{ output: out } }; fs.appendFileSync(eventsFile, JSON.stringify(evReq)+'\n','utf-8'); fs.appendFileSync(eventsFile, JSON.stringify(evRes)+'\n','utf-8'); fs.appendFileSync(promptLogFile, JSON.stringify({ kind:'prompt_run', ts: now, id: id||null, body: promptText, model: model||null, optimizeIdea: optimizeIdea||null, output: out })+'\n','utf-8'); res.json({ ok:true, output: out }); }catch(e){ res.status(500).json({ error:String(e) }); } });
app.get('/api/prompts/export', (req,res)=>{ try{ const fmt=String(req.query.format||'json'); const lines = fs.existsSync(promptLogFile)? fs.readFileSync(promptLogFile,'utf-8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)) : []; if(fmt==='csv'){ const rows=['ts,kind,id,title,tags']; for(const r of lines){ rows.push(`${r.ts||''},${r.kind||''},${r.id||''},"${(r.title||'').replace(/"/g,'\\"')}","${(Array.isArray(r.tags)?r.tags.join('|'):'').replace(/"/g,'\\"')}"`);} res.setHeader('Content-Type','text/csv'); return res.send(rows.join('\n')); } res.json({ entries: lines }); }catch(e){ res.status(500).json({ error:String(e) }); } });

// Prompt Library Pro - Extended APIs
const promptsDbFile = path.join(runtimeDir, 'prompts_db.json');
function loadPromptsDb(){ try{ return fs.existsSync(promptsDbFile)? JSON.parse(fs.readFileSync(promptsDbFile,'utf-8')||'{}') : {}; }catch{ return {}; } }
function savePromptsDb(db){ try{ fs.writeFileSync(promptsDbFile, JSON.stringify(db,null,2),'utf-8'); }catch{} }

app.get('/api/prompts/library', (_req,res)=>{
  try{
    const db = loadPromptsDb();
    const prompts = Object.values(db).map(p=>({ id: p.id, title: p.title, body: p.body, tags: p.tags||[], model: p.model||'router', notes: p.notes||'', ts: p.ts||0, lastUsed: p.lastUsed||0, version: p.version||1 }));
    res.json({ prompts });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

app.post('/api/prompts/update', (req,res)=>{
  try{
    const { id, title, body, tags, model, notes } = req.body||{};
    if(!id) return res.status(400).json({ error:'missing id' });
    const db = loadPromptsDb();
    if(!db[id]) return res.status(404).json({ error:'not found' });
    const prev = db[id];
    const versions = prev.versions || [{ ts: prev.ts, body: prev.body, title: prev.title }];
    versions.push({ ts: Date.now()/1000, body: prev.body, title: prev.title });
    db[id] = { ...prev, title: title||prev.title, body: body||prev.body, tags: tags||prev.tags, model: model||prev.model, notes: notes||prev.notes, version: (prev.version||1)+1, versions: versions.slice(-10) };
    savePromptsDb(db);
    fs.appendFileSync(promptLogFile, JSON.stringify({ kind:'prompt_update', ts: Date.now()/1000, id, title })+'\n','utf-8');
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

app.post('/api/prompts/delete', (req,res)=>{
  try{
    const { id } = req.body||{};
    if(!id) return res.status(400).json({ error:'missing id' });
    const db = loadPromptsDb();
    delete db[id];
    savePromptsDb(db);
    fs.appendFileSync(promptLogFile, JSON.stringify({ kind:'prompt_delete', ts: Date.now()/1000, id })+'\n','utf-8');
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

app.get('/api/prompts/:id/versions', (req,res)=>{
  try{
    const { id } = req.params;
    const db = loadPromptsDb();
    const prompt = db[id];
    if(!prompt) return res.status(404).json({ error:'not found' });
    res.json({ versions: prompt.versions||[] });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

app.post('/api/prompts/rollback', (req,res)=>{
  try{
    const { id, versionIdx } = req.body||{};
    if(!id || versionIdx===undefined) return res.status(400).json({ error:'missing params' });
    const db = loadPromptsDb();
    const prompt = db[id];
    if(!prompt) return res.status(404).json({ error:'not found' });
    const versions = prompt.versions||[];
    if(versionIdx >= versions.length) return res.status(400).json({ error:'invalid version' });
    const target = versions[versionIdx];
    prompt.body = target.body;
    prompt.title = target.title;
    prompt.version = (prompt.version||1)+1;
    savePromptsDb(db);
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

app.post('/api/prompts/save-chain', (req,res)=>{
  try{
    const { name, steps } = req.body||{};
    if(!name) return res.status(400).json({ error:'missing name' });
    const chainFile = path.join(runtimeDir, 'chains.json');
    const chains = fs.existsSync(chainFile)? JSON.parse(fs.readFileSync(chainFile,'utf-8')||'[]') : [];
    const id = Math.random().toString(16).slice(2,10);
    chains.push({ id, name, steps, ts: Date.now()/1000 });
    fs.writeFileSync(chainFile, JSON.stringify(chains,null,2),'utf-8');
    res.json({ ok:true, id });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

app.post('/api/prompts/run-chain', async (req,res)=>{
  try{
    const { steps } = req.body||{};
    if(!Array.isArray(steps)) return res.status(400).json({ error:'invalid steps' });
    const outputs = [];
    for(let i=0; i<steps.length; i++){
      const step = steps[i];
      let body = step.body||'';
      // Simple variable passthrough: {{step0.output}}, {{step1.output}}
      for(let j=0; j<i; j++){
        body = body.replace(new RegExp(`{{step${j}\\.output}}`, 'g'), outputs[j]||'');
      }
      const out = `[chain step ${i+1}] ${body.slice(0,100)}`;
      outputs.push(out);
      // Check condition if exists
      if(step.condition){
        const cond = step.condition.toLowerCase();
        if(cond.includes('error') && !out.toLowerCase().includes('error')){
          break; // Stop if condition not met
        }
      }
    }
    fs.appendFileSync(promptLogFile, JSON.stringify({ kind:'chain_run', ts: Date.now()/1000, steps: steps.length, outputs })+'\n','utf-8');
    res.json({ ok:true, outputs });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

app.post('/api/prompts/import', (req,res)=>{
  try{
    const { prompts } = req.body||{};
    if(!Array.isArray(prompts)) return res.status(400).json({ error:'invalid format' });
    const db = loadPromptsDb();
    let count = 0;
    for(const p of prompts){
      const id = Math.random().toString(16).slice(2,10);
      db[id] = { id, title: p.title||'Untitled', body: p.body||'', tags: p.tags||[], model: p.model||'router', notes: p.notes||'', ts: Date.now()/1000, version: 1 };
      count++;
    }
    savePromptsDb(db);
    res.json({ ok:true, count });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

app.get('/api/prompts/metrics', (_req,res)=>{
  try{
    const lines = fs.existsSync(promptLogFile)? fs.readFileSync(promptLogFile,'utf-8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)) : [];
    const runs = lines.filter(l=>l.kind==='prompt_run'||l.kind==='chain_run');
    const avgLatency = 50; // stub
    const successRate = 0.95; // stub
    res.json({ totalRuns: runs.length, successRate, avgLatency });
  }catch(e){ res.status(500).json({ error:String(e) }); }
});

// Projects Platform API
const projectsFile = path.join(runtimeDir, 'projects.json');

function ensureProjectsFile() {
  if (!fs.existsSync(projectsFile)) {
    fs.writeFileSync(projectsFile, JSON.stringify({ projects: [], meta: { version: '1.0.0', last_updated: Date.now() } }, null, 2), 'utf-8');
  }
}

function loadProjects() {
  try {
    ensureProjectsFile();
    return JSON.parse(fs.readFileSync(projectsFile, 'utf-8')).projects || [];
  } catch { return []; }
}

function saveProjects(projects) {
  try {
    const data = { projects, meta: { version: '1.0.0', last_updated: Date.now() } };
    fs.writeFileSync(projectsFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

// Projects API endpoints
app.get('/api/projects', (req, res) => {
  try {
    const { search, stack, status, sort } = req.query;
    let projects = loadProjects();
    
    // Apply filters
    if (search) {
      const query = search.toLowerCase();
      projects = projects.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.tech_stack.some(t => t.toLowerCase().includes(query))
      );
    }
    
    if (stack) projects = projects.filter(p => p.tech_stack.includes(stack));
    if (status) projects = projects.filter(p => p.status === status);
    
    // Apply sorting
    projects.sort((a, b) => {
      switch (sort) {
        case 'name': return a.name.localeCompare(b.name);
        case 'optimization': return b.optimization_level - a.optimization_level;
        case 'accessed': return b.last_accessed - a.last_accessed;
        default: return b.last_accessed - a.last_accessed;
      }
    });
    
    res.json({ projects, total: projects.length });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const projects = loadProjects();
    const project = projects.find(p => p.id === id);
    
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    // Update last accessed
    project.last_accessed = Date.now();
    saveProjects(projects);
    
    res.json({ project });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.put('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const projects = loadProjects();
    const index = projects.findIndex(p => p.id === id);
    
    if (index === -1) return res.status(404).json({ error: 'Project not found' });
    
    projects[index] = { ...projects[index], ...updates, id }; // Preserve ID
    saveProjects(projects);
    
    res.json({ ok: true, project: projects[index] });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.delete('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const projects = loadProjects();
    const filtered = projects.filter(p => p.id !== id);
    
    if (filtered.length === projects.length) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    saveProjects(filtered);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Create/Import/Optimize workflows
const PROJECTS_BASE = path.join(process.cwd(), '../../');

app.get('/api/projects/templates', (req, res) => {
  res.json({ templates: getAvailableTemplates() });
});

app.post('/api/projects/create', async (req, res) => {
  try {
    const { name, template } = req.body;
    if (!name || !template) return res.status(400).json({ error: 'Name and template required' });

    const result = await scaffoldProject({ name, template, basePath: PROJECTS_BASE });
    const analysis = await analyzeCodebase(result.path);
    const config = await optimizeProject(result.path, analysis);

    const project = {
      id: crypto.randomUUID(),
      name,
      path: result.path,
      status: 'active',
      tech_stack: result.stack,
      created_at: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      optimization_level: config.optimization_level,
      config,
      stats: analysis.stats
    };

    const projects = loadProjects();
    projects.push(project);
    saveProjects(projects);

    res.json({ success: true, project });
  } catch (e) {
    console.error('Create project error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/import', async (req, res) => {
  try {
    const { source, type } = req.body;
    if (!source) return res.status(400).json({ error: 'Source required' });

    let projectPath, projectName;

    if (type === 'url') {
      projectName = source.split('/').pop().replace('.git', '');
      projectPath = path.join(PROJECTS_BASE, projectName);
      execSync(`git clone ${source} "${projectPath}"`, { stdio: 'inherit' });
    } else {
      projectPath = source;
      projectName = path.basename(projectPath);
      try { await fs.promises.access(projectPath); }
      catch { return res.status(400).json({ error: 'Path does not exist' }); }
    }

    const analysis = await analyzeCodebase(projectPath);
    const config = await optimizeProject(projectPath, analysis);

    const project = {
      id: crypto.randomUUID(),
      name: projectName,
      path: projectPath,
      status: 'active',
      tech_stack: analysis.stack,
      created_at: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      optimization_level: config.optimization_level,
      config,
      stats: analysis.stats
    };

    const projects = loadProjects();
    projects.push(project);
    saveProjects(projects);

    res.json({ success: true, project });
  } catch (e) {
    console.error('Import project error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/projects/:id/health', async (req, res) => {
  try {
    const projects = loadProjects();
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const analysis = await analyzeCodebase(project.path);
    res.json({ health: analysis.health });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/projects/:id/optimize', async (req, res) => {
  try {
    const projects = loadProjects();
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const analysis = await analyzeCodebase(project.path);
    const config = await optimizeProject(project.path, analysis);

    project.config = config;
    project.optimization_level = config.optimization_level;
    project.stats = analysis.stats;

    saveProjects(projects);
    res.json({ success: true, project });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Code History Watcher
const CODE_HISTORY_DIR = path.join(runtimeDir, 'projects_code_history');
const codeWatcher = new CodeWatcher(CODE_HISTORY_DIR);

app.post('/api/code-history/watch', async (req, res) => {
  try {
    const { projectId, projectPath } = req.body;
    if (!projectId || !projectPath) return res.status(400).json({ error: 'Missing projectId or projectPath' });
    
    await codeWatcher.startWatching(projectId, projectPath);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/code-history/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = parseInt(req.query.limit || '5');
    
    const changes = await codeWatcher.getRecentChanges(projectId, limit);
    res.json({ changes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/code-history/:projectId/all', async (req, res) => {
  try {
    const { projectId } = req.params;
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    
    const result = await codeWatcher.getAllChanges(projectId, page, limit);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/code-history/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    await codeWatcher.clearHistory(projectId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Auto-start watching active project
process.on('SIGINT', async () => {
  console.log('\n[dashboard] Shutting down...');
  await codeWatcher.stopAll();
  process.exit(0);
});

const server = app.listen(PORT, () => {
  if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
  if (!fs.existsSync(eventsFile)) fs.writeFileSync(eventsFile, '', 'utf-8');
  console.log(`[dashboard] listening on http://localhost:${PORT}`);
});

// Notifications system
const notificationsFile = path.join(runtimeDir, 'notifications.json');
const notificationsClients = new Set();

function ensureNotificationsFile() {
  if (!fs.existsSync(notificationsFile)) {
    fs.writeFileSync(notificationsFile, JSON.stringify({ notifications: [] }), 'utf-8');
  }
}

function loadNotifications() {
  try {
    ensureNotificationsFile();
    return JSON.parse(fs.readFileSync(notificationsFile, 'utf-8')).notifications || [];
  } catch { return []; }
}

function saveNotifications(notifications) {
  try {
    fs.writeFileSync(notificationsFile, JSON.stringify({ notifications }, null, 2), 'utf-8');
    broadcastNotifications();
  } catch {}
}

function broadcastNotifications() {
  const notifications = loadNotifications().slice(-20); // Last 20
  const data = `data: ${JSON.stringify({ type: 'notifications', notifications })}\n\n`;
  for (const res of notificationsClients) {
    try { res.write(data); } catch { notificationsClients.delete(res); }
  }
}

function addNotification(type, title, message, data = {}) {
  const notifications = loadNotifications();
  const notification = {
    id: Math.random().toString(36).slice(2),
    type,
    title,
    message,
    data,
    timestamp: Date.now(),
    read: false,
    actions: type === 'approval' ? [{ id: 'approve', label: 'Approve' }, { id: 'dismiss', label: 'Dismiss' }] : [{ id: 'dismiss', label: 'Dismiss' }]
  };
  notifications.push(notification);
  saveNotifications(notifications.slice(-100)); // Keep last 100
}

// Notifications API endpoints
app.get('/api/notifications/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  notificationsClients.add(res);
  
  // Send initial data
  const notifications = loadNotifications().slice(-20);
  res.write(`data: ${JSON.stringify({ type: 'notifications', notifications })}\n\n`);
  
  req.on('close', () => notificationsClients.delete(res));
});

app.get('/api/notifications', (_req, res) => {
  try {
    const notifications = loadNotifications().slice(-50);
    res.json({ notifications });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/notifications/mark-read', (req, res) => {
  try {
    const { id, all } = req.body || {};
    const notifications = loadNotifications();
    
    if (all) {
      notifications.forEach(n => n.read = true);
    } else if (id) {
      const notification = notifications.find(n => n.id === id);
      if (notification) notification.read = true;
    }
    
    saveNotifications(notifications);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/notifications/action', (req, res) => {
  try {
    const { id, action } = req.body || {};
    const notifications = loadNotifications();
    const notification = notifications.find(n => n.id === id);
    
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    
    if (action === 'approve' && notification.type === 'approval') {
      // Handle approval logic here
      fs.appendFileSync(eventsFile, JSON.stringify({ ts: Date.now()/1000, kind: 'approval_granted', data: notification.data }) + '\n', 'utf-8');
      addNotification('success', 'Approval Granted', `Approved: ${notification.title}`);
    }
    
    if (action === 'dismiss' || action === 'approve') {
      const index = notifications.findIndex(n => n.id === id);
      if (index > -1) notifications.splice(index, 1);
    }
    
    saveNotifications(notifications);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Generate sample notifications for demo
app.post('/api/notifications/demo', (req, res) => {
  try {
    addNotification('approval', 'Agent Request', 'Agent wants to execute: rm -rf /tmp/old_files', { command: 'rm -rf /tmp/old_files' });
    addNotification('info', 'Skill Updated', 'Terminal skill updated to v2.1.0');
    addNotification('warning', 'High CPU Usage', 'System CPU usage at 85%');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Marketplace system
const marketplaceFile = path.join(runtimeDir, 'marketplace_catalog.json');
const installedFile = path.join(runtimeDir, 'installed_items.json');

function ensureMarketplaceFile() {
  if (!fs.existsSync(marketplaceFile)) {
    const sampleItems = {
      items: [
        { id: 'skill-terminal-pro', type: 'skill', name: 'Terminal Pro', description: 'Advanced terminal operations with safety checks', version: '2.1.0', rating: 4.8, downloads: 1250, tags: ['terminal', 'safety'], author: 'warp-team', price: 0, dependencies: [] },
        { id: 'agent-code-reviewer', type: 'agent', name: 'Code Reviewer', description: 'AI-powered code review agent with security analysis', version: '1.5.2', rating: 4.9, downloads: 890, tags: ['code', 'security', 'review'], author: 'community', price: 0, dependencies: ['skill-terminal-pro'] },
        { id: 'workflow-ci-cd', type: 'workflow', name: 'CI/CD Pipeline', description: 'Complete CI/CD workflow with testing and deployment', version: '3.0.1', rating: 4.7, downloads: 2100, tags: ['ci', 'cd', 'deployment'], author: 'warp-team', price: 0, dependencies: ['skill-terminal-pro'] },
        { id: 'skill-docker-manager', type: 'skill', name: 'Docker Manager', description: 'Container management and orchestration skill', version: '1.8.0', rating: 4.6, downloads: 650, tags: ['docker', 'containers'], author: 'community', price: 0, dependencies: [] },
        { id: 'agent-security-scanner', type: 'agent', name: 'Security Scanner', description: 'Automated security vulnerability scanning', version: '2.2.0', rating: 4.5, downloads: 420, tags: ['security', 'scanning'], author: 'security-team', price: 0, dependencies: ['skill-terminal-pro', 'skill-docker-manager'] }
      ]
    };
    fs.writeFileSync(marketplaceFile, JSON.stringify(sampleItems, null, 2), 'utf-8');
  }
  if (!fs.existsSync(installedFile)) {
    fs.writeFileSync(installedFile, JSON.stringify({ installed: [] }, null, 2), 'utf-8');
  }
}

function loadMarketplace() {
  try {
    ensureMarketplaceFile();
    return JSON.parse(fs.readFileSync(marketplaceFile, 'utf-8')).items || [];
  } catch { return []; }
}

function loadInstalled() {
  try {
    return JSON.parse(fs.readFileSync(installedFile, 'utf-8')).installed || [];
  } catch { return []; }
}

function saveInstalled(installed) {
  try {
    fs.writeFileSync(installedFile, JSON.stringify({ installed }, null, 2), 'utf-8');
  } catch {}
}

// Marketplace API endpoints
app.get('/api/marketplace/items', (req, res) => {
  try {
    const { search, type, tag, sort = 'downloads' } = req.query;
    let items = loadMarketplace();
    const installed = loadInstalled();
    
    // Mark installed items
    items = items.map(item => ({ ...item, installed: installed.includes(item.id) }));
    
    // Apply filters
    if (search) {
      const query = search.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(query) || 
        item.description.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    if (type) items = items.filter(item => item.type === type);
    if (tag) items = items.filter(item => item.tags.includes(tag));
    
    // Apply sorting
    items.sort((a, b) => {
      switch (sort) {
        case 'rating': return b.rating - a.rating;
        case 'name': return a.name.localeCompare(b.name);
        case 'newest': return b.version.localeCompare(a.version);
        default: return b.downloads - a.downloads; // downloads
      }
    });
    
    res.json({ items, total: items.length });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/marketplace/install', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing item id' });
    
    const items = loadMarketplace();
    const item = items.find(i => i.id === id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    
    const installed = loadInstalled();
    if (installed.includes(id)) {
      return res.json({ ok: true, message: 'Already installed' });
    }
    
    // Check dependencies
    const missing = item.dependencies?.filter(dep => !installed.includes(dep)) || [];
    if (missing.length > 0) {
      return res.status(400).json({ error: 'Missing dependencies', missing });
    }
    
    // Install item
    installed.push(id);
    saveInstalled(installed);
    
    // Log event
    fs.appendFileSync(eventsFile, JSON.stringify({ ts: Date.now()/1000, kind: 'marketplace_install', data: { id, name: item.name, type: item.type } }) + '\n', 'utf-8');
    
    // Send notification
    addNotification('success', 'Install Complete', `${item.name} has been installed successfully`);
    
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/marketplace/uninstall', (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing item id' });
    
    const installed = loadInstalled();
    const index = installed.indexOf(id);
    if (index === -1) return res.status(404).json({ error: 'Item not installed' });
    
    installed.splice(index, 1);
    saveInstalled(installed);
    
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/marketplace/installed', (req, res) => {
  try {
    const installed = loadInstalled();
    const items = loadMarketplace().filter(item => installed.includes(item.id));
    res.json({ items });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/marketplace/rate', (req, res) => {
  try {
    const { id, rating } = req.body || {};
    if (!id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid rating' });
    }
    
    // For demo, just acknowledge - real implementation would update ratings
    addNotification('info', 'Rating Submitted', `Thanks for rating this item!`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Real-time Collaboration system
const sessionsFile = path.join(runtimeDir, 'sessions.json');
const activityFile = path.join(runtimeDir, 'activity.jsonl');
const activeSessions = new Map();
const collabClients = new Set();

function ensureCollabFiles() {
  if (!fs.existsSync(sessionsFile)) {
    fs.writeFileSync(sessionsFile, JSON.stringify({ sessions: {} }), 'utf-8');
  }
  if (!fs.existsSync(activityFile)) {
    fs.writeFileSync(activityFile, '', 'utf-8');
  }
}

function loadSessions() {
  try {
    ensureCollabFiles();
    return JSON.parse(fs.readFileSync(sessionsFile, 'utf-8')).sessions || {};
  } catch { return {}; }
}

function saveSessions(sessions) {
  try {
    fs.writeFileSync(sessionsFile, JSON.stringify({ sessions }, null, 2), 'utf-8');
    broadcastPresence();
  } catch {}
}

function logActivity(user, action, details = {}) {
  try {
    const entry = {
      ts: Date.now() / 1000,
      user,
      action,
      details,
      id: Math.random().toString(36).slice(2)
    };
    fs.appendFileSync(activityFile, JSON.stringify(entry) + '\n', 'utf-8');
    broadcastActivity(entry);
  } catch {}
}

function broadcastPresence() {
  const sessions = loadSessions();
  const activeUsers = Object.values(sessions)
    .filter(s => Date.now() - s.lastSeen < 300000) // 5 minutes
    .map(s => ({ id: s.id, name: s.name, avatar: s.avatar, status: s.status, lastSeen: s.lastSeen }));
  
  const data = JSON.stringify({ type: 'presence', users: activeUsers });
  for (const client of collabClients) {
    try { client.send(data); } catch { collabClients.delete(client); }
  }
}

function broadcastActivity(activity) {
  const data = JSON.stringify({ type: 'activity', activity });
  for (const client of collabClients) {
    try { client.send(data); } catch { collabClients.delete(client); }
  }
}

// Collaboration API endpoints
app.get('/api/activity-feed', (req, res) => {
  try {
    const lines = fs.existsSync(activityFile) 
      ? fs.readFileSync(activityFile, 'utf-8').trim().split('\n').filter(Boolean).slice(-50)
      : [];
    const activities = lines.map(line => JSON.parse(line)).reverse(); // Latest first
    res.json({ activities });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/session/update', (req, res) => {
  try {
    const { id, name, avatar, status, action, page } = req.body || {};
    if (!id || !name) return res.status(400).json({ error: 'Missing id or name' });
    
    const sessions = loadSessions();
    sessions[id] = {
      id,
      name,
      avatar: avatar || '👤',
      status: status || 'active',
      lastSeen: Date.now(),
      page: page || 'dashboard'
    };
    
    saveSessions(sessions);
    
    if (action) {
      logActivity(name, action, { page });
    }
    
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/session/presence', (req, res) => {
  try {
    const sessions = loadSessions();
    const activeUsers = Object.values(sessions)
      .filter(s => Date.now() - s.lastSeen < 300000)
      .map(s => ({ id: s.id, name: s.name, avatar: s.avatar, status: s.status, page: s.page, lastSeen: s.lastSeen }));
    
    res.json({ users: activeUsers, total: activeUsers.length });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/activity/log', (req, res) => {
  try {
    const { user, action, details } = req.body || {};
    if (!user || !action) return res.status(400).json({ error: 'Missing user or action' });
    
    logActivity(user, action, details);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// WebSocket server for collaboration
const collabWss = new WebSocketServer({ noServer: true });

collabWss.on('connection', (ws, request) => {
  console.log('[collab-ws] client connected');
  collabClients.add(ws);
  
  // Send initial presence data
  broadcastPresence();
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'heartbeat') {
        const sessions = loadSessions();
        if (sessions[msg.userId]) {
          sessions[msg.userId].lastSeen = Date.now();
          saveSessions(sessions);
        }
      } else if (msg.type === 'activity') {
        logActivity(msg.user, msg.action, msg.details);
      }
    } catch (e) {
      console.error('[collab-ws] message error:', e);
    }
  });
  
  ws.on('close', () => {
    collabClients.delete(ws);
    console.log('[collab-ws] client disconnected');
  });
});

// WebSocket server for terminal streaming
const wss = new WebSocketServer({ noServer: true });
const terminalSessions = new Map();

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/terminal-ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (request.url === '/collab-ws') {
    collabWss.handleUpgrade(request, socket, head, (ws) => {
      collabWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  const sessionId = Math.random().toString(36).slice(2);
  console.log(`[terminal-ws] client connected: ${sessionId}`);
  
  // Send session ID
  ws.send(JSON.stringify({ type: 'session', sessionId }));
  
  // Create persistent shell session (node-pty would be better, but spawn works for MVP)
  let currentProcess = null;
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'command' && msg.data) {
        const cmd = msg.data.trim();
        if (!cmd) return;
        
        // Log command
        const append = (obj) => {
          const line = JSON.stringify({ ts: Date.now() / 1000, ...obj });
          fs.appendFileSync(termLogFile, line + '\n', 'utf-8');
        };
        append({ kind: 'term_start', cmd, sessionId });
        
        // Execute command
        const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
        const args = process.platform === 'win32' 
          ? ['-NoLogo', '-NoProfile', '-Command', cmd]
          : ['-c', cmd];
        
        currentProcess = spawn(shell, args, {
          cwd: repoRoot,
          env: process.env
        });
        
        currentProcess.stdout.on('data', (chunk) => {
          const output = chunk.toString();
          ws.send(JSON.stringify({ type: 'output', data: output }));
          append({ kind: 'term', stream: 'stdout', data: output, sessionId });
        });
        
        currentProcess.stderr.on('data', (chunk) => {
          const output = chunk.toString();
          ws.send(JSON.stringify({ type: 'output', data: output }));
          append({ kind: 'term', stream: 'stderr', data: output, sessionId });
        });
        
        currentProcess.on('close', (code) => {
          ws.send(JSON.stringify({ type: 'output', data: `\r\n\x1b[36m$\x1b[0m ` }));
          append({ kind: 'term_end', code, sessionId });
          currentProcess = null;
        });
        
        currentProcess.on('error', (err) => {
          ws.send(JSON.stringify({ type: 'output', data: `\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n` }));
          append({ kind: 'term_error', error: err.message, sessionId });
        });
      }
    } catch (err) {
      console.error('[terminal-ws] message error:', err);
    }
  });
  
  ws.on('close', () => {
    console.log(`[terminal-ws] client disconnected: ${sessionId}`);
    if (currentProcess) {
      currentProcess.kill();
    }
    terminalSessions.delete(sessionId);
  });
  
  ws.on('error', (err) => {
    console.error('[terminal-ws] error:', err);
  });
  
  terminalSessions.set(sessionId, { ws, currentProcess: null });
});
