import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class InMemoryScheduler {
  constructor({ storageDir }) {
    this.storageDir = storageDir || path.join(__dirname, '../../../runtime');
    this.schedulesFile = path.join(this.storageDir, 'schedules.json');
    this.tasks = new Map();
  }

  async init() {
    try {
      await fs.access(this.schedulesFile);
    } catch {
      await fs.writeFile(this.schedulesFile, JSON.stringify({ schedules: [] }, null, 2));
    }
    const data = JSON.parse(await fs.readFile(this.schedulesFile, 'utf-8'));
    for (const s of data.schedules) {
      this._scheduleTask(s);
    }
  }

  async add({ id, cronExpr, payload }) {
    const schedules = await this._read();
    const existing = schedules.find(s => s.id === id);
    const schedule = { id, cronExpr, payload, createdAt: Date.now() };
    if (existing) {
      Object.assign(existing, schedule);
    } else {
      schedules.push(schedule);
    }
    await this._write(schedules);
    this._scheduleTask(schedule);
    return schedule;
  }

  async remove(id) {
    const schedules = await this._read();
    const updated = schedules.filter(s => s.id !== id);
    await this._write(updated);
    if (this.tasks.has(id)) {
      this.tasks.get(id).stop();
      this.tasks.delete(id);
    }
    return { success: true };
  }

  list() {
    return this._read();
  }

  _scheduleTask(schedule) {
    if (this.tasks.has(schedule.id)) this.tasks.get(schedule.id).stop();
    const task = cron.schedule(schedule.cronExpr, async () => {
      try {
        if (typeof schedule.payload?.handler === 'function') {
          await schedule.payload.handler(schedule.payload.data);
        }
      } catch (e) {
        // swallow
      }
    }, { scheduled: true });
    this.tasks.set(schedule.id, task);
  }

  async _read() {
    try {
      const data = JSON.parse(await fs.readFile(this.schedulesFile, 'utf-8'));
      return data.schedules || [];
    } catch { return []; }
  }

  async _write(schedules) {
    await fs.writeFile(this.schedulesFile, JSON.stringify({ schedules }, null, 2));
  }
}

export default InMemoryScheduler;