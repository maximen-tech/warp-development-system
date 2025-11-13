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

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' }));

// Agents API (read/write .warp/agents/*)
const repoRoot = path.resolve(__dirname, '../../');
const agentsDir = path.join(repoRoot, '.warp', 'agents');
const agentsFile = path.join(agentsDir, 'agents.yml');
const skillsFile = path.join(agentsDir, 'skills.yml');

app.get('/api/agents', (_req, res) => {
  try {
    const agents = fs.existsSync(agentsFile) ? fs.readFileSync(agentsFile, 'utf-8') : '';
    const skills = fs.existsSync(skillsFile) ? fs.readFileSync(skillsFile, 'utf-8') : '';
    res.json({ agents, skills });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.put('/api/agents', (req, res) => {
  try {
    if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });
    const { agents, skills } = req.body || {};
    const backupDir = path.join(runtimeDir, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
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
    const planPath = path.join(runtimeDir, 'plan.md');
    if (fs.existsSync(planPath)) {
      const st = fs.statSync(planPath);
      result.push({ name: 'plan.md', size: st.size, mtime: st.mtimeMs });
    }
    res.json({ files: result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
app.get('/api/artifact/download/:name', (req, res) => {
  const allowed = new Set(['plan.md']);
  const name = req.params.name;
  if (!allowed.has(name)) return res.status(404).end();
  const p = path.join(runtimeDir, name);
  if (!fs.existsSync(p)) return res.status(404).end();
  res.setHeader('Content-Type', 'text/plain');
  fs.createReadStream(p).pipe(res);
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
      if (ev.kind === 'start') { current = { idx: idx++, startLine: i, startTs: ev.ts, count:0, errors:0, approvals:0 }; }
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
app.get('/api/runs/export/:idx', (req, res) => {
  try {
    const idx = parseInt(req.params.idx, 10);
    if (!fs.existsSync(eventsFile)) return res.status(404).end();
    const lines = fs.readFileSync(eventsFile, 'utf-8').trim().split('\n').filter(Boolean);
    let cur = -1; let start=-1; let end=-1;
    for (let i=0;i<lines.length;i++){
      const ev = JSON.parse(lines[i]);
      if (ev.kind==='start'){ cur++; if (cur===idx) start=i; }
      if (ev.kind==='end' && cur===idx){ end=i; break; }
    }
    if (start===-1) return res.status(404).end();
    const slice = lines.slice(start, end===-1? lines.length : end+1).join('\n');
    res.setHeader('Content-Type', 'text/plain');
    res.send(slice);
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

app.listen(PORT, () => {
  if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
  if (!fs.existsSync(eventsFile)) fs.writeFileSync(eventsFile, '', 'utf-8');
  console.log(`[dashboard] listening on http://localhost:${PORT}`);
});
