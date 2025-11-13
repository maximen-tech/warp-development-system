/**
 * HISTORY PANEL - Real-time code change tracking
 */

(function() {
  'use strict';

  const HistoryPanel = {
    changes: [],
    projectId: null,
    eventSource: null
  };

  window.initHistoryPanel = function() {
    const panelHTML = `
      <div id="historyPanel" class="history-panel" style="display:none">
        <div class="history-header">
          <h3>📝 Code History</h3>
          <button class="history-btn" onclick="closeHistory()">✕</button>
        </div>
        <div class="history-content" id="historyContent">
          <div class="history-empty">No changes yet. Start coding!</div>
        </div>
        <button class="history-see-more" onclick="showFullHistory()">See All History</button>
      </div>
      
      <!-- Full History Modal -->
      <div class="history-modal" id="historyModal" style="display:none">
        <div class="history-modal-content">
          <div class="history-modal-header">
            <h2>📜 Full Code History</h2>
            <input type="text" id="historySearch" placeholder="Search by filename..." class="history-search" />
            <button class="history-btn" onclick="closeFullHistory()">✕</button>
          </div>
          <div class="history-modal-body" id="historyModalBody">
            <div class="history-loading">Loading...</div>
          </div>
          <div class="history-modal-footer">
            <button class="button secondary" id="historyPrevPage">← Previous</button>
            <span id="historyPagination">Page 1 of 1</span>
            <button class="button secondary" id="historyNextPage">Next →</button>
          </div>
        </div>
      </div>
      
      <!-- Diff Viewer Modal -->
      <div class="history-modal" id="diffModal" style="display:none">
        <div class="history-modal-content diff-modal">
          <div class="history-modal-header">
            <h2>🔍 Diff Viewer</h2>
            <button class="history-btn" onclick="closeDiffViewer()">✕</button>
          </div>
          <div class="history-modal-body" id="diffViewerBody">
            <pre class="diff-viewer"></pre>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', panelHTML);

    // Auto-open if project context exists
    const projectId = localStorage.getItem('active_project_id');
    if (projectId) {
      HistoryPanel.projectId = projectId;
      loadRecentChanges();
      showHistoryPanel();
    }
  };

  window.showHistoryPanel = function() {
    document.getElementById('historyPanel').style.display = 'flex';
  };

  window.closeHistory = function() {
    document.getElementById('historyPanel').style.display = 'none';
  };

  async function loadRecentChanges() {
    if (!HistoryPanel.projectId) return;

    try {
      const response = await fetch(`/api/code-history/${HistoryPanel.projectId}?limit=5`);
      const data = await response.json();

      HistoryPanel.changes = data.changes || [];
      renderRecentChanges();
    } catch (error) {
      console.error('[history] Load recent changes failed:', error);
    }
  }

  function renderRecentChanges() {
    const container = document.getElementById('historyContent');
    if (!container) return;

    if (HistoryPanel.changes.length === 0) {
      container.innerHTML = '<div class="history-empty">No changes yet. Start coding!</div>';
      return;
    }

    container.innerHTML = HistoryPanel.changes.map(change => renderChangeCard(change)).join('');
  }

  function renderChangeCard(change) {
    const timeAgo = getTimeAgo(change.timestamp);
    const addedColor = change.lines_added > 0 ? '#27d980' : '#666';
    const removedColor = change.lines_removed > 0 ? '#ff6b6b' : '#666';

    return `
      <div class="history-card">
        <div class="history-card-header">
          <span class="history-file">📄 ${change.file}</span>
          <span class="history-time">${timeAgo}</span>
        </div>
        <div class="history-card-stats">
          <span class="history-stat" style="color: ${addedColor}">+${change.lines_added}</span>
          <span class="history-stat" style="color: ${removedColor}">-${change.lines_removed}</span>
          ${change.commit_hash ? `<span class="history-commit">${change.commit_hash}</span>` : ''}
        </div>
        <div class="history-card-preview">
          <code>${escapeHtml(change.diff.split('\\n').slice(0, 3).join('\\n'))}</code>
        </div>
      </div>
    `;
  }

  window.showFullHistory = async function() {
    const modal = document.getElementById('historyModal');
    modal.style.display = 'flex';

    await loadFullHistory(1);
  };

  window.closeFullHistory = function() {
    document.getElementById('historyModal').style.display = 'none';
  };

  let currentPage = 1;
  let totalPages = 1;

  async function loadFullHistory(page) {
    if (!HistoryPanel.projectId) return;

    const body = document.getElementById('historyModalBody');
    body.innerHTML = '<div class="history-loading">Loading...</div>';

    try {
      const response = await fetch(`/api/code-history/${HistoryPanel.projectId}/all?page=${page}&limit=20`);
      const data = await response.json();

      currentPage = data.page || 1;
      totalPages = data.pages || 1;

      renderFullHistory(data.entries || []);
      updatePagination();
    } catch (error) {
      console.error('[history] Load full history failed:', error);
      body.innerHTML = '<div class="history-error">Failed to load history</div>';
    }
  }

  function renderFullHistory(entries) {
    const body = document.getElementById('historyModalBody');

    if (entries.length === 0) {
      body.innerHTML = '<div class="history-empty">No changes found</div>';
      return;
    }

    body.innerHTML = `
      <table class="history-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Time</th>
            <th>Changes</th>
            <th>Commit</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(entry => `
            <tr>
              <td class="history-table-file">${escapeHtml(entry.file)}</td>
              <td>${getTimeAgo(entry.timestamp)}</td>
              <td>
                <span style="color: #27d980">+${entry.lines_added}</span>
                <span style="color: #ff6b6b">-${entry.lines_removed}</span>
              </td>
              <td>${entry.commit_hash || '-'}</td>
              <td>
                <button class="button small primary" onclick="viewDiff(${JSON.stringify(entry).replace(/"/g, '&quot;')})">
                  View Diff
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function updatePagination() {
    document.getElementById('historyPagination').textContent = `Page ${currentPage} of ${totalPages}`;

    document.getElementById('historyPrevPage').disabled = currentPage <= 1;
    document.getElementById('historyNextPage').disabled = currentPage >= totalPages;

    document.getElementById('historyPrevPage').onclick = () => {
      if (currentPage > 1) loadFullHistory(currentPage - 1);
    };

    document.getElementById('historyNextPage').onclick = () => {
      if (currentPage < totalPages) loadFullHistory(currentPage + 1);
    };
  }

  window.viewDiff = function(entry) {
    const modal = document.getElementById('diffModal');
    const body = document.getElementById('diffViewerBody');

    body.innerHTML = `<pre class="diff-viewer">${escapeHtml(entry.diff)}</pre>`;
    modal.style.display = 'flex';
  };

  window.closeDiffViewer = function() {
    document.getElementById('diffModal').style.display = 'none';
  };

  function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Refresh history every 10s
  setInterval(() => {
    if (HistoryPanel.projectId) {
      loadRecentChanges();
    }
  }, 10000);

  // Listen for project context changes
  window.addEventListener('storage', (e) => {
    if (e.key === 'active_project_id') {
      HistoryPanel.projectId = e.newValue;
      if (e.newValue) {
        loadRecentChanges();
        showHistoryPanel();
      }
    }
  });

})();