// Quick Action Bar (Cmd+K) + Universal Search (Cmd+Shift+K) + Navigation
// Auto-integrated into dashboard

(function() {
  'use strict';
  
  // ===========================================
  // QUICK ACTION BAR (Cmd+K)
  // ===========================================
  
  let quickBarOpen = false;
  let searchOpen = false;
  let recentItems = JSON.parse(localStorage.getItem('dashboard:recent') || '[]');
  let favorites = JSON.parse(localStorage.getItem('dashboard:favorites') || '[]');
  
  const quickActions = [
    { id: 'create-agent', label: '⚡ Create agent', icon: '🤖', action: () => { window.location.href = '/agents.html'; setTimeout(() => document.getElementById('addBtn')?.click(), 100); } },
    { id: 'open-terminal', label: '⌨️ Open terminal', icon: '💻', action: () => { document.getElementById('termInput')?.focus(); } },
    { id: 'new-prompt', label: '✏️ New prompt', icon: '📝', action: () => { window.location.href = '/prompts.html'; } },
    { id: 'view-runs', label: '🏃 Run history', icon: '📊', action: () => { window.location.href = '/runs.html'; } },
    { id: 'agents-page', label: '🤖 Agents page', icon: '👥', action: () => { window.location.href = '/agents.html'; } },
    { id: 'dashboard', label: '🏠 Dashboard', icon: '📈', action: () => { window.location.href = '/'; } },
  ];
  
  function addRecent(item) {
    recentItems = recentItems.filter(i => i.id !== item.id);
    recentItems.unshift(item);
    recentItems = recentItems.slice(0, 10);
    localStorage.setItem('dashboard:recent', JSON.stringify(recentItems));
  }
  
  function toggleFavorite(id) {
    if (favorites.includes(id)) {
      favorites = favorites.filter(f => f !== id);
    } else {
      favorites.push(id);
    }
    localStorage.setItem('dashboard:favorites', JSON.stringify(favorites));
    renderQuickBar();
  }
  
  function createQuickBarModal() {
    const modal = document.createElement('div');
    modal.id = 'quickbar-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:none;align-items:flex-start;justify-content:center;padding-top:120px;';
    
    const content = document.createElement('div');
    content.style.cssText = 'background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;width:560px;max-width:90vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);';
    
    content.innerHTML = `
      <input id="quickbar-input" placeholder="Search or type command..." style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--fg);font-size:16px;margin-bottom:12px;" />
      <div id="quickbar-sections"></div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    return { modal, input: content.querySelector('#quickbar-input'), sections: content.querySelector('#quickbar-sections') };
  }
  
  function renderQuickBar() {
    const els = window.quickBarEls || createQuickBarModal();
    window.quickBarEls = els;
    
    const sections = els.sections;
    sections.innerHTML = '';
    
    // Recent items
    if (recentItems.length > 0) {
      const recentDiv = document.createElement('div');
      recentDiv.innerHTML = '<div class="small" style="margin:8px 0;opacity:0.7">📌 Recent</div>';
      recentItems.slice(0, 5).forEach(item => {
        const row = document.createElement('div');
        row.className = 'quickbar-item';
        row.style.cssText = 'padding:8px 10px;cursor:pointer;border-radius:6px;display:flex;justify-content:space-between;align-items:center;';
        row.innerHTML = `<span>${item.label}</span><span class="small">${item.type}</span>`;
        row.onmouseover = () => row.style.background = 'var(--bg)';
        row.onmouseout = () => row.style.background = '';
        row.onclick = () => { if (item.action) item.action(); closeQuickBar(); };
        recentDiv.appendChild(row);
      });
      sections.appendChild(recentDiv);
    }
    
    // Favorites
    const favActions = quickActions.filter(a => favorites.includes(a.id));
    if (favActions.length > 0 || favorites.length === 0) {
      const favDiv = document.createElement('div');
      favDiv.innerHTML = '<div class="small" style="margin:12px 0 8px;opacity:0.7">⭐ Favorites</div>';
      const displayActions = favActions.length > 0 ? favActions : quickActions.slice(0, 3);
      displayActions.forEach(act => {
        const row = document.createElement('div');
        row.className = 'quickbar-item';
        row.style.cssText = 'padding:8px 10px;cursor:pointer;border-radius:6px;display:flex;justify-content:space-between;align-items:center;';
        row.innerHTML = `<span>${act.label}</span><span class="small" style="cursor:pointer;" data-fav="${act.id}">${favorites.includes(act.id) ? '★' : '☆'}</span>`;
        row.onmouseover = () => row.style.background = 'var(--bg)';
        row.onmouseout = () => row.style.background = '';
        row.onclick = (e) => {
          if (e.target.dataset.fav) {
            toggleFavorite(act.id);
            return;
          }
          act.action();
          addRecent({ id: act.id, label: act.label, type: 'action', action: act.action });
          closeQuickBar();
        };
        favDiv.appendChild(row);
      });
      sections.appendChild(favDiv);
    }
    
    // Quick Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.innerHTML = '<div class="small" style="margin:12px 0 8px;opacity:0.7">🚀 Quick Actions</div>';
    quickActions.forEach(act => {
      const row = document.createElement('div');
      row.className = 'quickbar-item';
      row.style.cssText = 'padding:8px 10px;cursor:pointer;border-radius:6px;';
      row.innerHTML = `<span>${act.label}</span>`;
      row.onmouseover = () => row.style.background = 'var(--bg)';
      row.onmouseout = () => row.style.background = '';
      row.onclick = () => { act.action(); addRecent({ id: act.id, label: act.label, type: 'action', action: act.action }); closeQuickBar(); };
      actionsDiv.appendChild(row);
    });
    sections.appendChild(actionsDiv);
  }
  
  function openQuickBar() {
    quickBarOpen = true;
    const els = window.quickBarEls || createQuickBarModal();
    window.quickBarEls = els;
    renderQuickBar();
    els.modal.style.display = 'flex';
    els.input.focus();
    els.input.value = '';
  }
  
  function closeQuickBar() {
    quickBarOpen = false;
    if (window.quickBarEls) window.quickBarEls.modal.style.display = 'none';
  }
  
  // ===========================================
  // UNIVERSAL SEARCH (Cmd+Shift+K)
  // ===========================================
  
  function createSearchModal() {
    const modal = document.createElement('div');
    modal.id = 'search-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:none;align-items:flex-start;justify-content:center;padding-top:100px;';
    
    const content = document.createElement('div');
    content.style.cssText = 'background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;width:600px;max-width:90vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);max-height:70vh;overflow:auto;';
    
    content.innerHTML = `
      <input id="search-input" placeholder="🔍 Search agents, skills, prompts, runs..." style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--fg);font-size:16px;margin-bottom:12px;" />
      <div id="search-results"></div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    return { modal, input: content.querySelector('#search-input'), results: content.querySelector('#search-results') };
  }
  
  function fuzzyMatch(query, text) {
    query = query.toLowerCase();
    text = text.toLowerCase();
    let qi = 0;
    for (let i = 0; i < text.length && qi < query.length; i++) {
      if (text[i] === query[qi]) qi++;
    }
    return qi === query.length;
  }
  
  function performSearch(query) {
    if (!query || query.length < 2) return { agents: [], skills: [], prompts: [], runs: [], settings: [] };
    
    // Gather all searchable items (stub - would fetch from state in real impl)
    const agents = (window.S?.agents || []).filter(a => fuzzyMatch(query, a.name + ' ' + (a.role || '')));
    const skills = (window.S?.skills || []).filter(s => fuzzyMatch(query, s.name + ' ' + (s.description || '')));
    const prompts = []; // Would fetch from prompts page state
    const runs = []; // Would fetch from runs
    const settings = [];
    
    if (fuzzyMatch(query, 'theme') || fuzzyMatch(query, 'settings')) settings.push({ label: 'Theme & Settings', action: () => { /* open settings */ } });
    if (fuzzyMatch(query, 'shortcuts') || fuzzyMatch(query, 'help')) settings.push({ label: 'Keyboard Shortcuts', action: () => showShortcuts() });
    
    return { agents, skills, prompts, runs, settings };
  }
  
  function renderSearchResults(query) {
    const els = window.searchEls || createSearchModal();
    window.searchEls = els;
    
    const results = performSearch(query);
    const resultsDiv = els.results;
    resultsDiv.innerHTML = '';
    
    const sections = [
      { title: '🤖 Agents', items: results.agents.slice(0, 5), render: a => `${a.name} <span class="small">(${a.role})</span>`, action: a => window.location.href = `/agents.html?search=${a.name}` },
      { title: '🎯 Skills', items: results.skills.slice(0, 5), render: s => `${s.name} <span class="small">(${(s.description || '').slice(0, 40)})</span>`, action: s => window.location.href = `/agents.html?skill=${s.name}` },
      { title: '📝 Prompts', items: results.prompts.slice(0, 3), render: p => p.title, action: p => window.location.href = `/prompts.html?id=${p.id}` },
      { title: '🏃 Runs', items: results.runs.slice(0, 3), render: r => r.runId, action: r => window.location.href = `/runs.html?run=${r.runId}` },
      { title: '⚙️ Settings', items: results.settings, render: s => s.label, action: s => s.action() },
    ];
    
    sections.forEach(sec => {
      if (sec.items.length === 0) return;
      const secDiv = document.createElement('div');
      secDiv.innerHTML = `<div class="small" style="margin:12px 0 6px;opacity:0.7">${sec.title} (${sec.items.length})</div>`;
      sec.items.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = 'padding:8px 10px;cursor:pointer;border-radius:6px;';
        row.innerHTML = sec.render(item);
        row.onmouseover = () => row.style.background = 'var(--bg)';
        row.onmouseout = () => row.style.background = '';
        row.onclick = () => { sec.action(item); closeSearch(); };
        secDiv.appendChild(row);
      });
      resultsDiv.appendChild(secDiv);
    });
    
    if (Object.values(results).flat().length === 0) {
      resultsDiv.innerHTML = '<div class="small" style="text-align:center;padding:20px;opacity:0.6">No results found</div>';
    }
  }
  
  function openSearch() {
    searchOpen = true;
    const els = window.searchEls || createSearchModal();
    window.searchEls = els;
    els.modal.style.display = 'flex';
    els.input.focus();
    els.input.value = '';
    els.input.oninput = (e) => renderSearchResults(e.target.value);
  }
  
  function closeSearch() {
    searchOpen = false;
    if (window.searchEls) window.searchEls.modal.style.display = 'none';
  }
  
  // ===========================================
  // SHORTCUTS MODAL (Ctrl+?)
  // ===========================================
  
  function showShortcuts() {
    const shortcuts = [
      { key: 'Cmd+K / Ctrl+K', desc: 'Quick actions palette' },
      { key: 'Cmd+Shift+K / Ctrl+Shift+K', desc: 'Global search' },
      { key: 'Cmd+J / Ctrl+J', desc: 'Jump to item' },
      { key: 'Ctrl+Z / Ctrl+Y', desc: 'Undo / Redo' },
      { key: 'Ctrl+?', desc: 'Show shortcuts' },
      { key: 'Esc', desc: 'Close modal' },
    ];
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
    
    const content = document.createElement('div');
    content.style.cssText = 'background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:20px;width:400px;max-width:90vw;';
    
    let html = '<div style="font-weight:600;margin-bottom:12px;">⌨️ Keyboard Shortcuts</div>';
    shortcuts.forEach(s => {
      html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);"><span class="small">${s.desc}</span><code style="background:var(--bg);padding:2px 6px;border-radius:4px;font-size:12px;">${s.key}</code></div>`;
    });
    html += '<button class="pill" style="margin-top:12px;width:100%;" onclick="this.closest(\\'div[style*=fixed]\\').remove()">Close</button>';
    content.innerHTML = html;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  }
  
  // ===========================================
  // KEYBOARD EVENT LISTENERS
  // ===========================================
  
  document.addEventListener('keydown', (e) => {
    // Cmd+K or Ctrl+K → Quick bar
    if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !e.shiftKey) {
      e.preventDefault();
      if (quickBarOpen) closeQuickBar(); else openQuickBar();
    }
    
    // Cmd+Shift+K or Ctrl+Shift+K → Universal search
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      if (searchOpen) closeSearch(); else openSearch();
    }
    
    // Ctrl+? → Shortcuts
    if (e.ctrlKey && e.key === '?') {
      e.preventDefault();
      showShortcuts();
    }
    
    // Escape → Close any open modal
    if (e.key === 'Escape') {
      if (quickBarOpen) closeQuickBar();
      if (searchOpen) closeSearch();
    }
  });
  
  // Export to window for external access
  window.openQuickBar = openQuickBar;
  window.openSearch = openSearch;
  window.showShortcuts = showShortcuts;
  
  console.log('✅ Quick Action Bar + Universal Search loaded (Cmd+K, Cmd+Shift+K, Ctrl+?)');
})();
