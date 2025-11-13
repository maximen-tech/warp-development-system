// Projects Hub - List, filter, sort, CRUD
class ProjectsHub {
  constructor() {
    this.projects = [];
    this.filteredProjects = [];
    this.searchDebounceTimer = null;
    this.isLoading = false;
    this.init();
  }

  async init() {
    await this.loadProjects();
    this.setupEventListeners();
    this.setupKeyboardNav();
    this.renderProjects();
    this.updateStats();
  }

  async loadProjects() {
    try {
      const params = new URLSearchParams();
      const search = document.getElementById('searchInput')?.value;
      const stack = document.getElementById('stackFilter')?.value;
      const status = document.getElementById('statusFilter')?.value;
      const sort = document.getElementById('sortBy')?.value;
      
      if (search) params.set('search', search);
      if (stack) params.set('stack', stack);
      if (status) params.set('status', status);
      if (sort) params.set('sort', sort);
      
      const response = await fetch(`/api/projects?${params.toString()}`);
      const data = await response.json();
      this.projects = data.projects || [];
      this.filteredProjects = [...this.projects];
    } catch (e) {
      this.showError('Failed to load projects. Please refresh the page.');
    }
  }

  setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const stackFilter = document.getElementById('stackFilter');
    const statusFilter = document.getElementById('statusFilter');
    const sortBy = document.getElementById('sortBy');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => this.applyFilters(), 500);
      });
    }
    
    if (stackFilter) {
      stackFilter.addEventListener('change', () => this.applyFilters());
    }
    
    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.applyFilters());
    }
    
    if (sortBy) {
      sortBy.addEventListener('change', () => this.applyFilters());
    }
  }

  setupKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    });
  }

  async applyFilters() {
    await this.loadProjects();
    this.renderProjects();
    this.updateStats();
  }

  renderProjects() {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    if (this.isLoading) {
      grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading projects...</p></div>';
      return;
    }

    if (this.filteredProjects.length === 0) {
      const searchValue = document.getElementById('searchInput')?.value;
      const hasFilters = searchValue || document.getElementById('stackFilter')?.value || document.getElementById('statusFilter')?.value !== '';
      
      if (hasFilters) {
        grid.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon">🔍</div>
            <h3 class="empty-state__title">No projects found</h3>
            <p class="empty-state__text">Try adjusting your filters or search terms</p>
            <button class="button secondary" onclick="projectsHub.clearFilters()">Clear Filters</button>
          </div>
        `;
      } else {
        grid.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon">🚀</div>
            <h3 class="empty-state__title">No projects yet</h3>
            <p class="empty-state__text">Create a new project or import an existing one to get started</p>
            <div class="empty-state__actions">
              <button class="button primary" onclick="showCreateModal()">➕ Create Project</button>
              <button class="button secondary" onclick="showImportModal()">📥 Import Project</button>
            </div>
          </div>
        `;
      }
      return;
    }

    grid.innerHTML = this.filteredProjects.map(project => this.renderProjectCard(project)).join('');
  }

  renderProjectCard(project) {
    const stackIcons = {
      'Node.js': '🟢',
      'Python': '🐍',
      'Go': '🔵',
      'React': '⚛️',
      'JavaScript': '💛',
      'TypeScript': '🔷'
    };

    const statusBadges = {
      'active': '<span class="status-badge active">✅ Active</span>',
      'archived': '<span class="status-badge archived">📦 Archived</span>',
      'error': '<span class="status-badge error">⚠️ Error</span>'
    };

    const primaryStack = project.tech_stack[0] || 'Unknown';
    const stackIcon = stackIcons[primaryStack] || '📦';
    const statusBadge = statusBadges[project.status] || '';

    const optimizationColor = project.optimization_level >= 80 ? '#10b981' : 
                               project.optimization_level >= 50 ? '#f59e0b' : '#ef4444';

    return `
      <article class="project-card" data-id="${project.id}">
        <header class="project-card__header">
          <div class="project-icon">${stackIcon}</div>
          <div class="project-title">
            <h3>${project.name}</h3>
            ${statusBadge}
          </div>
        </header>
        
        <div class="project-optimization">
          <div class="optimization-label">Optimization</div>
          <div class="optimization-bar">
            <div class="optimization-fill" style="width: ${project.optimization_level}%; background: ${optimizationColor};"></div>
          </div>
          <div class="optimization-value">${project.optimization_level}%</div>
        </div>
        
        <div class="project-stats">
          <div class="stat-item">
            <span class="stat-icon">📄</span>
            <span class="stat-value">${project.stats?.loc?.toLocaleString() || '0'}</span>
            <span class="stat-label">LOC</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🤖</span>
            <span class="stat-value">${project.config?.agents_count || 0}</span>
            <span class="stat-label">Agents</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">⚡</span>
            <span class="stat-value">${project.config?.skills_count || 0}</span>
            <span class="stat-label">Skills</span>
          </div>
        </div>
        
        <div class="project-tech-stack">
          ${project.tech_stack.slice(0, 3).map(tech => `<span class="tech-badge">${tech}</span>`).join('')}
          ${project.tech_stack.length > 3 ? `<span class="tech-badge">+${project.tech_stack.length - 3}</span>` : ''}
        </div>
        
        <footer class="project-card__footer">
          ${project.status === 'archived' 
            ? `<button class="button primary small" onclick="projectsHub.restoreProject('${project.id}')">♻️ Restore</button>` 
            : `<button class="button primary small" onclick="projectsHub.openProject('${project.id}')">Open</button>`
          }
          <button class="button secondary small" onclick="projectsHub.showSettings('${project.id}')">⚙️ Settings</button>
          ${project.status === 'archived'
            ? `<button class="button danger small" onclick="projectsHub.deleteProject('${project.id}')">🗑️ Delete</button>`
            : `<button class="button secondary small" onclick="projectsHub.archiveProject('${project.id}')">📦 Archive</button>`
          }
        </footer>
      </article>
    `;
  }

  updateStats() {
    const projectsCount = document.getElementById('projectsCount');
    const activeCount = document.getElementById('activeCount');
    const avgOptimization = document.getElementById('avgOptimization');

    const total = this.filteredProjects.length;
    const active = this.filteredProjects.filter(p => p.status === 'active').length;
    const avgOpt = total > 0 
      ? Math.round(this.filteredProjects.reduce((sum, p) => sum + p.optimization_level, 0) / total)
      : 0;

    if (projectsCount) projectsCount.textContent = total;
    if (activeCount) activeCount.textContent = active;
    if (avgOptimization) avgOptimization.textContent = `${avgOpt}%`;
  }

  async openProject(id) {
    try {
      const response = await fetch(`/api/projects/${id}`);
      const data = await response.json();
      
      if (data.project) {
        // Set active project in localStorage
        localStorage.setItem('active_project_id', id);
        localStorage.setItem('active_project', JSON.stringify(data.project));
        
        // Redirect to dashboard
        window.location.href = '/';
      }
    } catch (e) {
      this.showError('Failed to open project. Please try again.');
    }
  }

  async showSettings(id) {
    const projects = this.projects;
    const project = projects.find(p => p.id === id);
    if (!project) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <header class="modal-header">
          <h2>⚙️ Project Settings</h2>
          <button class="modal-close" onclick="closeModal()" aria-label="Close">×</button>
        </header>
        <form id="settingsForm" class="modal-form">
          <div class="form-group">
            <label for="settingsName">Project Name</label>
            <input type="text" id="settingsName" value="${project.name}" required />
          </div>
          
          <div class="form-group">
            <label for="settingsPath">Project Path</label>
            <input type="text" id="settingsPath" value="${project.path}" readonly style="background: #f8f9fa;" />
          </div>
          
          <div class="form-group">
            <label for="settingsStatus">Status</label>
            <select id="settingsStatus">
              <option value="active" ${project.status === 'active' ? 'selected' : ''}>✅ Active</option>
              <option value="archived" ${project.status === 'archived' ? 'selected' : ''}>📦 Archived</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Optimization Level</label>
            <div class="optimization-display">
              <div class="optimization-bar">
                <div class="optimization-fill" style="width: ${project.optimization_level}%; background: ${project.optimization_level >= 80 ? '#10b981' : project.optimization_level >= 50 ? '#f59e0b' : '#ef4444'};"></div>
              </div>
              <span class="optimization-value">${project.optimization_level}%</span>
            </div>
          </div>
          
          <div class="form-group">
            <label>Tech Stack</label>
            <div class="tech-stack-list">
              ${project.tech_stack.map(tech => `<span class="tech-badge">${tech}</span>`).join('')}
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="button danger" onclick="projectsHub.confirmDelete('${id}')">🗑️ Delete Project</button>
            <div style="flex: 1;"></div>
            <button type="button" class="button secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="button primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('settingsName')?.focus();

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('settingsName').value.trim();
      const status = document.getElementById('settingsStatus').value;
      
      if (!name) {
        this.showError('Project name is required');
        return;
      }
      
      try {
        const response = await fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, status })
        });
        
        const data = await response.json();
        
        if (data.ok) {
          this.showSuccess('Project updated successfully');
          closeModal();
          await this.loadProjects();
          this.renderProjects();
          this.updateStats();
        } else {
          throw new Error(data.error || 'Update failed');
        }
      } catch (e) {
        this.showError(e.message);
      }
    });
  }

  async confirmDelete(id) {
    const project = this.projects.find(p => p.id === id);
    if (!project) return;
    
    if (!confirm(`⚠️ WARNING: Delete "${project.name}" permanently?\n\nThis action cannot be undone. All project data will be lost.\n\nType the project name to confirm deletion.`)) {
      return;
    }
    
    closeModal();
    await this.deleteProject(id);
  }

  async archiveProject(id) {
    const project = this.projects.find(p => p.id === id);
    if (!project) return;
    
    if (!confirm(`Archive "${project.name}"?\n\nIt will remain accessible but marked as inactive.`)) return;
    
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' })
      });
      
      if (!response.ok) throw new Error('Archive failed');
      
      await this.loadProjects();
      this.renderProjects();
      this.updateStats();
      this.showSuccess(`"${project.name}" archived successfully`);
    } catch (e) {
      this.showError('Failed to archive project');
    }
  }

  async restoreProject(id) {
    const project = this.projects.find(p => p.id === id);
    if (!project) return;
    
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });
      
      if (!response.ok) throw new Error('Restore failed');
      
      await this.loadProjects();
      this.renderProjects();
      this.updateStats();
      this.showSuccess(`"${project.name}" restored to active`);
    } catch (e) {
      this.showError('Failed to restore project');
    }
  }

  async deleteProject(id) {
    const project = this.projects.find(p => p.id === id);
    if (!project) return;
    
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Delete failed');
      
      await this.loadProjects();
      this.renderProjects();
      this.updateStats();
      this.showSuccess(`"${project.name}" deleted permanently`);
    } catch (e) {
      this.showError('Failed to delete project');
    }
  }

  clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('stackFilter').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('sortBy').value = 'accessed';
    this.applyFilters();
  }

  showSuccess(message) {
    this.showToast(message, 'success');
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => toast.remove(), 3000);
  }
}

// Global functions
let projectsHub;

function clearFilters() {
  projectsHub.clearFilters();
}

async function showCreateModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <header class="modal-header">
        <h2>Create New Project</h2>
        <button class="modal-close" onclick="closeModal()">×</button>
      </header>
      <form id="createProjectForm" class="modal-form">
        <div class="form-group">
          <label>Project Name</label>
          <input type="text" id="projectName" required placeholder="my-awesome-app" />
        </div>
        <div class="form-group">
          <label>Template</label>
          <select id="projectTemplate" required>
            <option value="">Select template...</option>
            <option value="nextjs">Next.js + TypeScript + Tailwind</option>
            <option value="express">Express.js API</option>
            <option value="python">Python FastAPI</option>
            <option value="blank">Blank Project</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="button primary">Create Project</button>
        </div>
      </form>
      <div id="createProgress" class="modal-progress" style="display:none;">
        <div class="spinner"></div>
        <p>Creating project...</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById('createProjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('projectName');
    const templateInput = document.getElementById('projectTemplate');
    const name = nameInput.value.trim();
    const template = templateInput.value;
    
    // Client-side validation
    if (!name || name.length < 2) {
      projectsHub.showError('Project name must be at least 2 characters');
      nameInput.focus();
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      projectsHub.showError('Project name can only contain letters, numbers, hyphens and underscores');
      nameInput.focus();
      return;
    }
    if (!template) {
      projectsHub.showError('Please select a template');
      templateInput.focus();
      return;
    }
    
    document.getElementById('createProjectForm').style.display = 'none';
    document.getElementById('createProgress').style.display = 'block';
    
    try {
      const response = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, template })
      });
      
      const data = await response.json();
      
      if (data.success) {
        projectsHub.showSuccess(`Project "${name}" created!`);
        closeModal();
        window.location.href = `/projects.html`;
      } else {
        throw new Error(data.error || 'Creation failed');
      }
    } catch (e) {
      projectsHub.showError(e.message);
      document.getElementById('createProjectForm').style.display = 'block';
      document.getElementById('createProgress').style.display = 'none';
    }
  });
}

async function showImportModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <header class="modal-header">
        <h2>Import Existing Project</h2>
        <button class="modal-close" onclick="closeModal()">×</button>
      </header>
      <form id="importProjectForm" class="modal-form">
        <div class="form-group">
          <label>Import Method</label>
          <div class="radio-group">
            <label><input type="radio" name="importType" value="url" checked /> Git URL</label>
            <label><input type="radio" name="importType" value="path" /> Local Path</label>
          </div>
        </div>
        <div class="form-group" id="urlGroup">
          <label>Repository URL</label>
          <input type="text" id="repoUrl" placeholder="https://github.com/user/repo.git" />
        </div>
        <div class="form-group" id="pathGroup" style="display:none;">
          <label>Project Path</label>
          <input type="text" id="projectPath" placeholder="C:\\Users\\you\\project" />
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="button primary">Import & Optimize</button>
        </div>
      </form>
      <div id="importProgress" class="modal-progress" style="display:none;">
        <div class="spinner"></div>
        <p>Importing and analyzing...</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  document.querySelectorAll('input[name="importType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.getElementById('urlGroup').style.display = e.target.value === 'url' ? 'block' : 'none';
      document.getElementById('pathGroup').style.display = e.target.value === 'path' ? 'block' : 'none';
    });
  });
  
  document.getElementById('importProjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="importType"]:checked').value;
    const urlInput = document.getElementById('repoUrl');
    const pathInput = document.getElementById('projectPath');
    const source = type === 'url' ? urlInput.value.trim() : pathInput.value.trim();
    
    if (!source) {
      projectsHub.showError('Please provide a source');
      (type === 'url' ? urlInput : pathInput).focus();
      return;
    }
    
    // Validate Git URL format if URL import
    if (type === 'url') {
      const gitUrlPattern = /^(https?:\/\/|git@)[\w\-\.]+[\/:].*$/;
      if (!gitUrlPattern.test(source)) {
        projectsHub.showError('Please enter a valid Git repository URL (https:// or git@)');
        urlInput.focus();
        return;
      }
    }
    
    document.getElementById('importProjectForm').style.display = 'none';
    document.getElementById('importProgress').style.display = 'block';
    
    try {
      const response = await fetch('/api/projects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, type })
      });
      
      const data = await response.json();
      
      if (data.success) {
        projectsHub.showSuccess(`Project imported! Optimization: ${data.project.optimization_level}%`);
        closeModal();
        window.location.href = `/projects.html`;
      } else {
        throw new Error(data.error || 'Import failed');
      }
    } catch (e) {
      projectsHub.showError(e.message);
      document.getElementById('importProjectForm').style.display = 'block';
      document.getElementById('importProgress').style.display = 'none';
    }
  });
}

function closeModal() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  projectsHub = new ProjectsHub();
});