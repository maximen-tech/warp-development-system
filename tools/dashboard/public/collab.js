// Real-time Collaboration - Presence, activity feed, multi-user indicators
class CollaborationManager {
  constructor() {
    this.userId = this.generateUserId();
    this.userName = this.loadUserName();
    this.userAvatar = this.loadUserAvatar();
    this.ws = null;
    this.users = [];
    this.activities = [];
    this.currentPage = this.getCurrentPage();
    this.heartbeatInterval = null;
    this.reconnectTimeout = null;
    this.init();
  }

  init() {
    this.createPresenceIndicator();
    this.createActivityFeed();
    this.connectWebSocket();
    this.setupActivityTracking();
    this.updatePresence();
    
    // Update presence every 30 seconds
    setInterval(() => this.updatePresence(), 30000);
  }

  generateUserId() {
    let id = localStorage.getItem('collab_user_id');
    if (!id) {
      id = 'user_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('collab_user_id', id);
    }
    return id;
  }

  loadUserName() {
    return localStorage.getItem('collab_user_name') || `User ${this.userId.slice(-4)}`;
  }

  loadUserAvatar() {
    return localStorage.getItem('collab_user_avatar') || '👤';
  }

  getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('agents')) return 'agents';
    if (path.includes('library')) return 'library';
    if (path.includes('marketplace')) return 'marketplace';
    if (path.includes('analytics')) return 'analytics';
    return 'dashboard';
  }

  createPresenceIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'presence-indicator';
    indicator.innerHTML = `
      <div class="presence-header">
        <span class="presence-title">👥 Online</span>
        <span class="presence-count">0</span>
        <button class="pill tiny presence-toggle" onclick="collaboration.toggleActivityFeed()">Activity</button>
      </div>
      <div class="presence-avatars" id="presenceAvatars"></div>
    `;
    
    // Add to header controls
    const controls = document.querySelector('header .controls');
    if (controls) controls.appendChild(indicator);
  }

  createActivityFeed() {
    const feed = document.createElement('div');
    feed.className = 'activity-feed';
    feed.innerHTML = `
      <div class="activity-header">
        <h3>Team Activity</h3>
        <button class="activity-close" onclick="collaboration.toggleActivityFeed()">×</button>
      </div>
      <div class="activity-list" id="activityList">
        <div class="activity-loading">Loading activity...</div>
      </div>
      <div class="activity-footer">
        <button class="pill tiny" onclick="collaboration.clearActivityCache()">Clear cache</button>
        <button class="pill tiny" onclick="collaboration.showUserSettings()">Settings</button>
      </div>
    `;
    
    document.body.appendChild(feed);
  }

  connectWebSocket() {
    if (this.ws) this.ws.close();
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/collab-ws`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('[collaboration] WebSocket connected');
      this.startHeartbeat();
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      } catch (e) {
        console.error('[collaboration] WebSocket message error:', e);
      }
    };
    
    this.ws.onclose = () => {
      console.warn('[collaboration] WebSocket disconnected, retrying in 5s...');
      this.stopHeartbeat();
      this.reconnectTimeout = setTimeout(() => this.connectWebSocket(), 5000);
    };
    
    this.ws.onerror = (error) => {
      console.error('[collaboration] WebSocket error:', error);
    };
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'presence':
        this.updatePresenceDisplay(data.users);
        break;
      case 'activity':
        this.addActivity(data.activity);
        break;
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'heartbeat',
          userId: this.userId
        }));
      }
    }, 30000); // 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async updatePresence(action = null) {
    try {
      await fetch('/api/session/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.userId,
          name: this.userName,
          avatar: this.userAvatar,
          status: 'active',
          action,
          page: this.currentPage
        })
      });
    } catch (e) {
      console.error('[collaboration] Update presence failed:', e);
    }
  }

  updatePresenceDisplay(users) {
    this.users = users;
    const avatarsContainer = document.getElementById('presenceAvatars');
    const countElement = document.querySelector('.presence-count');
    
    if (countElement) countElement.textContent = users.length;
    
    if (avatarsContainer) {
      avatarsContainer.innerHTML = users.map(user => {
        const isCurrentUser = user.id === this.userId;
        const statusDot = user.status === 'active' ? '🟢' : '🟡';
        const timeSince = this.formatTimeSince(user.lastSeen);
        
        return `
          <div class="presence-avatar ${isCurrentUser ? 'current-user' : ''}" 
               title="${user.name} (${user.page}) - ${timeSince}">
            <span class="avatar-emoji">${user.avatar}</span>
            <span class="status-dot">${statusDot}</span>
            <span class="avatar-name">${isCurrentUser ? 'You' : user.name}</span>
          </div>
        `;
      }).join('');
    }
  }

  async loadActivityFeed() {
    try {
      const response = await fetch('/api/activity-feed');
      const data = await response.json();
      this.activities = data.activities || [];
      this.renderActivityFeed();
    } catch (e) {
      console.error('[collaboration] Load activity failed:', e);
      const list = document.getElementById('activityList');
      if (list) list.innerHTML = '<div class="activity-error">Failed to load activity</div>';
    }
  }

  addActivity(activity) {
    this.activities.unshift(activity); // Add to beginning
    this.activities = this.activities.slice(0, 100); // Keep last 100
    this.renderActivityFeed();
    
    // Flash notification if activity feed is closed
    const feed = document.querySelector('.activity-feed');
    if (feed && !feed.classList.contains('open')) {
      const toggle = document.querySelector('.presence-toggle');
      if (toggle) {
        toggle.classList.add('has-new-activity');
        setTimeout(() => toggle.classList.remove('has-new-activity'), 3000);
      }
    }
  }

  renderActivityFeed() {
    const list = document.getElementById('activityList');
    if (!list) return;
    
    if (this.activities.length === 0) {
      list.innerHTML = '<div class="activity-empty">No recent activity</div>';
      return;
    }
    
    list.innerHTML = this.activities.map(activity => this.renderActivity(activity)).join('');
  }

  renderActivity(activity) {
    const actionIcons = {
      'page_view': '👁️',
      'edit': '✏️',
      'install': '📦',
      'create': '➕',
      'delete': '🗑️',
      'approve': '✅',
      'run': '▶️'
    };
    
    const icon = actionIcons[activity.action] || '📋';
    const timeSince = this.formatTimeSince(activity.ts * 1000);
    
    let description = activity.action;
    if (activity.details) {
      if (activity.details.page) description += ` on ${activity.details.page}`;
      if (activity.details.item) description += ` "${activity.details.item}"`;
    }
    
    return `
      <div class="activity-item">
        <div class="activity-icon">${icon}</div>
        <div class="activity-content">
          <div class="activity-user">${activity.user}</div>
          <div class="activity-description">${description}</div>
          <div class="activity-time">${timeSince}</div>
        </div>
      </div>
    `;
  }

  setupActivityTracking() {
    // Track page navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      collaboration.trackPageChange();
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      collaboration.trackPageChange();
    };
    
    window.addEventListener('popstate', () => this.trackPageChange());
    
    // Track some common interactions
    document.addEventListener('click', (e) => {
      if (e.target.matches('.pill') && e.target.textContent.includes('Install')) {
        this.logActivity('install', { item: 'marketplace_item' });
      }
      if (e.target.matches('button') && e.target.textContent.toLowerCase().includes('approve')) {
        this.logActivity('approve', { type: 'request' });
      }
    });
  }

  trackPageChange() {
    const newPage = this.getCurrentPage();
    if (newPage !== this.currentPage) {
      this.currentPage = newPage;
      this.logActivity('page_view', { page: newPage });
      this.updatePresence('page_view');
    }
  }

  async logActivity(action, details = {}) {
    try {
      // Send via WebSocket if available
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'activity',
          user: this.userName,
          action,
          details
        }));
      } else {
        // Fallback to HTTP API
        await fetch('/api/activity/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: this.userName, action, details })
        });
      }
    } catch (e) {
      console.error('[collaboration] Log activity failed:', e);
    }
  }

  toggleActivityFeed() {
    const feed = document.querySelector('.activity-feed');
    if (!feed) return;
    
    if (feed.classList.contains('open')) {
      feed.classList.remove('open');
    } else {
      feed.classList.add('open');
      this.loadActivityFeed(); // Refresh when opening
    }
  }

  showUserSettings() {
    const name = prompt('Enter your display name:', this.userName);
    if (name && name.trim()) {
      this.userName = name.trim();
      localStorage.setItem('collab_user_name', this.userName);
    }
    
    const avatars = ['👤', '😊', '🤖', '👨‍💻', '👩‍💻', '🧑‍💼', '🎯', '⚡', '🚀', '💻'];
    const avatar = prompt('Choose an avatar emoji:', this.userAvatar);
    if (avatar && avatar.trim()) {
      this.userAvatar = avatar.trim();
      localStorage.setItem('collab_user_avatar', this.userAvatar);
    }
    
    this.updatePresence('settings_update');
  }

  clearActivityCache() {
    this.activities = [];
    this.renderActivityFeed();
  }

  formatTimeSince(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  destroy() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

// Initialize collaboration when page loads
let collaboration;

document.addEventListener('DOMContentLoaded', () => {
  collaboration = new CollaborationManager();
  
  // Log initial page view
  collaboration.logActivity('page_view', { page: collaboration.currentPage });
});

// Export for global access
window.collaboration = collaboration;