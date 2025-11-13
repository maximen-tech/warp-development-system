/**
 * PROMPT FACTORY PANEL - AI-powered prompt synthesis
 * Captures terminal output + user idea + skills → generates optimal AI prompts
 */

(function() {
  'use strict';

  const PromptFactory = {
    terminalOutput: '',
    skills: [],
    projectContext: null,
    history: JSON.parse(localStorage.getItem('prompt_factory_history') || '[]')
  };

  window.initPromptFactory = function() {
    const panelHTML = `
      <div id="promptFactoryPanel" class="prompt-factory-panel" style="display:none">
        <div class="factory-header">
          <h3>🧠 AI Prompt Factory</h3>
          <div class="factory-status">
            <span id="factoryMode" class="factory-mode">Template Mode</span>
            <button class="factory-btn" onclick="toggleFactoryPanel()">_</button>
            <button class="factory-btn" onclick="closeFactoryPanel()">✕</button>
          </div>
        </div>
        
        <div class="factory-content">
          <div class="factory-column factory-output">
            <div class="factory-section-header">
              <span>📋 Terminal Output</span>
              <span id="outputBadge" class="output-badge" style="display:none">✓ Captured</span>
            </div>
            <pre id="outputPreview" class="output-preview">No terminal output captured yet...</pre>
            <button class="factory-btn-small" id="expandOutput" style="display:none">Expand Full Output</button>
          </div>
          
          <div class="factory-column factory-idea">
            <div class="factory-section-header">
              <span>💡 Your Idea</span>
              <span id="ideaCount" class="char-count">0 chars</span>
            </div>
            <textarea 
              id="userIdea" 
              class="idea-input" 
              placeholder="Describe what you want to accomplish...

Examples:
• Fix the error shown in terminal
• Optimize this function for performance
• Add error handling to this code
• Refactor to use async/await
• Add unit tests for this feature"
              maxlength="2000"
            ></textarea>
            <div class="idea-hints">
              💡 <strong>Pro tip:</strong> Be specific! Mention files, functions, or exact changes needed.
            </div>
          </div>
          
          <div class="factory-column factory-skills">
            <div class="factory-section-header">
              <span>⚡ Skills</span>
              <button class="factory-btn-small" id="refreshSkills">🔄 Reload</button>
            </div>
            <select id="skillsSelector" multiple class="skills-selector" size="6">
              <option disabled>Loading skills...</option>
            </select>
            <div class="factory-actions">
              <button id="generateBtn" class="button primary factory-generate" disabled>
                🚀 Generate Prompt
              </button>
              <button id="historyBtn" class="button secondary factory-history">
                📜 History
              </button>
            </div>
          </div>
        </div>
        
        <div id="factoryResult" class="factory-result" style="display:none">
          <div class="result-header">
            <span>✨ Generated Prompt</span>
            <div class="result-meta">
              <span id="resultMode" class="result-badge">AI</span>
              <span id="resultTokens" class="result-badge">~0 tokens</span>
              <span id="resultConfidence" class="result-badge">95% confidence</span>
            </div>
          </div>
          <pre id="generatedPrompt" class="generated-prompt"></pre>
          <div class="result-actions">
            <button id="copyPromptBtn" class="button primary">📋 Copy Prompt</button>
            <button id="savePromptBtn" class="button secondary">💾 Save to History</button>
            <button id="newPromptBtn" class="button secondary">🔄 New Prompt</button>
          </div>
        </div>
        
        <div id="factoryLoading" class="factory-loading" style="display:none">
          <div class="spinner"></div>
          <p>🧠 Synthesizing optimal prompt...</p>
        </div>
      </div>
      
      <!-- History Modal -->
      <div class="factory-modal" id="factoryHistoryModal" style="display:none">
        <div class="factory-modal-content">
          <div class="factory-modal-header">
            <h2>📜 Prompt History</h2>
            <button class="factory-btn" onclick="closeHistoryModal()">✕</button>
          </div>
          <div class="factory-modal-body" id="historyList">
            <div class="history-empty">No prompts generated yet</div>
          </div>
        </div>
      </div>
      
      <!-- Full Output Modal -->
      <div class="factory-modal" id="fullOutputModal" style="display:none">
        <div class="factory-modal-content">
          <div class="factory-modal-header">
            <h2>📋 Full Terminal Output</h2>
            <button class="factory-btn" onclick="closeFullOutputModal()">✕</button>
          </div>
          <div class="factory-modal-body">
            <pre id="fullOutputContent" class="full-output"></pre>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', panelHTML);

    // Event listeners
    document.getElementById('userIdea').addEventListener('input', handleIdeaInput);
    document.getElementById('generateBtn').addEventListener('click', generatePrompt);
    document.getElementById('copyPromptBtn').addEventListener('click', copyPrompt);
    document.getElementById('savePromptBtn').addEventListener('click', saveToHistory);
    document.getElementById('newPromptBtn').addEventListener('click', resetFactory);
    document.getElementById('historyBtn').addEventListener('click', showHistory);
    document.getElementById('refreshSkills').addEventListener('click', loadSkills);
    document.getElementById('expandOutput').addEventListener('click', showFullOutput);

    // Load initial data
    loadProjectContext();
    loadSkills();
    checkSynthesizerMode();

    // Listen for terminal completion events
    window.addEventListener('terminal-command-completed', handleTerminalOutput);
    
    // Keyboard shortcut: Ctrl+P to focus factory
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        showFactoryPanel();
        document.getElementById('userIdea').focus();
      }
    });
  };

  window.showFactoryPanel = function() {
    document.getElementById('promptFactoryPanel').style.display = 'flex';
  };

  window.closeFactoryPanel = function() {
    document.getElementById('promptFactoryPanel').style.display = 'none';
  };

  window.toggleFactoryPanel = function() {
    const panel = document.getElementById('promptFactoryPanel');
    panel.classList.toggle('minimized');
  };

  function handleIdeaInput(e) {
    const text = e.target.value;
    const count = text.length;
    
    document.getElementById('ideaCount').textContent = `${count} / 2000 chars`;
    document.getElementById('generateBtn').disabled = count < 10;
  }

  async function loadProjectContext() {
    try {
      const activeProjectId = localStorage.getItem('active_project_id');
      if (activeProjectId) {
        const response = await fetch(`/api/projects/${activeProjectId}`);
        const data = await response.json();
        PromptFactory.projectContext = data.project;
      } else {
        PromptFactory.projectContext = { name: 'Warp Development System', stack: ['Node.js', 'JavaScript'], path: process.cwd() };
      }
    } catch (error) {
      console.error('[factory] Load project context failed:', error);
    }
  }

  async function loadSkills() {
    const selector = document.getElementById('skillsSelector');
    selector.innerHTML = '<option disabled>Loading skills...</option>';

    try {
      // Load from .warp/skills.yml via agents API
      const response = await fetch('/api/agents/list');
      const data = await response.json();
      
      PromptFactory.skills = data.skills || [];

      if (PromptFactory.skills.length === 0) {
        selector.innerHTML = '<option disabled>No skills configured in .warp/skills.yml</option>';
        return;
      }

      selector.innerHTML = PromptFactory.skills
        .map(skill => `<option value="${skill.id || skill.name}">${skill.name || skill.id}</option>`)
        .join('');
    } catch (error) {
      console.error('[factory] Load skills failed:', error);
      selector.innerHTML = '<option disabled>Error loading skills</option>';
    }
  }

  async function checkSynthesizerMode() {
    try {
      const response = await fetch('/api/prompts/status');
      const data = await response.json();
      
      const modeText = data.mode === 'ai' ? '🤖 AI Mode (Claude)' : '📝 Template Mode';
      document.getElementById('factoryMode').textContent = modeText;
      document.getElementById('factoryMode').className = `factory-mode ${data.mode}`;
    } catch (error) {
      console.error('[factory] Check mode failed:', error);
    }
  }

  function handleTerminalOutput(event) {
    const { output, command, exitCode } = event.detail || {};
    
    if (!output) return;

    PromptFactory.terminalOutput = output;
    
    // Update preview (first 500 chars)
    const preview = output.substring(0, 500);
    document.getElementById('outputPreview').textContent = preview + (output.length > 500 ? '\n... [truncated]' : '');
    
    // Show badges
    document.getElementById('outputBadge').style.display = 'inline';
    document.getElementById('expandOutput').style.display = output.length > 500 ? 'inline-block' : 'none';
    
    // Auto-open factory panel
    showFactoryPanel();
    
    // Focus idea input
    setTimeout(() => document.getElementById('userIdea').focus(), 300);
  }

  async function generatePrompt() {
    const userIdea = document.getElementById('userIdea').value.trim();
    
    if (!userIdea) {
      alert('Please enter your idea first!');
      return;
    }

    // Get selected skills
    const selector = document.getElementById('skillsSelector');
    const selectedSkills = Array.from(selector.selectedOptions).map(opt => opt.value);

    // Show loading
    document.getElementById('factoryResult').style.display = 'none';
    document.getElementById('factoryLoading').style.display = 'flex';

    try {
      const response = await fetch('/api/prompts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminalOutput: PromptFactory.terminalOutput || 'No terminal output captured',
          userIdea,
          selectedSkills,
          projectContext: PromptFactory.projectContext || {}
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Synthesis failed');
      }

      // Display result
      document.getElementById('generatedPrompt').textContent = data.prompt;
      document.getElementById('resultMode').textContent = data.mode === 'ai' ? '🤖 AI Generated' : '📝 Template';
      document.getElementById('resultTokens').textContent = `~${data.tokens} tokens`;
      document.getElementById('resultConfidence').textContent = `${data.confidence}% confidence`;

      document.getElementById('factoryLoading').style.display = 'none';
      document.getElementById('factoryResult').style.display = 'block';

      // Auto-save to temp history
      PromptFactory.lastGenerated = {
        prompt: data.prompt,
        userIdea,
        timestamp: new Date().toISOString(),
        mode: data.mode,
        tokens: data.tokens
      };

    } catch (error) {
      console.error('[factory] Generation failed:', error);
      document.getElementById('factoryLoading').style.display = 'none';
      alert(`Failed to generate prompt: ${error.message}`);
    }
  }

  function copyPrompt() {
    const prompt = document.getElementById('generatedPrompt').textContent;
    navigator.clipboard.writeText(prompt).then(() => {
      const btn = document.getElementById('copyPromptBtn');
      const originalText = btn.textContent;
      btn.textContent = '✅ Copied!';
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    });
  }

  function saveToHistory() {
    if (!PromptFactory.lastGenerated) return;

    PromptFactory.history.unshift(PromptFactory.lastGenerated);
    
    // Keep last 10
    if (PromptFactory.history.length > 10) {
      PromptFactory.history = PromptFactory.history.slice(0, 10);
    }

    localStorage.setItem('prompt_factory_history', JSON.stringify(PromptFactory.history));

    const btn = document.getElementById('savePromptBtn');
    const originalText = btn.textContent;
    btn.textContent = '✅ Saved!';
    setTimeout(() => { btn.textContent = originalText; }, 2000);
  }

  function resetFactory() {
    document.getElementById('userIdea').value = '';
    document.getElementById('ideaCount').textContent = '0 chars';
    document.getElementById('generateBtn').disabled = true;
    document.getElementById('factoryResult').style.display = 'none';
  }

  function showHistory() {
    const modal = document.getElementById('factoryHistoryModal');
    const list = document.getElementById('historyList');

    if (PromptFactory.history.length === 0) {
      list.innerHTML = '<div class="history-empty">No prompts generated yet. Create your first prompt!</div>';
    } else {
      list.innerHTML = PromptFactory.history.map((item, index) => `
        <div class="history-item">
          <div class="history-item-header">
            <strong>${item.userIdea.substring(0, 60)}...</strong>
            <span class="history-time">${new Date(item.timestamp).toLocaleString()}</span>
          </div>
          <div class="history-item-meta">
            <span class="result-badge">${item.mode}</span>
            <span class="result-badge">~${item.tokens} tokens</span>
          </div>
          <div class="history-item-actions">
            <button class="button small primary" onclick="reusePrompt(${index})">📋 Copy</button>
            <button class="button small secondary" onclick="viewPrompt(${index})">👁 View</button>
          </div>
        </div>
      `).join('');
    }

    modal.style.display = 'flex';
  }

  window.closeHistoryModal = function() {
    document.getElementById('factoryHistoryModal').style.display = 'none';
  };

  window.reusePrompt = function(index) {
    const item = PromptFactory.history[index];
    navigator.clipboard.writeText(item.prompt);
    alert('Prompt copied to clipboard!');
  };

  window.viewPrompt = function(index) {
    const item = PromptFactory.history[index];
    document.getElementById('generatedPrompt').textContent = item.prompt;
    document.getElementById('factoryResult').style.display = 'block';
    closeHistoryModal();
  };

  function showFullOutput() {
    document.getElementById('fullOutputContent').textContent = PromptFactory.terminalOutput;
    document.getElementById('fullOutputModal').style.display = 'flex';
  }

  window.closeFullOutputModal = function() {
    document.getElementById('fullOutputModal').style.display = 'none';
  };

  // Expose method for terminal to trigger
  window.captureTerminalOutput = function(output, command) {
    window.dispatchEvent(new CustomEvent('terminal-command-completed', {
      detail: { output, command, exitCode: 0 }
    }));
  };

})();