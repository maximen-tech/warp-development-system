const fs = require('fs').promises;
const path = require('path');

class AgentMemory {
  constructor() {
    this.memoryFile = path.join(__dirname, '../../../runtime/agent-memory.json');
    this.memory = new Map();
    this.maxMemorySize = 1000; // Max entries
  }

  async initialize() {
    try {
      const data = await fs.readFile(this.memoryFile, 'utf8');
      const memoryData = JSON.parse(data);
      Object.entries(memoryData).forEach(([key, value]) => {
        this.memory.set(key, value);
      });
    } catch (error) {
      await fs.writeFile(this.memoryFile, JSON.stringify({}, null, 2));
    }
  }

  async get(agentId, key = null) {
    const agentMemory = this.memory.get(agentId) || {};
    return key ? agentMemory[key] : agentMemory;
  }

  async set(agentId, data) {
    const existing = this.memory.get(agentId) || {};
    const updated = {
      ...existing,
      ...data,
      updatedAt: Date.now()
    };
    
    this.memory.set(agentId, updated);
    await this.prune();
    await this.persist();
    return updated;
  }

  async append(agentId, key, value) {
    const agentMemory = this.memory.get(agentId) || {};
    if (!agentMemory[key]) agentMemory[key] = [];
    
    if (Array.isArray(agentMemory[key])) {
      agentMemory[key].push({
        value,
        timestamp: Date.now()
      });
    }
    
    agentMemory.updatedAt = Date.now();
    this.memory.set(agentId, agentMemory);
    await this.persist();
    return agentMemory;
  }

  async delete(agentId, key = null) {
    if (key) {
      const agentMemory = this.memory.get(agentId);
      if (agentMemory) {
        delete agentMemory[key];
        this.memory.set(agentId, agentMemory);
      }
    } else {
      this.memory.delete(agentId);
    }
    await this.persist();
    return { success: true };
  }

  async clear(agentId = null) {
    if (agentId) {
      this.memory.delete(agentId);
    } else {
      this.memory.clear();
    }
    await this.persist();
    return { success: true };
  }

  async search(query) {
    const results = [];
    this.memory.forEach((data, agentId) => {
      const dataStr = JSON.stringify(data).toLowerCase();
      if (dataStr.includes(query.toLowerCase())) {
        results.push({ agentId, data });
      }
    });
    return results;
  }

  async prune() {
    if (this.memory.size > this.maxMemorySize) {
      const entries = Array.from(this.memory.entries())
        .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
      
      this.memory.clear();
      entries.slice(0, this.maxMemorySize).forEach(([key, value]) => {
        this.memory.set(key, value);
      });
    }
  }

  async persist() {
    const memoryObj = {};
    this.memory.forEach((value, key) => {
      memoryObj[key] = value;
    });
    await fs.writeFile(this.memoryFile, JSON.stringify(memoryObj, null, 2));
  }

  getStats() {
    return {
      totalAgents: this.memory.size,
      totalSize: JSON.stringify(Array.from(this.memory.values())).length,
      maxSize: this.maxMemorySize
    };
  }
}

module.exports = AgentMemory;
