const API_BASE = '';

class WorkflowBuilder {
  constructor() {
    this.canvas = document.getElementById('workflow-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.nodesContainer = document.getElementById('nodes-container');
    this.nodes = [];
    this.edges = [];
    this.selectedNode = null;
    this.dragNode = null;
    this.connectingFrom = null;
    this.currentWorkflowId = null;
    
    this.init();
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.setupEventListeners();
    this.loadAgents();
    this.render();
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    this.render();
  }

  setupEventListeners() {
    // Toolbar buttons
    document.getElementById('btn-new').addEventListener('click', () => this.newWorkflow());
    document.getElementById('btn-save').addEventListener('click', () => this.saveWorkflow());
    document.getElementById('btn-load').addEventListener('click', () => this.loadWorkflow());
    document.getElementById('btn-execute').addEventListener('click', () => this.executeWorkflow());
    document.getElementById('btn-clear').addEventListener('click', () => this.clearCanvas());

    // Canvas events
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    this.canvas.addEventListener('dblclick', (e) => this.handleCanvasDoubleClick(e));
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.connectingFrom = null;
      this.render();
    });

    // Node dragging
    this.nodesContainer.addEventListener('mousedown', (e) => {
      if (e.target.closest('.workflow-node')) {
        this.dragNode = e.target.closest('.workflow-node');
        this.dragNode.style.cursor = 'grabbing';
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (this.dragNode) {
        const rect = this.nodesContainer.getBoundingClientRect();
        const x = e.clientX - rect.left - 75;
        const y = e.clientY - rect.top - 20;
        this.dragNode.style.left = x + 'px';
        this.dragNode.style.top = y + 'px';
        
        const node = this.nodes.find(n => n.id === this.dragNode.dataset.nodeId);
        if (node) {
          node.x = x;
          node.y = y;
        }
        this.render();
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.dragNode) {
        this.dragNode.style.cursor = 'move';
        this.dragNode = null;
      }
    });
  }

  async loadAgents() {
    try {
      const response = await fetch(`${API_BASE}/api/agents/list`);
      const data = await response.json();
      const agents = data.agents || [];
      
      const agentList = document.getElementById('agent-list');
      agentList.innerHTML = agents.map(agent => `
        <div class="agent-item" draggable="true" data-agent-id="${agent.id}">
          <div style="font-weight: 600;">${agent.name}</div>
          <div style="font-size: 0.75rem; opacity: 0.7;">${agent.id}</div>
        </div>
      `).join('');

      // Drag from palette
      agentList.querySelectorAll('.agent-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('agentId', item.dataset.agentId);
        });
      });

      this.nodesContainer.addEventListener('dragover', (e) => e.preventDefault());
      this.nodesContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        const agentId = e.dataTransfer.getData('agentId');
        const rect = this.nodesContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.addNode(agentId, x, y);
      });
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  }

  addNode(agentId, x, y) {
    const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const node = { id: nodeId, agentId, x, y, config: {} };
    this.nodes.push(node);
    
    const nodeEl = document.createElement('div');
    nodeEl.className = 'workflow-node';
    nodeEl.dataset.nodeId = nodeId;
    nodeEl.style.left = x + 'px';
    nodeEl.style.top = y + 'px';
    nodeEl.innerHTML = `
      <h4>${agentId}</h4>
      <div class="node-id">${nodeId}</div>
    `;
    
    nodeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectNode(node);
    });
    
    this.nodesContainer.appendChild(nodeEl);
    this.render();
  }

  selectNode(node) {
    this.selectedNode = node;
    document.querySelectorAll('.workflow-node').forEach(el => {
      el.classList.toggle('selected', el.dataset.nodeId === node.id);
    });
    
    document.getElementById('node-properties').style.display = 'block';
    document.getElementById('node-id').value = node.id;
    document.getElementById('node-agent-id').value = node.agentId;
    document.getElementById('node-config').value = JSON.stringify(node.config, null, 2);
  }

  handleCanvasClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const clickedNode = this.getNodeAt(x, y);
    
    if (e.shiftKey && clickedNode) {
      if (this.connectingFrom === null) {
        this.connectingFrom = clickedNode;
      } else {
        this.addEdge(this.connectingFrom, clickedNode);
        this.connectingFrom = null;
      }
      this.render();
    }
  }

  handleCanvasDoubleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedEdge = this.getEdgeAt(x, y);
    
    if (clickedEdge) {
      const index = this.edges.indexOf(clickedEdge);
      this.edges.splice(index, 1);
      this.render();
    }
  }

  getNodeAt(x, y) {
    for (const node of this.nodes) {
      if (x >= node.x && x <= node.x + 150 && y >= node.y && y <= node.y + 60) {
        return node;
      }
    }
    return null;
  }

  getEdgeAt(x, y, threshold = 10) {
    for (const edge of this.edges) {
      const source = this.nodes.find(n => n.id === edge.source);
      const target = this.nodes.find(n => n.id === edge.target);
      if (source && target) {
        const dist = this.pointToLineDistance(x, y, 
          source.x + 75, source.y + 30, 
          target.x + 75, target.y + 30);
        if (dist < threshold) return edge;
      }
    }
    return null;
  }

  pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    const param = lenSq !== 0 ? dot / lenSq : -1;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  addEdge(source, target) {
    if (source.id === target.id) return;
    const exists = this.edges.some(e => e.source === source.id && e.target === target.id);
    if (!exists) {
      this.edges.push({ source: source.id, target: target.id });
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw edges
    this.ctx.strokeStyle = '#10b981';
    this.ctx.lineWidth = 2;
    this.edges.forEach(edge => {
      const source = this.nodes.find(n => n.id === edge.source);
      const target = this.nodes.find(n => n.id === edge.target);
      if (source && target) {
        this.drawArrow(
          source.x + 75, source.y + 30,
          target.x + 75, target.y + 30
        );
      }
    });
    
    // Draw connecting line if in progress
    if (this.connectingFrom) {
      this.ctx.strokeStyle = '#fbbf24';
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(this.connectingFrom.x + 75, this.connectingFrom.y + 30);
      this.ctx.lineTo(this.connectingFrom.x + 75, this.connectingFrom.y + 30);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  drawArrow(x1, y1, x2, y2) {
    const headlen = 10;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    
    this.ctx.beginPath();
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    this.ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    this.ctx.closePath();
    this.ctx.fillStyle = '#10b981';
    this.ctx.fill();
  }

  newWorkflow() {
    this.clearCanvas();
    this.currentWorkflowId = null;
    document.getElementById('workflow-name').value = '';
    document.getElementById('workflow-description').value = '';
  }

  clearCanvas() {
    this.nodes = [];
    this.edges = [];
    this.nodesContainer.innerHTML = '';
    this.selectedNode = null;
    this.connectingFrom = null;
    document.getElementById('node-properties').style.display = 'none';
    this.render();
  }

  async saveWorkflow() {
    const name = document.getElementById('workflow-name').value || 'Untitled Workflow';
    const description = document.getElementById('workflow-description').value;
    const executionMode = document.getElementById('execution-mode').value;
    
    const workflow = {
      name,
      description,
      nodes: this.nodes,
      edges: this.edges,
      config: { executionMode }
    };

    try {
      const url = this.currentWorkflowId 
        ? `${API_BASE}/api/workflows/${this.currentWorkflowId}`
        : `${API_BASE}/api/workflows/create`;
      
      const method = this.currentWorkflowId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow)
      });
      
      const result = await response.json();
      this.currentWorkflowId = result.id;
      alert('Workflow saved successfully!');
    } catch (error) {
      alert('Failed to save workflow: ' + error.message);
    }
  }

  async loadWorkflow() {
    try {
      const response = await fetch(`${API_BASE}/api/workflows`);
      const workflows = await response.json();
      
      if (workflows.length === 0) {
        alert('No workflows found');
        return;
      }
      
      const workflowId = prompt('Enter workflow ID to load:');
      const workflow = workflows.find(w => w.id === workflowId);
      
      if (!workflow) {
        alert('Workflow not found');
        return;
      }
      
      this.clearCanvas();
      this.currentWorkflowId = workflow.id;
      this.nodes = workflow.nodes;
      this.edges = workflow.edges;
      
      document.getElementById('workflow-name').value = workflow.name;
      document.getElementById('workflow-description').value = workflow.description || '';
      document.getElementById('execution-mode').value = workflow.config?.executionMode || 'sequential';
      
      this.nodes.forEach(node => {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'workflow-node';
        nodeEl.dataset.nodeId = node.id;
        nodeEl.style.left = node.x + 'px';
        nodeEl.style.top = node.y + 'px';
        nodeEl.innerHTML = `
          <h4>${node.agentId}</h4>
          <div class="node-id">${node.id}</div>
        `;
        nodeEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectNode(node);
        });
        this.nodesContainer.appendChild(nodeEl);
      });
      
      this.render();
    } catch (error) {
      alert('Failed to load workflow: ' + error.message);
    }
  }

  async executeWorkflow() {
    if (!this.currentWorkflowId) {
      await this.saveWorkflow();
    }
    
    const executionLog = document.getElementById('execution-log');
    const executionInfo = document.getElementById('execution-info');
    
    executionLog.innerHTML = '<div class="log-entry">Starting execution...</div>';
    executionInfo.innerHTML = '<p>Status: Running</p>';
    
    try {
      const response = await fetch(`${API_BASE}/api/workflows/${this.currentWorkflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: {} })
      });
      
      const execution = await response.json();
      
      executionLog.innerHTML += `<div class="log-entry">Execution ID: ${execution.id}</div>`;
      
      // Poll for status
      this.pollExecutionStatus(execution.id);
    } catch (error) {
      executionLog.innerHTML += `<div class="log-entry error">Error: ${error.message}</div>`;
      executionInfo.innerHTML = '<p>Status: Failed</p>';
    }
  }

  async pollExecutionStatus(executionId) {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/workflows/execution/${executionId}/status`);
        const execution = await response.json();
        
        const executionInfo = document.getElementById('execution-info');
        const executionLog = document.getElementById('execution-log');
        
        executionInfo.innerHTML = `
          <p>Status: ${execution.status}</p>
          <p>Duration: ${execution.duration || 0}ms</p>
        `;
        
        if (execution.status === 'completed' || execution.status === 'failed') {
          clearInterval(interval);
          executionLog.innerHTML += `<div class="log-entry ${execution.status === 'completed' ? 'success' : 'error'}">
            Execution ${execution.status}
          </div>`;
          
          Object.entries(execution.results || {}).forEach(([nodeId, result]) => {
            executionLog.innerHTML += `<div class="log-entry success">Node ${nodeId}: Success</div>`;
          });
        }
      } catch (error) {
        clearInterval(interval);
        console.error('Failed to poll execution:', error);
      }
    }, 1000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new WorkflowBuilder();
});
