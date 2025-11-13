/**
 * TERMINAL PANEL - Warp-style embedded terminal
 * xterm.js + WebSocket for live command execution
 */

(function() {
  'use strict';

  // State
  const TerminalPanel = {
    term: null,
    socket: null,
    isOpen: false,
    history: JSON.parse(localStorage.getItem('terminal:history') || '[]'),
    favorites: JSON.parse(localStorage.getItem('terminal:favorites') || '[]'),
    currentCommand: '',
    sessionId: null,
  };

  // Initialize terminal panel
  window.initTerminalPanel = function() {
    const panelHTML = `
      <div id="terminalPanel" class="terminal-panel" style="display:none">
        <div class="terminal-header">
          <div class="terminal-tabs">
            <div class="terminal-tab active">
              <span>🖥 Terminal</span>
            </div>
          </div>
          <div class="terminal-actions">
            <button class="terminal-btn" id="termHistoryBtn" title="History">📜</button>
            <button class="terminal-btn" id="termFavoritesBtn" title="Favorites">⭐</button>
            <button class="terminal-btn" id="termClearBtn" title="Clear">🗑</button>
            <button class="terminal-btn" id="termRestartBtn" title="Restart">🔄</button>
            <button class="terminal-btn" id="termCloseBtn" title="Close">✕</button>
          </div>
        </div>
        <div id="terminalContainer"></div>
        
        <!-- History Modal -->
        <div class="terminal-modal" id="termHistoryModal" style="display:none">
          <div class="terminal-modal-content">
            <div class="terminal-modal-header">
              <h3>Command History</h3>
              <button class="terminal-btn" onclick="document.getElementById('termHistoryModal').style.display='none'">✕</button>
            </div>
            <div class="terminal-modal-body" id="termHistoryList"></div>
          </div>
        </div>
        
        <!-- Favorites Modal -->
        <div class="terminal-modal" id="termFavoritesModal" style="display:none">
          <div class="terminal-modal-content">
            <div class="terminal-modal-header">
              <h3>Favorite Commands</h3>
              <button class="terminal-btn" onclick="document.getElementById('termFavoritesModal').style.display='none'">✕</button>
            </div>
            <div class="terminal-modal-body" id="termFavoritesList"></div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', panelHTML);
    
    // Attach event handlers
    document.getElementById('termHistoryBtn').onclick = showHistory;
    document.getElementById('termFavoritesBtn').onclick = showFavorites;
    document.getElementById('termClearBtn').onclick = clearTerminal;
    document.getElementById('termRestartBtn').onclick = restartTerminal;
    document.getElementById('termCloseBtn').onclick = toggleTerminal;
    
    // Keyboard shortcut: Ctrl+` to toggle
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleTerminal();
      }
    });
  };

  // Toggle terminal panel visibility
  window.toggleTerminal = function() {
    const panel = document.getElementById('terminalPanel');
    if (!panel) return;
    
    if (TerminalPanel.isOpen) {
      panel.style.display = 'none';
      TerminalPanel.isOpen = false;
    } else {
      panel.style.display = 'flex';
      TerminalPanel.isOpen = true;
      
      // Initialize terminal if first time
      if (!TerminalPanel.term) {
        initXterm();
        connectWebSocket();
      } else {
        // Reconnect if disconnected
        if (!TerminalPanel.socket || TerminalPanel.socket.readyState !== WebSocket.OPEN) {
          connectWebSocket();
        }
      }
      
      // Fit terminal to container
      setTimeout(() => {
        if (TerminalPanel.term && TerminalPanel.term.fit) {
          TerminalPanel.term.fit();
        }
      }, 100);
    }
  };

  // Initialize xterm.js
  function initXterm() {
    // Check if xterm is loaded
    if (typeof Terminal === 'undefined') {
      console.error('xterm.js not loaded. Please include xterm.js and xterm.css in HTML.');
      return;
    }
    
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      theme: {
        background: '#0b0f14',
        foreground: '#e6edf3',
        cursor: '#6ab7ff',
        black: '#000000',
        red: '#ff6b6b',
        green: '#27d980',
        yellow: '#ffc857',
        blue: '#6ab7ff',
        magenta: '#c792ea',
        cyan: '#89ddff',
        white: '#ffffff',
      },
      scrollback: 10000,
      allowTransparency: true,
    });
    
    const container = document.getElementById('terminalContainer');
    term.open(container);
    
    // Fit addon for responsive resize
    if (typeof FitAddon !== 'undefined') {
      const fitAddon = new FitAddon.FitAddon();
      term.loadAddon(fitAddon);
      term.fit = () => fitAddon.fit();
      
      // Auto-fit on window resize
      window.addEventListener('resize', () => {
        if (TerminalPanel.isOpen && term.fit) {
          term.fit();
        }
      });
    }
    
    // Welcome message
    term.writeln('\x1b[1;36m╔════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[1;36m║   Warp Terminal - Agentic Dev Hub     ║\x1b[0m');
    term.writeln('\x1b[1;36m╚════════════════════════════════════════╝\x1b[0m');
    term.writeln('');
    term.writeln('\x1b[90mConnecting to terminal session...\x1b[0m');
    term.writeln('');
    
    // Handle local input (buffer until Enter)
    term.onData((data) => {
      // Handle different keys
      if (data === '\r') { // Enter
        // Send command via WebSocket
        if (TerminalPanel.socket && TerminalPanel.socket.readyState === WebSocket.OPEN) {
          TerminalPanel.socket.send(JSON.stringify({
            type: 'command',
            data: TerminalPanel.currentCommand + '\n'
          }));
          
          // Save to history
          if (TerminalPanel.currentCommand.trim()) {
            addToHistory(TerminalPanel.currentCommand);
          }
          
          TerminalPanel.currentCommand = '';
          term.write('\r\n');
        }
      } else if (data === '\u007F') { // Backspace
        if (TerminalPanel.currentCommand.length > 0) {
          TerminalPanel.currentCommand = TerminalPanel.currentCommand.slice(0, -1);
          term.write('\b \b');
        }
      } else if (data === '\u0003') { // Ctrl+C
        term.write('^C\r\n');
        TerminalPanel.currentCommand = '';
      } else {
        // Regular character
        TerminalPanel.currentCommand += data;
        term.write(data);
      }
    });
    
    TerminalPanel.term = term;
  }

  // Connect to WebSocket backend
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/terminal-ws`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('Terminal WebSocket connected');
      if (TerminalPanel.term) {
        TerminalPanel.term.writeln('\x1b[32m✓ Connected to terminal session\x1b[0m');
        TerminalPanel.term.writeln('');
        TerminalPanel.term.write('\x1b[36m$\x1b[0m ');
      }
    };
    
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'output' && TerminalPanel.term) {
          // Write output to terminal (supports ANSI colors)
          TerminalPanel.term.write(msg.data);
        } else if (msg.type === 'session' && msg.sessionId) {
          TerminalPanel.sessionId = msg.sessionId;
          localStorage.setItem('terminal:sessionId', msg.sessionId);
        }
      } catch (err) {
        // Raw text output (fallback)
        if (TerminalPanel.term) {
          TerminalPanel.term.write(event.data);
        }
      }
    };
    
    socket.onerror = (error) => {
      console.error('Terminal WebSocket error:', error);
      if (TerminalPanel.term) {
        TerminalPanel.term.writeln('\r\n\x1b[31m✗ Connection error\x1b[0m');
      }
    };
    
    socket.onclose = () => {
      console.log('Terminal WebSocket closed');
      if (TerminalPanel.term) {
        TerminalPanel.term.writeln('\r\n\x1b[33m⚠ Connection closed. Click Restart to reconnect.\x1b[0m');
      }
      TerminalPanel.socket = null;
    };
    
    TerminalPanel.socket = socket;
  }

  // Execute command programmatically (from Prompt Factory)
  window.executeInTerminal = function(command) {
    if (!TerminalPanel.isOpen) {
      toggleTerminal();
      // Wait for terminal to initialize
      setTimeout(() => executeCommand(command), 500);
    } else {
      executeCommand(command);
    }
  };

  function executeCommand(command) {
    if (!TerminalPanel.socket || TerminalPanel.socket.readyState !== WebSocket.OPEN) {
      console.error('Terminal not connected');
      if (window.showToast) showToast('Terminal not connected', 'error');
      return;
    }
    
    // Write command to terminal visually
    if (TerminalPanel.term) {
      TerminalPanel.term.write(command);
    }
    
    // Send via WebSocket
    TerminalPanel.socket.send(JSON.stringify({
      type: 'command',
      data: command + '\n'
    }));
    
    // Save to history
    if (command.trim()) {
      addToHistory(command.trim());
    }
  }

  // History management
  function addToHistory(command) {
    // Avoid duplicates
    TerminalPanel.history = TerminalPanel.history.filter(c => c !== command);
    TerminalPanel.history.unshift(command);
    
    // Keep last 50
    if (TerminalPanel.history.length > 50) {
      TerminalPanel.history = TerminalPanel.history.slice(0, 50);
    }
    
    localStorage.setItem('terminal:history', JSON.stringify(TerminalPanel.history));
  }

  function showHistory() {
    const modal = document.getElementById('termHistoryModal');
    const list = document.getElementById('termHistoryList');
    
    if (TerminalPanel.history.length === 0) {
      list.innerHTML = '<div class="terminal-empty">No command history</div>';
    } else {
      list.innerHTML = TerminalPanel.history.map((cmd, i) => `
        <div class="terminal-history-item">
          <code>${escapeHtml(cmd)}</code>
          <div class="terminal-history-actions">
            <button class="terminal-btn" onclick="window.rerunCommand('${escapeHtml(cmd).replace(/'/g, "\\'")}')">▶ Run</button>
            <button class="terminal-btn" onclick="window.favoriteCommand('${escapeHtml(cmd).replace(/'/g, "\\'")}')">⭐</button>
          </div>
        </div>
      `).join('');
    }
    
    modal.style.display = 'flex';
  }

  function showFavorites() {
    const modal = document.getElementById('termFavoritesModal');
    const list = document.getElementById('termFavoritesList');
    
    if (TerminalPanel.favorites.length === 0) {
      list.innerHTML = '<div class="terminal-empty">No favorite commands</div>';
    } else {
      list.innerHTML = TerminalPanel.favorites.map((cmd, i) => `
        <div class="terminal-history-item">
          <code>${escapeHtml(cmd)}</code>
          <div class="terminal-history-actions">
            <button class="terminal-btn" onclick="window.rerunCommand('${escapeHtml(cmd).replace(/'/g, "\\'")}')">▶ Run</button>
            <button class="terminal-btn" onclick="window.unfavoriteCommand('${escapeHtml(cmd).replace(/'/g, "\\'")}')">✕</button>
          </div>
        </div>
      `).join('');
    }
    
    modal.style.display = 'flex';
  }

  window.rerunCommand = function(command) {
    document.getElementById('termHistoryModal').style.display = 'none';
    document.getElementById('termFavoritesModal').style.display = 'none';
    executeCommand(command);
  };

  window.favoriteCommand = function(command) {
    if (!TerminalPanel.favorites.includes(command)) {
      TerminalPanel.favorites.push(command);
      localStorage.setItem('terminal:favorites', JSON.stringify(TerminalPanel.favorites));
      if (window.showToast) showToast('Added to favorites', 'success');
    }
  };

  window.unfavoriteCommand = function(command) {
    TerminalPanel.favorites = TerminalPanel.favorites.filter(c => c !== command);
    localStorage.setItem('terminal:favorites', JSON.stringify(TerminalPanel.favorites));
    showFavorites(); // Refresh list
    if (window.showToast) showToast('Removed from favorites', 'info');
  };

  function clearTerminal() {
    if (TerminalPanel.term) {
      TerminalPanel.term.clear();
    }
  }

  function restartTerminal() {
    if (TerminalPanel.socket) {
      TerminalPanel.socket.close();
    }
    if (TerminalPanel.term) {
      TerminalPanel.term.clear();
    }
    connectWebSocket();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initTerminalPanel);
  } else {
    window.initTerminalPanel();
  }
})();
