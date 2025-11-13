import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseLayer {
  constructor(config = {}) {
    this.type = config.type || 'json'; // json, sqlite, postgresql
    this.config = config;
    this.cache = new Map();
    this.dataDir = path.join(__dirname, '../../../runtime');
  }

  async initialize() {
    if (this.type === 'json') {
      await this.ensureDataDir();
    }
  }

  async ensureDataDir() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  async query(collection, filter = {}, options = {}) {
    if (this.type === 'json') {
      return this.jsonQuery(collection, filter, options);
    }
    throw new Error(`Database type ${this.type} not implemented`);
  }

  async jsonQuery(collection, filter, options) {
    const filePath = path.join(this.dataDir, `${collection}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      let items = JSON.parse(data);
      
      if (!Array.isArray(items)) {
        items = Object.values(items);
      }

      // Apply filters
      if (Object.keys(filter).length > 0) {
        items = items.filter(item => {
          return Object.entries(filter).every(([key, value]) => {
            if (typeof value === 'object' && value.$regex) {
              const regex = new RegExp(value.$regex, value.$options || '');
              return regex.test(item[key]);
            }
            return item[key] === value;
          });
        });
      }

      // Apply sort
      if (options.sort) {
        const [[sortKey, sortOrder]] = Object.entries(options.sort);
        items.sort((a, b) => {
          const aVal = a[sortKey];
          const bVal = b[sortKey];
          return sortOrder === 1 ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
        });
      }

      // Apply pagination
      const total = items.length;
      if (options.skip) items = items.slice(options.skip);
      if (options.limit) items = items.slice(0, options.limit);

      return { items, total, count: items.length };
    } catch (error) {
      return { items: [], total: 0, count: 0 };
    }
  }

  async insert(collection, document) {
    if (this.type === 'json') {
      return this.jsonInsert(collection, document);
    }
    throw new Error(`Database type ${this.type} not implemented`);
  }

  async jsonInsert(collection, document) {
    const filePath = path.join(this.dataDir, `${collection}.json`);
    
    try {
      let items = [];
      try {
        const data = await fs.readFile(filePath, 'utf8');
        items = JSON.parse(data);
        if (!Array.isArray(items)) items = [];
      } catch {}

      const newDoc = {
        ...document,
        _id: document._id || `${collection}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now()
      };

      items.push(newDoc);
      await fs.writeFile(filePath, JSON.stringify(items, null, 2));
      
      return newDoc;
    } catch (error) {
      throw new Error(`Failed to insert into ${collection}: ${error.message}`);
    }
  }

  async update(collection, filter, update) {
    if (this.type === 'json') {
      return this.jsonUpdate(collection, filter, update);
    }
    throw new Error(`Database type ${this.type} not implemented`);
  }

  async jsonUpdate(collection, filter, update) {
    const filePath = path.join(this.dataDir, `${collection}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      let items = JSON.parse(data);
      
      if (!Array.isArray(items)) items = [];

      let updatedCount = 0;
      items = items.map(item => {
        const matches = Object.entries(filter).every(([key, value]) => item[key] === value);
        if (matches) {
          updatedCount++;
          return { ...item, ...update, updatedAt: Date.now() };
        }
        return item;
      });

      await fs.writeFile(filePath, JSON.stringify(items, null, 2));
      
      return { modifiedCount: updatedCount };
    } catch (error) {
      throw new Error(`Failed to update ${collection}: ${error.message}`);
    }
  }

  async delete(collection, filter) {
    if (this.type === 'json') {
      return this.jsonDelete(collection, filter);
    }
    throw new Error(`Database type ${this.type} not implemented`);
  }

  async jsonDelete(collection, filter) {
    const filePath = path.join(this.dataDir, `${collection}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      let items = JSON.parse(data);
      
      if (!Array.isArray(items)) items = [];

      const originalLength = items.length;
      items = items.filter(item => {
        return !Object.entries(filter).every(([key, value]) => item[key] === value);
      });

      await fs.writeFile(filePath, JSON.stringify(items, null, 2));
      
      return { deletedCount: originalLength - items.length };
    } catch (error) {
      throw new Error(`Failed to delete from ${collection}: ${error.message}`);
    }
  }

  async getStatus() {
    return {
      type: this.type,
      connected: true,
      collections: await this.listCollections()
    };
  }

  async listCollections() {
    try {
      const files = await fs.readdir(this.dataDir);
      return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    } catch {
      return [];
    }
  }
}

export default DatabaseLayer;
