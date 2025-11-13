// Prompt Library - State & Data Management
let allPrompts = [];
let filteredPrompts = [];
let currentEditingId = null;
let starred = JSON.parse(localStorage.getItem('library:starred') || '[]');
let usageCount = JSON.parse(localStorage.getItem('library:usage') || '{}');
let chainSteps = [];

// Built-in templates
const TEMPLATES = [
  {
    title: 'Deploy to Production',
    body: 'Deploy {{project}} to {{env}} environment.\nGit branch: {{branch}}\nChecklist:\n- Run tests\n- Build artifacts\n- Update configs\n- Deploy\n- Verify health checks',
    tags: ['deploy', 'production'],
    model: 'claude',
    notes: 'Standard deployment workflow'
  },
  {
    title: 'Debug Error Investigation',
    body: 'Investigate error in {{file}}:\n\nError: {{error_message}}\n\nContext:\n- Repo: {{project}}\n- Branch: {{branch}}\n- User: {{user}}\n\nSteps:\n1. Check recent changes (git log)\n2. Review error logs\n3. Identify root cause\n4. Propose fix',
    tags: ['debug', 'error'],
    model: 'router',
    notes: 'Systematic error debugging'
  },
  {
    title: 'Code Refactoring',
    body: 'Refactor {{file}} to improve:\n- Code readability\n- Performance\n- Maintainability\n\nConstraints:\n- Keep existing API\n- Add tests\n- No breaking changes\n\nProject: {{project}}',
    tags: ['refactor', 'code-quality'],
    model: 'claude',
    notes: 'Safe refactoring guidelines'
  },
  {
    title: 'Feature Development',
    body: 'Implement new feature: {{feature_name}}\n\nRequirements:\n{{requirements}}\n\nProject: {{project}}\nDeadline: {{deadline}}\n\nTasks:\n- Design API\n- Write tests\n- Implement\n- Document',
    tags: ['feature', 'development'],
    model: 'gpt',
    notes: 'Feature dev workflow'
  },
  {
    title: 'Database Migration',
    body: 'Create migration for {{table}}:\n\nChanges:\n{{changes}}\n\nEnvironment: {{env}}\nDatabase: {{db_name}}\n\nValidation:\n- Backup before migration\n- Test on staging\n- Rollback plan ready',
    tags: ['database', 'migration'],
    model: 'deepseek',
    notes: 'Safe database changes'
  }
];

// Context-aware variable resolver
function resolveVariables(text) {
  const vars = {
    user: getCurrentUser(),
    project: getProjectName(),
    branch: getCurrentBranch(),
    env: getEnvironment(),
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString()
  };
  
  let resolved = text;
  for (const [key, value] of Object.entries(vars)) {
    resolved = resolved.replace(new RegExp(`{{${key}}}`, 'g'), value || `[${key}]`);
  }
  
  // Highlight unresolved variables
  resolved = resolved.replace(/{{(\w+)}}/g, '<span style="background:yellow;color:black;padding:0 2px;">{{$1}}</span>');
  
  return resolved;
}

function getCurrentUser() {
  return localStorage.getItem('user:name') || 'developer';
}

function getProjectName() {
  return localStorage.getItem('context:project') || 'warp-dashboard';
}

function getCurrentBranch() {
  return localStorage.getItem('context:branch') || 'main';
}

function getEnvironment() {
  return localStorage.getItem('context:env') || 'development';
}

// Load prompts from API
async function loadPrompts() {
  try {
    const res = await fetch('/api/prompts/library');
    const data = await res.json();
    allPrompts = data.prompts || [];
    applyFilters();
  } catch (e) {
    console.error('Failed to load prompts:', e);
    showToast('Failed to load prompts', 'error');
  }
}

// Apply filters and render
function applyFilters() {
  const search = document.getElementById('search').value.toLowerCase();
  const tagFilter = document.getElementById('filterTags').value;
  const modelFilter = document.getElementById('filterModel').value;
  const starredOnly = document.getElementById('filterStarred').checked;
  const sortBy = document.getElementById('sortBy').value;
  
  filtered = allPrompts.filter(p => {
    if (search && !p.title?.toLowerCase().includes(search) && !p.body?.toLowerCase().includes(search)) return false;
    if (tagFilter && !(p.tags || []).includes(tagFilter)) return false;
    if (modelFilter && p.model !== modelFilter) return false;
    if (starredOnly && !starred.includes(p.id)) return false;
    return true;
  });
  
  // Sort
  if (sortBy === 'recent') filtered.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  else if (sortBy === 'oldest') filtered.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  else if (sortBy === 'title') filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (sortBy === 'usage') filtered.sort((a, b) => (usageCount[b.id] || 0) - (usageCount[a.id] || 0));
  
  renderPromptGrid(filtered);
  updateTagFilter();
}

function updateTagFilter() {
  const select = document.getElementById('filterTags');
  const allTags = new Set();
  allPrompts.forEach(p => (p.tags || []).forEach(t => allTags.add(t)));
  
  const current = select.value;
  select.innerHTML = '<option value="">All Tags</option>';
  Array.from(allTags).sort().forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    select.appendChild(opt);
  });
  select.value = current;
}

// Render prompt cards
function renderPromptGrid(prompts) {
  const grid = document.getElementById('promptGrid');
  if (!prompts.length) {
    grid.innerHTML = '<div class="card" style="text-align:center; opacity:0.6;">No prompts found. Create one!</div>';
    return;
  }
  
  grid.innerHTML = prompts.map(p => {
    const isStarred = starred.includes(p.id);
    const usage = usageCount[p.id] || 0;
    const lastUsed = p.lastUsed ? new Date(p.lastUsed * 1000).toLocaleString() : 'Never';
    
    return `
      <div class="prompt-card" data-id="${p.id}">
        <div class="prompt-header">
          <h3>${escapeHtml(p.title || 'Untitled')}</h3>
          <button class="star-btn ${isStarred ? 'starred' : ''}" onclick="toggleStar('${p.id}')" title="Star/Unstar">
            ${isStarred ? '⭐' : '☆'}
          </button>
        </div>
        <div class="prompt-body">
          <pre class="small">${escapeHtml((p.body || '').slice(0, 150))}${p.body?.length > 150 ? '...' : ''}</pre>
        </div>
        <div class="prompt-meta">
          <span class="small">Model: ${p.model || 'N/A'}</span>
          <span class="small">Used: ${usage}×</span>
          <span class="small" title="Last used">${lastUsed}</span>
        </div>
        <div class="prompt-tags">
          ${(p.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="prompt-actions">
          <button class="pill" onclick="runPrompt('${p.id}')">▶ Run</button>
          <button class="pill" onclick="editPrompt('${p.id}')">✏️ Edit</button>
          <button class="pill" onclick="duplicatePrompt('${p.id}')">📋 Duplicate</button>
          <button class="pill" onclick="viewVersions('${p.id}')">🕒 Versions</button>
          <button class="pill" onclick="deletePrompt('${p.id}')" style="color: var(--error);">🗑 Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// CRUD operations
function showCreateModal() {
  currentEditingId = null;
  document.getElementById('modalTitle').textContent = 'New Prompt';
  document.getElementById('editTitle').value = '';
  document.getElementById('editTags').value = '';
  document.getElementById('editModel').value = 'router';
  document.getElementById('editNotes').value = '';
  document.getElementById('editBody').value = '';
  document.getElementById('previewSection').style.display = 'none';
  document.getElementById('editModal').style.display = 'flex';
}

function editPrompt(id) {
  const prompt = allPrompts.find(p => p.id === id);
  if (!prompt) return;
  
  currentEditingId = id;
  document.getElementById('modalTitle').textContent = 'Edit Prompt';
  document.getElementById('editTitle').value = prompt.title || '';
  document.getElementById('editTags').value = (prompt.tags || []).join(',');
  document.getElementById('editModel').value = prompt.model || 'router';
  document.getElementById('editNotes').value = prompt.notes || '';
  document.getElementById('editBody').value = prompt.body || '';
  document.getElementById('previewSection').style.display = 'none';
  document.getElementById('editModal').style.display = 'flex';
}

async function savePrompt() {
  const title = document.getElementById('editTitle').value.trim();
  const body = document.getElementById('editBody').value;
  const tags = document.getElementById('editTags').value.split(',').map(s => s.trim()).filter(Boolean);
  const model = document.getElementById('editModel').value || 'router';
  const notes = document.getElementById('editNotes').value || '';
  
  if (!title) {
    showToast('Title required', 'error');
    return;
  }
  
  try {
    const endpoint = currentEditingId ? '/api/prompts/update' : '/api/prompts/save';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentEditingId, title, body, tags, model, notes })
    });
    
    if (!res.ok) throw new Error('Save failed');
    
    showToast(currentEditingId ? 'Prompt updated' : 'Prompt created', 'success');
    closeModal();
    loadPrompts();
  } catch (e) {
    showToast('Failed to save prompt', 'error');
  }
}

async function deletePrompt(id) {
  if (!confirm('Delete this prompt? This cannot be undone.')) return;
  
  try {
    const res = await fetch('/api/prompts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    
    if (!res.ok) throw new Error('Delete failed');
    
    showToast('Prompt deleted', 'success');
    loadPrompts();
  } catch (e) {
    showToast('Failed to delete prompt', 'error');
  }
}

function duplicatePrompt(id) {
  const prompt = allPrompts.find(p => p.id === id);
  if (!prompt) return;
  
  currentEditingId = null;
  document.getElementById('modalTitle').textContent = 'Duplicate Prompt';
  document.getElementById('editTitle').value = `${prompt.title} (Copy)`;
  document.getElementById('editTags').value = (prompt.tags || []).join(',');
  document.getElementById('editModel').value = prompt.model || 'router';
  document.getElementById('editNotes').value = prompt.notes || '';
  document.getElementById('editBody').value = prompt.body || '';
  document.getElementById('previewSection').style.display = 'none';
  document.getElementById('editModal').style.display = 'flex';
}

async function runPrompt(id) {
  const prompt = allPrompts.find(p => p.id === id);
  if (!prompt) return;
  
  // Increment usage
  usageCount[id] = (usageCount[id] || 0) + 1;
  localStorage.setItem('library:usage', JSON.stringify(usageCount));
  
  // Update last used
  prompt.lastUsed = Date.now() / 1000;
  
  try {
    const res = await fetch('/api/prompts/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, body: prompt.body, model: prompt.model })
    });
    
    const data = await res.json();
    showToast('Prompt executed', 'success');
    
    // Optionally show output in modal or navigate to results
    alert(`Output:\n${data.output || 'No output'}`);
  } catch (e) {
    showToast('Failed to run prompt', 'error');
  }
}

// Star/Unstar
function toggleStar(id) {
  if (starred.includes(id)) {
    starred = starred.filter(s => s !== id);
  } else {
    starred.push(id);
  }
  localStorage.setItem('library:starred', JSON.stringify(starred));
  applyFilters();
}

// Preview with variables resolved
function previewPrompt() {
  const body = document.getElementById('editBody').value;
  const resolved = resolveVariables(body);
  document.getElementById('previewBody').innerHTML = resolved;
  document.getElementById('previewSection').style.display = 'block';
}

// Template Gallery
function showTemplates() {
  const grid = document.getElementById('templateGrid');
  grid.innerHTML = TEMPLATES.map((t, idx) => `
    <div class="template-card">
      <h3>${escapeHtml(t.title)}</h3>
      <pre class="small">${escapeHtml(t.body.slice(0, 120))}...</pre>
      <div class="small" style="margin-top: 0.5rem; opacity: 0.7;">${t.notes}</div>
      <button class="pill" onclick="useTemplate(${idx})" style="margin-top: 0.5rem; width: 100%;">Use Template</button>
    </div>
  `).join('');
  document.getElementById('templateModal').style.display = 'flex';
}

function useTemplate(idx) {
  const t = TEMPLATES[idx];
  currentEditingId = null;
  document.getElementById('modalTitle').textContent = `New from Template: ${t.title}`;
  document.getElementById('editTitle').value = t.title;
  document.getElementById('editTags').value = t.tags.join(',');
  document.getElementById('editModel').value = t.model;
  document.getElementById('editNotes').value = t.notes;
  document.getElementById('editBody').value = t.body;
  closeTemplateModal();
  document.getElementById('editModal').style.display = 'flex';
}

// Versioning
async function viewVersions(id) {
  try {
    const res = await fetch(`/api/prompts/${id}/versions`);
    const data = await res.json();
    const versions = data.versions || [];
    
    const list = document.getElementById('versionList');
    if (!versions.length) {
      list.innerHTML = '<div style="text-align:center;opacity:0.6;">No version history</div>';
    } else {
      list.innerHTML = versions.map((v, idx) => `
        <div class="version-item">
          <div class="row" style="justify-content: space-between;">
            <strong>v${versions.length - idx}</strong>
            <span class="small">${new Date(v.ts * 1000).toLocaleString()}</span>
          </div>
          <pre class="small">${escapeHtml(v.body.slice(0, 100))}...</pre>
          <div class="row" style="gap: 8px; margin-top: 0.5rem;">
            <button class="pill" onclick="rollbackVersion('${id}', ${idx})">↩ Rollback</button>
            <button class="pill" onclick="viewDiff(${idx})">📊 View Changes</button>
          </div>
        </div>
      `).join('');
    }
    
    document.getElementById('versionModal').style.display = 'flex';
  } catch (e) {
    showToast('Failed to load versions', 'error');
  }
}

async function rollbackVersion(id, versionIdx) {
  if (!confirm('Rollback to this version?')) return;
  
  try {
    const res = await fetch('/api/prompts/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, versionIdx })
    });
    
    if (!res.ok) throw new Error('Rollback failed');
    
    showToast('Rolled back to previous version', 'success');
    closeVersionModal();
    loadPrompts();
  } catch (e) {
    showToast('Failed to rollback', 'error');
  }
}

// Chain Builder
function showChainBuilder(promptId = null) {
  chainSteps = [];
  if (promptId) {
    const prompt = allPrompts.find(p => p.id === promptId);
    if (prompt) addChainStep(prompt);
  } else {
    addChainStep();
  }
  document.getElementById('chainModal').style.display = 'flex';
}

function addChainStep(prompt = null) {
  const stepIdx = chainSteps.length;
  const step = {
    id: Math.random().toString(36).slice(2),
    promptId: prompt?.id || null,
    body: prompt?.body || '',
    model: prompt?.model || 'router',
    condition: null
  };
  chainSteps.push(step);
  renderChainSteps();
}

function renderChainSteps() {
  const container = document.getElementById('chainSteps');
  container.innerHTML = chainSteps.map((step, idx) => `
    <div class="chain-step">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <strong>Step ${idx + 1}</strong>
        <button class="pill" onclick="removeChainStep(${idx})" style="color: var(--error);">✕</button>
      </div>
      <select class="pill" onchange="selectChainPrompt(${idx}, this.value)" style="width: 100%; margin-top: 0.5rem;">
        <option value="">Select Prompt...</option>
        ${allPrompts.map(p => `<option value="${p.id}" ${step.promptId === p.id ? 'selected' : ''}>${escapeHtml(p.title)}</option>`).join('')}
      </select>
      <textarea rows="3" id="chainBody${idx}" style="width: 100%; margin-top: 0.5rem; font-family: monospace;">${escapeHtml(step.body)}</textarea>
      <input class="pill" placeholder="Condition (optional): if {{step${idx}.output}} contains 'error'" style="width: 100%; margin-top: 0.5rem;" value="${step.condition || ''}" onchange="updateChainCondition(${idx}, this.value)" />
    </div>
  `).join('');
}

function selectChainPrompt(idx, promptId) {
  const prompt = allPrompts.find(p => p.id === promptId);
  if (prompt) {
    chainSteps[idx].promptId = promptId;
    chainSteps[idx].body = prompt.body;
    chainSteps[idx].model = prompt.model;
    renderChainSteps();
  }
}

function removeChainStep(idx) {
  chainSteps.splice(idx, 1);
  renderChainSteps();
}

function updateChainCondition(idx, condition) {
  chainSteps[idx].condition = condition;
}

async function saveChain() {
  const name = document.getElementById('chainName').value.trim();
  if (!name) {
    showToast('Chain name required', 'error');
    return;
  }
  
  // Sync textarea values
  chainSteps.forEach((step, idx) => {
    const textarea = document.getElementById(`chainBody${idx}`);
    if (textarea) step.body = textarea.value;
  });
  
  try {
    const res = await fetch('/api/prompts/save-chain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, steps: chainSteps })
    });
    
    if (!res.ok) throw new Error('Save chain failed');
    
    showToast('Chain saved', 'success');
  } catch (e) {
    showToast('Failed to save chain', 'error');
  }
}

async function runChain() {
  // Sync textarea values
  chainSteps.forEach((step, idx) => {
    const textarea = document.getElementById(`chainBody${idx}`);
    if (textarea) step.body = textarea.value;
  });
  
  try {
    const res = await fetch('/api/prompts/run-chain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: chainSteps })
    });
    
    const data = await res.json();
    document.getElementById('chainResult').textContent = JSON.stringify(data.outputs || [], null, 2);
    document.getElementById('chainOutput').style.display = 'block';
    showToast('Chain executed', 'success');
  } catch (e) {
    showToast('Failed to run chain', 'error');
  }
}

// Import/Export
async function importPrompts() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.yaml,.yml';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = file.name.endsWith('.json') ? JSON.parse(text) : parseYAML(text);
      
      const res = await fetch('/api/prompts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts: data.prompts || data })
      });
      
      if (!res.ok) throw new Error('Import failed');
      
      showToast(`Imported ${data.prompts?.length || 0} prompts`, 'success');
      loadPrompts();
    } catch (e) {
      showToast('Failed to import', 'error');
    }
  };
  input.click();
}

async function exportPrompts() {
  try {
    const res = await fetch('/api/prompts/export?format=json');
    const data = await res.json();
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Prompts exported', 'success');
  } catch (e) {
    showToast('Failed to export', 'error');
  }
}

// Modal controls
function closeModal() {
  document.getElementById('editModal').style.display = 'none';
}

function closeTemplateModal() {
  document.getElementById('templateModal').style.display = 'none';
}

function closeVersionModal() {
  document.getElementById('versionModal').style.display = 'none';
}

function closeChainModal() {
  document.getElementById('chainModal').style.display = 'none';
}

// Utilities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function showToast(msg, type = 'info') {
  // Reuse existing toast system if available, or simple alert
  if (window.toast) {
    window.toast(msg, type);
  } else {
    console.log(`[${type}] ${msg}`);
  }
}

function parseYAML(text) {
  // Simplified YAML parser (use js-yaml if needed)
  try {
    return JSON.parse(text);
  } catch {
    return { prompts: [] };
  }
}

// Search debounce
let searchTimeout;
document.getElementById('search')?.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(applyFilters, 300);
});

// Initialize
loadPrompts();
