// Context Switcher - Project isolation and scoping
class ContextSwitcher {
  constructor() {
    this.activeProject = null;
    this.init();
  }

  async init() {
    await this.loadActiveProject();
    await this.populateProjectSelector();
    this.setupEventListeners();
  }

  async loadActiveProject() {
    const storedId = localStorage.getItem('active_project_id');
    if (storedId) {
      try {
        const response = await fetch(`/api/projects/${storedId}`);
        const data = await response.json();
        if (data.project) {
          this.activeProject = data.project;
        }
      } catch (e) {
        console.error('[context] Load active project failed:', e);
      }
    }
  }

  async populateProjectSelector() {
    const selector = document.getElementById('activeProject');
    if (!selector) return;

    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      const projects = data.projects || [];

      selector.innerHTML = '<option value="">No project</option>';
      
      projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        if (this.activeProject && project.id === this.activeProject.id) {
          option.selected = true;
        }
        selector.appendChild(option);
      });
    } catch (e) {
      console.error('[context] Populate selector failed:', e);
    }
  }

  setupEventListeners() {
    const selector = document.getElementById('activeProject');
    if (selector) {
      selector.addEventListener('change', (e) => this.switchProject(e.target.value));
    }
  }

  async switchProject(projectId) {
    if (!projectId) {
      // Clear active project
      this.activeProject = null;
      localStorage.removeItem('active_project_id');
      localStorage.removeItem('active_project');
      this.showToast('Switched to no project', 'info');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      
      if (data.project) {
        this.activeProject = data.project;
        localStorage.setItem('active_project_id', projectId);
        localStorage.setItem('active_project', JSON.stringify(data.project));
        
        this.showToast(`Switched to ${data.project.name}`, 'success');
        
        // Reload tools scoped to new project
        this.reloadScopedTools();
      }
    } catch (e) {
      console.error('[context] Switch project failed:', e);
      this.showToast('Failed to switch project', 'error');
    }
  }

  reloadScopedTools() {
    // Reload agents list if available
    if (window.loadAgents) window.loadAgents();
    
    // Filter analytics by project if available
    if (window.filterAnalyticsByProject) {
      window.filterAnalyticsByProject(this.activeProject?.id);
    }
    
    // Update terminal cwd if available
    if (window.setTerminalCwd && this.activeProject) {
      window.setTerminalCwd(this.activeProject.path);
    }
  }

  getActiveProject() {
    return this.activeProject;
  }

  showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => toast.remove(), 2500);
  }
}

// Initialize
let contextSwitcher;
document.addEventListener('DOMContentLoaded', () => {
  contextSwitcher = new ContextSwitcher();
  
  // Expose globally
  window.contextSwitcher = contextSwitcher;
});