// Projects Hub - List, filter, sort, CRUD
class ProjectsHub {
  constructor() {
    this.projects = [];
    this.filteredProjects = [];
    this.init();
  }

  async init() {
    await this.loadProjects();
    this.setupEventListeners();
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
      console.error('[projects] Load failed:', e);
      this.showError('Failed to load projects');
    }
  }

  setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const stackFilter = document.getElementById('stackFilter');
    const statusFilter = document.getElementById('statusFilter');
    const sortBy = document.getElementById('sortBy');

    if (searchInput) {
      searchInput.addEventListener('input', () => this.applyFilters());
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

  async applyFilters() {
    await this.loadProjects();
    this.renderProjects();
    this.updateStats();
  }

  renderProjects() {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    if (this.filteredProjects.length === 0) {
      grid.innerHTML = '<div class="empty-projects">No projects found. Create or import one to get started!</div>';
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
          <button class="button primary small" onclick="projectsHub.openProject('${project.id}')">Open</button>
          <button class="button secondary small" onclick="projectsHub.showSettings('${project.id}')">⚙️ Settings</button>
          <button class="button secondary small" onclick="projectsHub.archiveProject('${project.id}')">📦 Archive</button>
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
      console.error('[projects] Open failed:', e);
      this.showError('Failed to open project');
    }
  }

  showSettings(id) {
    alert(`Settings for project ${id} (Phase 4 implementation)`);
  }

  async archiveProject(id) {
    if (!confirm('Archive this project? It will remain accessible but marked as inactive.')) return;
    
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' })
      });
      
      await this.loadProjects();
      this.renderProjects();
      this.updateStats();
      this.showSuccess('Project archived');
    } catch (e) {
      console.error('[projects] Archive failed:', e);
      this.showError('Failed to archive project');
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
    const name = document.getElementById('projectName').value;
    const template = document.getElementById('projectTemplate').value;
    
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
    const source = type === 'url' 
      ? document.getElementById('repoUrl').value 
      : document.getElementById('projectPath').value;
    
    if (!source) {
      projectsHub.showError('Please provide a source');
      return;
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