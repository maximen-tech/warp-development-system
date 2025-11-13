// Marketplace - Search, install, ratings, dependency resolution
class Marketplace {
  constructor() {
    this.items = [];
    this.installed = [];
    this.filteredItems = [];
    this.installQueue = [];
    this.selectedItem = null;
    this.showingInstalled = false;
    this.init();
  }

  async init() {
    await this.loadItems();
    await this.loadInstalled();
    this.setupEventListeners();
    this.renderItems();
    this.updateStats();
  }

  async loadItems() {
    try {
      const response = await fetch('/api/marketplace/items');
      const data = await response.json();
      this.items = data.items || [];
      this.filteredItems = [...this.items];
      this.buildTagFilters();
    } catch (e) {
      console.error('[marketplace] Failed to load items:', e);
      this.showError('Failed to load marketplace items');
    }
  }

  async loadInstalled() {
    try {
      const response = await fetch('/api/marketplace/installed');
      const data = await response.json();
      this.installed = data.items?.map(item => item.id) || [];
    } catch (e) {
      console.error('[marketplace] Failed to load installed:', e);
    }
  }

  setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const sortBy = document.getElementById('sortBy');

    searchInput.addEventListener('input', (e) => {
      this.applyFilters();
    });

    typeFilter.addEventListener('change', () => {
      this.applyFilters();
    });

    sortBy.addEventListener('change', () => {
      this.applyFilters();
    });

    // Close modal on outside click
    document.getElementById('previewModal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.closePreview();
      }
    });
  }

  buildTagFilters() {
    const allTags = [...new Set(this.items.flatMap(item => item.tags))];
    const tagFilters = document.getElementById('tagFilters');
    
    tagFilters.innerHTML = allTags.map(tag => 
      `<button class="pill tag-filter" data-tag="${tag}" onclick="marketplace.toggleTagFilter('${tag}')">#${tag}</button>`
    ).join('');
  }

  toggleTagFilter(tag) {
    const button = document.querySelector(`[data-tag="${tag}"]`);
    button.classList.toggle('active');
    this.applyFilters();
  }

  applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const type = document.getElementById('typeFilter').value;
    const sort = document.getElementById('sortBy').value;
    const activeTags = [...document.querySelectorAll('.tag-filter.active')].map(btn => btn.dataset.tag);

    let filtered = [...this.items];

    // Search filter
    if (search) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search) ||
        item.tags.some(tag => tag.toLowerCase().includes(search)) ||
        item.author.toLowerCase().includes(search)
      );
    }

    // Type filter
    if (type) {
      filtered = filtered.filter(item => item.type === type);
    }

    // Tag filter
    if (activeTags.length > 0) {
      filtered = filtered.filter(item => 
        activeTags.some(tag => item.tags.includes(tag))
      );
    }

    // Show only installed items filter
    if (this.showingInstalled) {
      filtered = filtered.filter(item => this.installed.includes(item.id));
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sort) {
        case 'rating': return b.rating - a.rating;
        case 'name': return a.name.localeCompare(b.name);
        case 'newest': return b.version.localeCompare(a.version);
        default: return b.downloads - a.downloads;
      }
    });

    this.filteredItems = filtered;
    this.renderItems();
    this.updateStats();
  }

  renderItems() {
    const grid = document.getElementById('itemsGrid');
    
    if (this.filteredItems.length === 0) {
      grid.innerHTML = '<div class="empty-state">No items found matching your criteria</div>';
      return;
    }

    grid.innerHTML = this.filteredItems.map(item => this.renderItem(item)).join('');
  }

  renderItem(item) {
    const isInstalled = this.installed.includes(item.id);
    const inQueue = this.installQueue.includes(item.id);
    const typeIcons = { skill: '🛠️', agent: '🤖', workflow: '⚡' };
    
    const stars = this.renderStars(item.rating);
    const tags = item.tags.map(tag => `<span class="item-tag">#${tag}</span>`).join('');
    
    let actionButton = '';
    if (isInstalled) {
      actionButton = '<button class="pill installed-badge">✅ Installed</button>';
    } else if (inQueue) {
      actionButton = '<button class="pill queued-badge">⏳ Queued</button>';
    } else {
      actionButton = `<button class="pill install-btn" onclick="marketplace.install('${item.id}')">Install</button>`;
    }

    return `
      <div class="marketplace-item" data-id="${item.id}">
        <div class="item-header">
          <div class="item-icon">${typeIcons[item.type] || '📦'}</div>
          <div class="item-title">
            <h3>${item.name}</h3>
            <div class="item-meta">
              <span class="item-type">${item.type}</span>
              <span class="item-version">v${item.version}</span>
            </div>
          </div>
          ${actionButton}
        </div>
        
        <div class="item-description">${item.description}</div>
        
        <div class="item-stats">
          <div class="stat">
            <span class="stat-value">${item.downloads.toLocaleString()}</span>
            <span class="stat-label">downloads</span>
          </div>
          <div class="stat">
            <span class="stat-value">${item.rating}</span>
            <span class="stat-label">rating</span>
          </div>
        </div>
        
        <div class="item-rating">${stars}</div>
        
        <div class="item-tags">${tags}</div>
        
        <div class="item-footer">
          <span class="item-author">by ${item.author}</span>
          <button class="pill secondary preview-btn" onclick="marketplace.showPreview('${item.id}')">Preview</button>
        </div>
      </div>
    `;
  }

  renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    
    return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(empty);
  }

  async install(id) {
    try {
      const item = this.items.find(i => i.id === id);
      if (!item) return;

      // Check dependencies
      const missingDeps = item.dependencies?.filter(dep => !this.installed.includes(dep)) || [];
      
      if (missingDeps.length > 0) {
        const depNames = missingDeps.map(depId => {
          const dep = this.items.find(i => i.id === depId);
          return dep ? dep.name : depId;
        }).join(', ');
        
        if (confirm(`This item requires: ${depNames}. Install dependencies first?`)) {
          // Add dependencies to queue first
          for (const depId of missingDeps) {
            if (!this.installQueue.includes(depId)) {
              this.installQueue.push(depId);
            }
          }
        } else {
          return;
        }
      }

      // Add to queue
      if (!this.installQueue.includes(id)) {
        this.installQueue.push(id);
      }

      this.updateCartCount();
      this.processInstallQueue();
      
    } catch (e) {
      console.error('[marketplace] Install failed:', e);
      this.showError('Installation failed');
    }
  }

  async processInstallQueue() {
    if (this.installQueue.length === 0) return;

    const id = this.installQueue[0];
    try {
      const response = await fetch('/api/marketplace/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (response.ok) {
        const result = await response.json();
        this.installed.push(id);
        this.installQueue.shift();
        this.showSuccess(`${result.item.name} installed successfully!`);
        
        // Continue processing queue
        if (this.installQueue.length > 0) {
          setTimeout(() => this.processInstallQueue(), 1000);
        }
      } else {
        const error = await response.json();
        this.showError(`Install failed: ${error.error}`);
        this.installQueue = this.installQueue.filter(qid => qid !== id);
      }
    } catch (e) {
      console.error('[marketplace] Install request failed:', e);
      this.installQueue = this.installQueue.filter(qid => qid !== id);
      this.showError('Installation failed');
    }

    this.updateCartCount();
    this.renderItems();
  }

  showPreview(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    this.selectedItem = item;
    
    // Update modal content
    document.getElementById('modalName').textContent = item.name;
    document.getElementById('modalType').textContent = item.type;
    document.getElementById('modalVersion').textContent = `v${item.version}`;
    document.getElementById('modalAuthor').textContent = `by ${item.author}`;
    document.getElementById('modalDescription').textContent = item.description;
    document.getElementById('modalDownloads').textContent = item.downloads.toLocaleString();
    document.getElementById('modalRatingValue').textContent = item.rating;
    
    const typeIcons = { skill: '🛠️', agent: '🤖', workflow: '⚡' };
    document.getElementById('modalIcon').textContent = typeIcons[item.type] || '📦';
    
    const rating = document.getElementById('modalRating');
    rating.innerHTML = this.renderStars(item.rating);
    
    const tags = document.getElementById('modalTags');
    tags.innerHTML = item.tags.map(tag => `<span class="modal-tag">#${tag}</span>`).join('');
    
    // Dependencies
    const depsContainer = document.getElementById('modalDependencies');
    if (item.dependencies && item.dependencies.length > 0) {
      const depsList = item.dependencies.map(depId => {
        const dep = this.items.find(i => i.id === depId);
        const installed = this.installed.includes(depId);
        return `<span class="dependency ${installed ? 'installed' : 'missing'}">${dep ? dep.name : depId}</span>`;
      }).join('');
      
      depsContainer.innerHTML = `<h4>Dependencies</h4><div class="dependencies-list">${depsList}</div>`;
      depsContainer.style.display = 'block';
    } else {
      depsContainer.style.display = 'none';
    }
    
    // Install button
    const installBtn = document.getElementById('modalInstallBtn');
    const isInstalled = this.installed.includes(item.id);
    const inQueue = this.installQueue.includes(item.id);
    
    if (isInstalled) {
      installBtn.textContent = '✅ Installed';
      installBtn.disabled = true;
      installBtn.className = 'pill installed-badge';
    } else if (inQueue) {
      installBtn.textContent = '⏳ Queued';
      installBtn.disabled = true;
      installBtn.className = 'pill queued-badge';
    } else {
      installBtn.textContent = 'Install';
      installBtn.disabled = false;
      installBtn.className = 'pill primary install-button';
    }
    
    document.getElementById('previewModal').style.display = 'flex';
  }

  closePreview() {
    document.getElementById('previewModal').style.display = 'none';
    this.selectedItem = null;
  }

  installFromModal() {
    if (this.selectedItem) {
      this.install(this.selectedItem.id);
      this.closePreview();
    }
  }

  async rateItem() {
    if (!this.selectedItem) return;
    
    const rating = prompt('Rate this item (1-5 stars):', '5');
    if (!rating || isNaN(rating) || rating < 1 || rating > 5) return;
    
    try {
      const response = await fetch('/api/marketplace/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.selectedItem.id, rating: parseInt(rating) })
      });
      
      if (response.ok) {
        this.showSuccess('Rating submitted successfully!');
      }
    } catch (e) {
      console.error('[marketplace] Rating failed:', e);
      this.showError('Failed to submit rating');
    }
  }

  toggleInstalled() {
    this.showingInstalled = !this.showingInstalled;
    const button = document.querySelector('button[onclick="toggleInstalled()"]');
    button.textContent = this.showingInstalled ? '📦 Show All' : '📦 Installed';
    button.classList.toggle('active', this.showingInstalled);
    this.applyFilters();
  }

  clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('typeFilter').value = '';
    document.querySelectorAll('.tag-filter.active').forEach(btn => btn.classList.remove('active'));
    this.applyFilters();
  }

  updateStats() {
    document.getElementById('resultsCount').textContent = `${this.filteredItems.length} items`;
    document.getElementById('installedCount').textContent = `${this.installed.length} installed`;
  }

  updateCartCount() {
    document.getElementById('cart-count').textContent = `Cart (${this.installQueue.length})`;
  }

  showSuccess(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Global functions for onclick handlers
let marketplace;

function toggleInstalled() {
  marketplace.toggleInstalled();
}

function clearSearch() {
  marketplace.clearSearch();
}

function closePreview() {
  marketplace.closePreview();
}

function installFromModal() {
  marketplace.installFromModal();
}

function rateItem() {
  marketplace.rateItem();
}

// Initialize marketplace when page loads
document.addEventListener('DOMContentLoaded', () => {
  marketplace = new Marketplace();
});