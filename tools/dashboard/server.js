import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

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

app.listen(PORT, () => {
  if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
  if (!fs.existsSync(eventsFile)) fs.writeFileSync(eventsFile, '', 'utf-8');
  console.log(`[dashboard] listening on http://localhost:${PORT}`);
});
