// Approvals Workflow - Real-time Queue Management
let approvalsQueue = [];
let auditLog = [];
let currentFilter = 'pending';
let selectedApproval = null;
let userRole = 'admin'; // Default role, fetched from session
let eventSource = null;

// Initialize
(async function init() {
  await loadUserRole();
  await loadQueue();
  await loadAuditLog();
  renderQueue();
  renderAuditTrail();
  connectSSE();
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }
  });
})();

async function loadUserRole() {
  try {
    const res = await fetch('/api/approvals/role');
    const data = await res.json();
    userRole = data.role || 'viewer';
    document.getElementById('userRole').textContent = `Role: ${capitalize(userRole)}`;
  } catch (e) {
    console.error('Failed to load user role:', e);
  }
}

async function loadQueue() {
  try {
    const res = await fetch('/api/approvals/queue');
    const data = await res.json();
    approvalsQueue = data.approvals || [];
    updateCounts();
  } catch (e) {
    console.error('Failed to load approvals queue:', e);
    showToast('Failed to load approvals queue', 'error');
  }
}

async function loadAuditLog() {
  try {
    const res = await fetch('/api/approvals/audit');
    const data = await res.json();
    auditLog = data.audit || [];
  } catch (e) {
    console.error('Failed to load audit log:', e);
  }
}

function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }
  
  eventSource = new EventSource('/api/approvals/stream');
  
  eventSource.addEventListener('approval-update', (e) => {
    const data = JSON.parse(e.data);
    handleApprovalUpdate(data);
  });
  
  eventSource.addEventListener('audit-entry', (e) => {
    const data = JSON.parse(e.data);
    auditLog.unshift(data);
    renderAuditTrail();
  });
  
  eventSource.onerror = (e) => {
    console.error('SSE connection error:', e);
    // Reconnect after 5s
    setTimeout(() => connectSSE(), 5000);
  };
}

function handleApprovalUpdate(data) {
  const { id, status, action } = data;
  
  if (action === 'created') {
    approvalsQueue.unshift(data.approval);
  } else if (action === 'updated') {
    const idx = approvalsQueue.findIndex(a => a.id === id);
    if (idx >= 0) {
      approvalsQueue[idx] = { ...approvalsQueue[idx], ...data.approval };
    }
  } else if (action === 'deleted') {
    approvalsQueue = approvalsQueue.filter(a => a.id !== id);
  }
  
  updateCounts();
  renderQueue();
}

function updateCounts() {
  const pending = approvalsQueue.filter(a => a.status === 'pending').length;
  const approved = approvalsQueue.filter(a => a.status === 'approved').length;
  const rejected = approvalsQueue.filter(a => a.status === 'rejected').length;
  
  document.getElementById('pendingCount').textContent = pending;
  document.getElementById('approvedCount').textContent = approved;
  document.getElementById('rejectedCount').textContent = rejected;
}

function filterQueue(status) {
  currentFilter = status;
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === status);
  });
  renderQueue();
}

function renderQueue() {
  const container = document.getElementById('queueContainer');
  const emptyState = document.getElementById('emptyState');
  
  let filtered = approvalsQueue;
  if (currentFilter !== 'all') {
    filtered = approvalsQueue.filter(a => a.status === currentFilter);
  }
  
  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }
  
  emptyState.style.display = 'none';
  
  container.innerHTML = filtered.map(approval => {
    const statusClass = approval.status === 'approved' ? 'success' : 
                        approval.status === 'rejected' ? 'error' : 'pending';
    const canApprove = userRole === 'admin' || userRole === 'approver';
    const isPending = approval.status === 'pending';
    
    return `
      <div class="card approval-card ${statusClass}">
        <div class="approval-header">
          <div>
            <div class="approval-title">${escapeHtml(approval.title)}</div>
            <div class="approval-meta">
              ${getTypeIcon(approval.type)} ${approval.type} • 
              Requested by ${escapeHtml(approval.requester)} • 
              ${formatTimeAgo(approval.createdAt)}
            </div>
          </div>
          <div class="approval-status">
            <span class="badge ${statusClass}">${capitalize(approval.status)}</span>
          </div>
        </div>
        
        <div class="approval-body">
          <p>${escapeHtml(approval.description)}</p>
          ${approval.metadata ? `<div class="approval-metadata">${renderMetadata(approval.metadata)}</div>` : ''}
        </div>
        
        <div class="approval-actions">
          <button class="pill" onclick="viewDetails('${approval.id}')">📋 Details</button>
          ${isPending && canApprove ? `
            <button class="pill success" onclick="openApproveModal('${approval.id}')">✓ Approve</button>
            <button class="pill error" onclick="openRejectModal('${approval.id}')">✗ Reject</button>
          ` : ''}
          ${approval.status !== 'pending' ? `
            <div class="approval-resolution">
              ${approval.status === 'approved' ? '✓' : '✗'} by ${escapeHtml(approval.approvedBy || 'System')}
              ${approval.comment ? `<br><em>"${escapeHtml(approval.comment)}"</em>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderAuditTrail() {
  const container = document.getElementById('auditContainer');
  
  if (auditLog.length === 0) {
    container.innerHTML = '<div class="empty-subtext">No audit entries yet</div>';
    return;
  }
  
  container.innerHTML = auditLog.slice(0, 50).map(entry => `
    <div class="audit-entry">
      <div class="audit-time">${formatDateTime(entry.timestamp)}</div>
      <div class="audit-content">
        <strong>${escapeHtml(entry.user)}</strong> ${entry.action} 
        <em>${escapeHtml(entry.target)}</em>
        ${entry.details ? `<span class="audit-details">${escapeHtml(entry.details)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function renderMetadata(metadata) {
  return Object.entries(metadata).map(([key, value]) => 
    `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</div>`
  ).join('');
}

function getTypeIcon(type) {
  const icons = {
    'deployment': '🚀',
    'config-change': '⚙️',
    'agent-update': '🤖',
    'access-request': '🔑',
    'budget-increase': '💰',
    'skill-install': '📦',
    'project-delete': '🗑️'
  };
  return icons[type] || '📄';
}

async function openApproveModal(id) {
  const approval = approvalsQueue.find(a => a.id === id);
  if (!approval) return;
  
  selectedApproval = approval;
  document.getElementById('approveText').textContent = 
    `Approve "${approval.title}" requested by ${approval.requester}?`;
  document.getElementById('approveComment').value = '';
  document.getElementById('approveModal').style.display = 'flex';
}

async function openRejectModal(id) {
  const approval = approvalsQueue.find(a => a.id === id);
  if (!approval) return;
  
  selectedApproval = approval;
  document.getElementById('rejectText').textContent = 
    `Reject "${approval.title}" requested by ${approval.requester}?`;
  document.getElementById('rejectReason').value = '';
  document.getElementById('rejectModal').style.display = 'flex';
}

async function confirmApprove() {
  if (!selectedApproval) return;
  
  const comment = document.getElementById('approveComment').value.trim();
  
  try {
    const res = await fetch(`/api/approvals/${selectedApproval.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment })
    });
    
    if (!res.ok) throw new Error('Approval failed');
    
    showToast('Request approved successfully', 'success');
    closeModal('approveModal');
    await loadQueue();
    await loadAuditLog();
    renderQueue();
    renderAuditTrail();
  } catch (e) {
    showToast('Failed to approve request', 'error');
    console.error(e);
  }
}

async function confirmReject() {
  if (!selectedApproval) return;
  
  const reason = document.getElementById('rejectReason').value.trim();
  
  if (!reason) {
    showToast('Rejection reason is required', 'error');
    return;
  }
  
  try {
    const res = await fetch(`/api/approvals/${selectedApproval.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    
    if (!res.ok) throw new Error('Rejection failed');
    
    showToast('Request rejected', 'success');
    closeModal('rejectModal');
    await loadQueue();
    await loadAuditLog();
    renderQueue();
    renderAuditTrail();
  } catch (e) {
    showToast('Failed to reject request', 'error');
    console.error(e);
  }
}

function viewDetails(id) {
  const approval = approvalsQueue.find(a => a.id === id);
  if (!approval) return;
  
  const content = `
    <div class="details-grid">
      <div><strong>ID:</strong></div><div>${approval.id}</div>
      <div><strong>Type:</strong></div><div>${approval.type}</div>
      <div><strong>Requester:</strong></div><div>${escapeHtml(approval.requester)}</div>
      <div><strong>Status:</strong></div><div>${capitalize(approval.status)}</div>
      <div><strong>Created:</strong></div><div>${formatDateTime(approval.createdAt)}</div>
      ${approval.approvedBy ? `
        <div><strong>Approved By:</strong></div><div>${escapeHtml(approval.approvedBy)}</div>
        <div><strong>Approved At:</strong></div><div>${formatDateTime(approval.approvedAt)}</div>
      ` : ''}
      ${approval.metadata ? `
        <div style="grid-column: 1/-1; margin-top: 8px;"><strong>Metadata:</strong></div>
        <div style="grid-column: 1/-1;">${renderMetadata(approval.metadata)}</div>
      ` : ''}
    </div>
  `;
  
  document.getElementById('detailsContent').innerHTML = content;
  document.getElementById('detailsModal').style.display = 'flex';
}

async function exportAuditLog() {
  try {
    const res = await fetch('/api/approvals/audit/export');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Audit log exported', 'success');
  } catch (e) {
    showToast('Failed to export audit log', 'error');
    console.error(e);
  }
}

async function refreshQueue() {
  await loadQueue();
  await loadAuditLog();
  renderQueue();
  renderAuditTrail();
  showToast('Queue refreshed', 'success');
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
  selectedApproval = null;
}

// Utility functions
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (eventSource) {
    eventSource.close();
  }
});
