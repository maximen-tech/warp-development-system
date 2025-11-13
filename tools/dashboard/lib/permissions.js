import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class PermissionsManager {
  constructor() {
    this.permissionsFile = path.join(__dirname, '../../../runtime/permissions.json');
    this.permissions = new Map();
    this.roles = {
      admin: ['read', 'write', 'delete', 'manage_users', 'approve', 'execute'],
      lead: ['read', 'write', 'approve', 'execute'],
      engineer: ['read', 'write', 'execute'],
      viewer: ['read']
    };
  }

  async initialize() {
    try {
      const data = await fs.readFile(this.permissionsFile, 'utf8');
      const perms = JSON.parse(data);
      Object.entries(perms).forEach(([key, value]) => {
        this.permissions.set(key, value);
      });
    } catch (error) {
      await fs.writeFile(this.permissionsFile, JSON.stringify({}, null, 2));
    }
  }

  async grantPermission(userId, role, resourceType = 'global', resourceId = '*') {
    const permKey = `${userId}:${resourceType}:${resourceId}`;
    this.permissions.set(permKey, {
      userId,
      role,
      resourceType,
      resourceId,
      grantedAt: Date.now()
    });
    await this.persist();
    return this.permissions.get(permKey);
  }

  async revokePermission(userId, resourceType = 'global', resourceId = '*') {
    const permKey = `${userId}:${resourceType}:${resourceId}`;
    this.permissions.delete(permKey);
    await this.persist();
    return { success: true };
  }

  hasPermission(userId, action, resourceType = 'global', resourceId = '*') {
    const permKey = `${userId}:${resourceType}:${resourceId}`;
    const permission = this.permissions.get(permKey);
    
    if (!permission) {
      // Check global permission
      const globalKey = `${userId}:global:*`;
      const globalPerm = this.permissions.get(globalKey);
      if (!globalPerm) return false;
      permission = globalPerm;
    }

    const allowedActions = this.roles[permission.role] || [];
    return allowedActions.includes(action);
  }

  getUserPermissions(userId) {
    const userPerms = [];
    this.permissions.forEach((perm, key) => {
      if (key.startsWith(`${userId}:`)) {
        userPerms.push(perm);
      }
    });
    return userPerms;
  }

  getAllUsers() {
    const users = new Map();
    this.permissions.forEach(perm => {
      if (!users.has(perm.userId)) {
        users.set(perm.userId, {
          userId: perm.userId,
          permissions: []
        });
      }
      users.get(perm.userId).permissions.push(perm);
    });
    return Array.from(users.values());
  }

  async persist() {
    const permsObj = {};
    this.permissions.forEach((value, key) => {
      permsObj[key] = value;
    });
    await fs.writeFile(this.permissionsFile, JSON.stringify(permsObj, null, 2));
  }
}

export default PermissionsManager;
