// Notifications Center - Bell icon, panel, SSE stream, inline actions
class NotificationsCenter {
  constructor() {
    this.notifications = [];
    this.eventSource = null;
    this.soundEnabled = true;
    this.panel = null;
    this.bellIcon = null;
    this.init();
  }

  init() {
    this.createBellIcon();
    this.createPanel();
    this.connectSSE();
    this.loadSettings();
  }

  createBellIcon() {
    this.bellIcon = document.createElement('button');
    this.bellIcon.className = 'pill notifications-bell';
    this.bellIcon.innerHTML = '🔔 <span class="badge">0</span>';
    this.bellIcon.title = 'Notifications';
    this.bellIcon.onclick = () => this.togglePanel();
    
    const header = document.querySelector('header .controls');
    if (header) header.prepend(this.bellIcon);
  }

  createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'notifications-panel';
    this.panel.innerHTML = `
      <div class="notifications-header">
        <h3>Notifications</h3>
        <div class="notifications-controls">
          <button class="pill small" onclick="notificationsCenter.markAllRead()">Mark all read</button>
          <button class="pill small" onclick="notificationsCenter.toggleSound()">${this.soundEnabled ? '🔊' : '🔇'}</button>
          <button class="pill small" onclick="notificationsCenter.closePanel()">×</button>
        </div>
      </div>
      <div class="notifications-list"></div>
      <div class="notifications-footer">
        <button class="pill small" onclick="notificationsCenter.generateDemo()">Demo notifications</button>
      </div>
    `;
    
    document.body.appendChild(this.panel);
  }

  connectSSE() {
    if (this.eventSource) this.eventSource.close();
    
    this.eventSource = new EventSource('/api/notifications/stream');
    
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notifications') {
          this.updateNotifications(data.notifications);
        }
      } catch (e) {
        console.error('[notifications] SSE parse error:', e);
      }
    };

    this.eventSource.onerror = () => {
      console.warn('[notifications] SSE connection lost, retrying in 5s...');
      setTimeout(() => this.connectSSE(), 5000);
    };
  }

  updateNotifications(notifications) {
    const newCount = notifications.filter(n => !n.read).length;
    const prevCount = this.notifications.filter(n => !n.read).length;
    
    this.notifications = notifications;
    this.updateBadge(newCount);
    this.renderNotifications();
    
    // Play sound for new notifications
    if (newCount > prevCount && this.soundEnabled && newCount > 0) {
      this.playNotificationSound();
    }
  }

  updateBadge(count) {
    const badge = this.bellIcon?.querySelector('.badge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline' : 'none';
      this.bellIcon.classList.toggle('has-notifications', count > 0);
    }
  }

  renderNotifications() {
    const list = this.panel?.querySelector('.notifications-list');
    if (!list) return;

    if (this.notifications.length === 0) {
      list.innerHTML = '<div class="notification-empty">No notifications</div>';
      return;
    }

    const sortedNotifications = [...this.notifications].reverse(); // Latest first
    list.innerHTML = sortedNotifications.map(n => this.renderNotification(n)).join('');
  }

  renderNotification(notification) {
    const typeIcons = {
      approval: '⚠️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const actions = notification.actions?.map(action => 
      `<button class="pill tiny notification-action" data-id="${notification.id}" data-action="${action.id}">${action.label}</button>`
    ).join('') || '';

    return `
      <div class="notification ${notification.read ? 'read' : 'unread'}" data-id="${notification.id}">
        <div class="notification-icon">${typeIcons[notification.type] || 'ℹ️'}</div>
        <div class="notification-content">
          <div class="notification-title">${notification.title}</div>
          <div class="notification-message">${notification.message}</div>
          <div class="notification-time">${this.formatTime(notification.timestamp)}</div>
        </div>
        <div class="notification-actions">${actions}</div>
      </div>
    `;
  }

  formatTime(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  togglePanel() {
    this.panel.classList.toggle('open');
    if (this.panel.classList.contains('open')) {
      // Mark as viewed when panel opens
      setTimeout(() => this.markAllRead(), 2000);
    }
  }

  closePanel() {
    this.panel.classList.remove('open');
  }

  async markAllRead() {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true })
      });
      
      if (response.ok) {
        this.notifications.forEach(n => n.read = true);
        this.updateBadge(0);
        this.renderNotifications();
      }
    } catch (e) {
      console.error('[notifications] Mark all read failed:', e);
    }
  }

  async handleAction(id, action) {
    try {
      const response = await fetch('/api/notifications/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      });
      
      if (response.ok) {
        // Remove notification from local list
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.updateBadge(this.notifications.filter(n => !n.read).length);
        this.renderNotifications();
        
        if (action === 'approve') {
          this.showToast('Approval granted', 'success');
        }
      }
    } catch (e) {
      console.error('[notifications] Action failed:', e);
      this.showToast('Action failed', 'error');
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('notifications_sound', String(this.soundEnabled));
    
    const button = this.panel.querySelector('.notifications-controls button:nth-child(2)');
    if (button) button.textContent = this.soundEnabled ? '🔊' : '🔇';
    
    this.showToast(`Sound ${this.soundEnabled ? 'enabled' : 'disabled'}`, 'info');
  }

  playNotificationSound() {
    if (this.soundEnabled) {
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBDSE0fPTeSUEIHPF8OGVQAoUYrjm7a5bIAc1iNz3yGsnBS12yPLVe');
      } catch {}
    }
  }

  async generateDemo() {
    try {
      await fetch('/api/notifications/demo', { method: 'POST' });
      this.showToast('Demo notifications generated', 'info');
    } catch (e) {
      console.error('[notifications] Demo failed:', e);
    }
  }

  loadSettings() {
    const soundSetting = localStorage.getItem('notifications_sound');
    this.soundEnabled = soundSetting !== 'false';
  }

  showToast(message, type) {
    // Use existing toast function if available
    if (window.showToast) {
      window.showToast(message, type, 3000);
    }
  }

  destroy() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.panel) this.panel.remove();
    if (this.bellIcon) this.bellIcon.remove();
  }
}

// Initialize notifications center
let notificationsCenter;

document.addEventListener('DOMContentLoaded', () => {
  notificationsCenter = new NotificationsCenter();
  
  // Handle notification actions through event delegation
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('notification-action')) {
      const id = e.target.dataset.id;
      const action = e.target.dataset.action;
      if (id && action) {
        notificationsCenter.handleAction(id, action);
      }
    }
  });
});

// Export for global access
window.notificationsCenter = notificationsCenter;