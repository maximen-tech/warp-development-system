class CacheManager {
  constructor(config = {}) {
    this.type = config.type || 'memory'; // memory or redis
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    this.ttlTimers = new Map();
  }

  async get(key) {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      if (!entry.expiresAt || entry.expiresAt > Date.now()) {
        this.stats.hits++;
        return entry.value;
      } else {
        this.cache.delete(key);
        this.stats.misses++;
        return null;
      }
    }
    this.stats.misses++;
    return null;
  }

  async set(key, value, ttl = null) {
    const entry = {
      value,
      createdAt: Date.now(),
      expiresAt: ttl ? Date.now() + ttl * 1000 : null
    };
    
    this.cache.set(key, entry);
    this.stats.sets++;
    
    if (ttl) {
      if (this.ttlTimers.has(key)) {
        clearTimeout(this.ttlTimers.get(key));
      }
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.ttlTimers.delete(key);
      }, ttl * 1000);
      this.ttlTimers.set(key, timer);
    }
    
    return true;
  }

  async delete(key) {
    const deleted = this.cache.delete(key);
    if (this.ttlTimers.has(key)) {
      clearTimeout(this.ttlTimers.get(key));
      this.ttlTimers.delete(key);
    }
    if (deleted) this.stats.deletes++;
    return deleted;
  }

  async clear() {
    this.cache.clear();
    this.ttlTimers.forEach(timer => clearTimeout(timer));
    this.ttlTimers.clear();
    return true;
  }

  async has(key) {
    return this.cache.has(key);
  }

  async keys(pattern = '*') {
    if (pattern === '*') {
      return Array.from(this.cache.keys());
    }
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
      : 0;
    
    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2) + '%',
      size: this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  estimateMemoryUsage() {
    let bytes = 0;
    this.cache.forEach((entry, key) => {
      bytes += key.length * 2; // Rough estimate for string
      bytes += JSON.stringify(entry.value).length * 2;
    });
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }
}

export default CacheManager;
