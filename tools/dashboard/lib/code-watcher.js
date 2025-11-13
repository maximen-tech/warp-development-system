// Code Watcher - Real-time file change tracking with diff computation
import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const CODE_EXTENSIONS = ['.js', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.css', '.html', '.json', '.yml', '.yaml', '.md'];
const IGNORE_PATTERNS = ['node_modules', '.git', 'dist', 'build', '.next', 'venv', '__pycache__', 'target'];
const MAX_ENTRIES_PER_PROJECT = 1000;
const DEBOUNCE_MS = 1000;

class CodeWatcher {
  constructor(historyDir) {
    this.historyDir = historyDir;
    this.watchers = new Map(); // projectId -> watcher instance
    this.fileCache = new Map(); // filePath -> {content, timestamp}
    this.debounceTimers = new Map(); // filePath -> timer
    this.changeBuffers = new Map(); // projectId -> []
    this.flushTimers = new Map(); // projectId -> timer
  }

  async startWatching(projectId, projectPath) {
    if (this.watchers.has(projectId)) {
      console.log(`[code-watcher] Already watching project ${projectId}`);
      return;
    }

    console.log(`[code-watcher] Starting watch for project ${projectId} at ${projectPath}`);

    const watcher = chokidar.watch(projectPath, {
      ignored: (filePath) => IGNORE_PATTERNS.some(pattern => filePath.includes(pattern)),
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    watcher.on('change', async (filePath) => {
      const ext = path.extname(filePath);
      if (!CODE_EXTENSIONS.includes(ext)) return;

      // Debounce rapid changes
      if (this.debounceTimers.has(filePath)) {
        clearTimeout(this.debounceTimers.get(filePath));
      }

      this.debounceTimers.set(filePath, setTimeout(async () => {
        await this.handleFileChange(projectId, projectPath, filePath);
        this.debounceTimers.delete(filePath);
      }, DEBOUNCE_MS));
    });

    watcher.on('error', (error) => {
      console.error(`[code-watcher] Error watching ${projectId}:`, error);
    });

    this.watchers.set(projectId, watcher);
    
    // Ensure history directory exists
    await this.ensureHistoryDir(projectId);
  }

  async stopWatching(projectId) {
    const watcher = this.watchers.get(projectId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(projectId);
      
      // Flush any pending changes
      await this.flushChanges(projectId);
      
      console.log(`[code-watcher] Stopped watching project ${projectId}`);
    }
  }

  async handleFileChange(projectId, projectPath, filePath) {
    try {
      // Read current content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Get cached previous content
      const cached = this.fileCache.get(filePath);
      const before = cached?.content || '';
      
      // Skip if unchanged
      if (before === content) return;

      // Compute diff
      const diff = await this.computeDiff(projectPath, filePath, before, content);
      
      // Create change entry
      const entry = {
        timestamp: Date.now(),
        file: path.relative(projectPath, filePath),
        before: before.split('\n').length,
        after: content.split('\n').length,
        lines_added: diff.added,
        lines_removed: diff.removed,
        diff: diff.text,
        commit_hash: await this.getLatestCommitHash(projectPath)
      };

      // Update cache
      this.fileCache.set(filePath, { content, timestamp: Date.now() });

      // Buffer change
      if (!this.changeBuffers.has(projectId)) {
        this.changeBuffers.set(projectId, []);
      }
      this.changeBuffers.get(projectId).push(entry);

      // Schedule flush (batch writes every 5s OR 10 changes)
      if (this.changeBuffers.get(projectId).length >= 10) {
        await this.flushChanges(projectId);
      } else {
        if (this.flushTimers.has(projectId)) {
          clearTimeout(this.flushTimers.get(projectId));
        }
        this.flushTimers.set(projectId, setTimeout(() => {
          this.flushChanges(projectId);
        }, 5000));
      }

      console.log(`[code-watcher] Change detected in ${entry.file}: +${diff.added} -${diff.removed}`);
    } catch (error) {
      console.error(`[code-watcher] Error handling file change:`, error);
    }
  }

  async computeDiff(projectPath, filePath, before, after) {
    try {
      // Try git diff first
      const relPath = path.relative(projectPath, filePath);
      const gitDiff = execSync(`git diff --no-index --unified=3 /dev/null "${relPath}"`, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();

      return this.parseDiff(gitDiff);
    } catch {
      // Fallback: simple line-by-line diff
      return this.simpleDiff(before, after);
    }
  }

  parseDiff(diffText) {
    const lines = diffText.split('\n');
    let added = 0;
    let removed = 0;

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) added++;
      if (line.startsWith('-') && !line.startsWith('---')) removed++;
    }

    return { text: diffText, added, removed };
  }

  simpleDiff(before, after) {
    const beforeLines = before.split('\n');
    const afterLines = after.split('\n');
    
    const added = afterLines.length - beforeLines.length;
    const removed = beforeLines.length - afterLines.length;

    // Generate simple unified diff format
    const diff = [
      `--- before`,
      `+++ after`,
      `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
      ...beforeLines.slice(0, 5).map(l => `-${l}`),
      ...afterLines.slice(0, 5).map(l => `+${l}`)
    ].join('\n');

    return { 
      text: diff, 
      added: Math.max(0, added), 
      removed: Math.max(0, removed) 
    };
  }

  async getLatestCommitHash(projectPath) {
    try {
      return execSync('git rev-parse --short HEAD', {
        cwd: projectPath,
        encoding: 'utf-8'
      }).trim();
    } catch {
      return null;
    }
  }

  async flushChanges(projectId) {
    const buffer = this.changeBuffers.get(projectId);
    if (!buffer || buffer.length === 0) return;

    try {
      const historyFile = path.join(this.historyDir, projectId, 'changes.jsonl');
      
      // Append entries to JSONL
      const lines = buffer.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      await fs.appendFile(historyFile, lines, 'utf-8');

      // Clear buffer
      this.changeBuffers.set(projectId, []);
      
      // Cleanup old entries if needed
      await this.rotateHistory(projectId);

      console.log(`[code-watcher] Flushed ${buffer.length} changes for project ${projectId}`);
    } catch (error) {
      console.error(`[code-watcher] Error flushing changes:`, error);
    }

    // Clear timer
    if (this.flushTimers.has(projectId)) {
      clearTimeout(this.flushTimers.get(projectId));
      this.flushTimers.delete(projectId);
    }
  }

  async rotateHistory(projectId) {
    const historyFile = path.join(this.historyDir, projectId, 'changes.jsonl');
    
    try {
      const content = await fs.readFile(historyFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      if (lines.length > MAX_ENTRIES_PER_PROJECT) {
        // Keep only the latest MAX_ENTRIES_PER_PROJECT
        const keep = lines.slice(-MAX_ENTRIES_PER_PROJECT);
        await fs.writeFile(historyFile, keep.join('\n') + '\n', 'utf-8');
        console.log(`[code-watcher] Rotated history for ${projectId}: kept ${keep.length} entries`);
      }
    } catch (error) {
      // File doesn't exist yet, ignore
    }
  }

  async ensureHistoryDir(projectId) {
    const dir = path.join(this.historyDir, projectId);
    await fs.mkdir(dir, { recursive: true });
  }

  async getRecentChanges(projectId, limit = 5) {
    const historyFile = path.join(this.historyDir, projectId, 'changes.jsonl');
    
    try {
      const content = await fs.readFile(historyFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const entries = lines.map(line => JSON.parse(line));
      
      // Return last N entries
      return entries.slice(-limit).reverse();
    } catch {
      return [];
    }
  }

  async getAllChanges(projectId, page = 1, limit = 20) {
    const historyFile = path.join(this.historyDir, projectId, 'changes.jsonl');
    
    try {
      const content = await fs.readFile(historyFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const entries = lines.map(line => JSON.parse(line)).reverse();
      
      const start = (page - 1) * limit;
      const end = start + limit;
      
      return {
        entries: entries.slice(start, end),
        total: entries.length,
        page,
        pages: Math.ceil(entries.length / limit)
      };
    } catch {
      return { entries: [], total: 0, page: 1, pages: 0 };
    }
  }

  async clearHistory(projectId) {
    const historyFile = path.join(this.historyDir, projectId, 'changes.jsonl');
    
    try {
      await fs.writeFile(historyFile, '', 'utf-8');
      this.fileCache.clear();
      this.changeBuffers.delete(projectId);
      console.log(`[code-watcher] Cleared history for ${projectId}`);
    } catch (error) {
      console.error(`[code-watcher] Error clearing history:`, error);
    }
  }

  async stopAll() {
    for (const [projectId, watcher] of this.watchers.entries()) {
      await watcher.close();
      await this.flushChanges(projectId);
    }
    this.watchers.clear();
    console.log('[code-watcher] Stopped all watchers');
  }
}

export default CodeWatcher;