import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class AgentOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.workflows = new Map();
    this.executions = new Map();
    this.workflowsFile = path.join(__dirname, '../../../runtime/workflows.json');
    this.executionsFile = path.join(__dirname, '../../../runtime/workflow-executions.json');
  }

  async initialize() {
    try {
      const data = await fs.readFile(this.workflowsFile, 'utf8');
      const workflows = JSON.parse(data);
      workflows.forEach(wf => this.workflows.set(wf.id, wf));
    } catch (error) {
      await fs.writeFile(this.workflowsFile, JSON.stringify([], null, 2));
    }

    try {
      const data = await fs.readFile(this.executionsFile, 'utf8');
      const executions = JSON.parse(data);
      executions.forEach(exec => this.executions.set(exec.id, exec));
    } catch (error) {
      await fs.writeFile(this.executionsFile, JSON.stringify([], null, 2));
    }
  }

  async createWorkflow(workflow) {
    const id = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newWorkflow = {
      id,
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes || [],
      edges: workflow.edges || [],
      config: workflow.config || {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.workflows.set(id, newWorkflow);
    await this.persistWorkflows();
    return newWorkflow;
  }

  async updateWorkflow(id, updates) {
    const workflow = this.workflows.get(id);
    if (!workflow) throw new Error('Workflow not found');
    
    Object.assign(workflow, updates, { updatedAt: Date.now() });
    await this.persistWorkflows();
    return workflow;
  }

  async deleteWorkflow(id) {
    if (!this.workflows.has(id)) throw new Error('Workflow not found');
    this.workflows.delete(id);
    await this.persistWorkflows();
    return { success: true };
  }

  async executeWorkflow(workflowId, context = {}, agentMemory) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const execution = {
      id: executionId,
      workflowId,
      status: 'running',
      startedAt: Date.now(),
      context,
      results: {},
      errors: []
    };

    this.executions.set(executionId, execution);
    this.emit('execution:started', execution);

    try {
      const sortedNodes = this.topologicalSort(workflow);
      const executionMode = workflow.config.executionMode || 'sequential';

      if (executionMode === 'parallel') {
        await this.executeParallel(sortedNodes, execution, agentMemory);
      } else {
        await this.executeSequential(sortedNodes, execution, agentMemory);
      }

      execution.status = 'completed';
      execution.completedAt = Date.now();
      execution.duration = execution.completedAt - execution.startedAt;
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = Date.now();
      this.emit('execution:failed', execution, error);
    }

    await this.persistExecutions();
    this.emit('execution:completed', execution);
    return execution;
  }

  async executeSequential(nodes, execution, agentMemory) {
    for (const node of nodes) {
      if (execution.status === 'paused') {
        await this.waitForResume(execution.id);
      }
      if (execution.status === 'cancelled') {
        throw new Error('Execution cancelled');
      }

      const result = await this.executeNode(node, execution, agentMemory);
      execution.results[node.id] = result;
      this.emit('node:completed', { executionId: execution.id, nodeId: node.id, result });
    }
  }

  async executeParallel(nodes, execution, agentMemory) {
    const levels = this.computeExecutionLevels(nodes, execution.workflowId);
    
    for (const level of levels) {
      const promises = level.map(node => 
        this.executeNode(node, execution, agentMemory)
          .then(result => {
            execution.results[node.id] = result;
            this.emit('node:completed', { executionId: execution.id, nodeId: node.id, result });
            return result;
          })
      );
      
      await Promise.all(promises);
    }
  }

  async executeNode(node, execution, agentMemory) {
    const startTime = Date.now();
    
    try {
      const inputData = this.gatherNodeInputs(node, execution);
      
      // Simulate agent execution with memory
      const memory = await agentMemory.get(node.agentId);
      const result = {
        nodeId: node.id,
        agentId: node.agentId,
        input: inputData,
        output: await this.callAgent(node, inputData, memory),
        executedAt: Date.now(),
        duration: Date.now() - startTime
      };

      await agentMemory.set(node.agentId, {
        lastExecution: result,
        context: execution.context
      });

      return result;
    } catch (error) {
      execution.errors.push({
        nodeId: node.id,
        error: error.message,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  async callAgent(node, input, memory) {
    // This will be integrated with actual agent execution
    return {
      status: 'success',
      data: `Agent ${node.agentId} processed: ${JSON.stringify(input)}`,
      memory: memory,
      timestamp: Date.now()
    };
  }

  gatherNodeInputs(node, execution) {
    const workflow = this.workflows.get(execution.workflowId);
    const inputs = {};
    
    const incomingEdges = workflow.edges.filter(e => e.target === node.id);
    incomingEdges.forEach(edge => {
      const sourceResult = execution.results[edge.source];
      if (sourceResult) {
        inputs[edge.sourceOutput || 'output'] = sourceResult.output;
      }
    });

    return Object.keys(inputs).length > 0 ? inputs : execution.context;
  }

  topologicalSort(workflow) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) throw new Error('Circular dependency detected');

      visiting.add(nodeId);
      
      const outgoingEdges = workflow.edges.filter(e => e.source === nodeId);
      outgoingEdges.forEach(edge => visit(edge.target));
      
      visiting.delete(nodeId);
      visited.add(nodeId);
      
      const node = workflow.nodes.find(n => n.id === nodeId);
      if (node) sorted.unshift(node);
    };

    workflow.nodes.forEach(node => visit(node.id));
    return sorted;
  }

  computeExecutionLevels(nodes, workflowId) {
    const workflow = this.workflows.get(workflowId);
    const levels = [];
    const nodeLevel = new Map();
    
    nodes.forEach(node => {
      const incomingEdges = workflow.edges.filter(e => e.target === node.id);
      if (incomingEdges.length === 0) {
        nodeLevel.set(node.id, 0);
      } else {
        const maxParentLevel = Math.max(
          ...incomingEdges.map(e => nodeLevel.get(e.source) || 0)
        );
        nodeLevel.set(node.id, maxParentLevel + 1);
      }
    });

    nodes.forEach(node => {
      const level = nodeLevel.get(node.id);
      if (!levels[level]) levels[level] = [];
      levels[level].push(node);
    });

    return levels;
  }

  async pauseExecution(executionId) {
    const execution = this.executions.get(executionId);
    if (!execution) throw new Error('Execution not found');
    execution.status = 'paused';
    await this.persistExecutions();
    return execution;
  }

  async cancelExecution(executionId) {
    const execution = this.executions.get(executionId);
    if (!execution) throw new Error('Execution not found');
    execution.status = 'cancelled';
    execution.completedAt = Date.now();
    await this.persistExecutions();
    return execution;
  }

  async waitForResume(executionId) {
    return new Promise((resolve) => {
      const checkStatus = setInterval(() => {
        const execution = this.executions.get(executionId);
        if (execution.status !== 'paused') {
          clearInterval(checkStatus);
          resolve();
        }
      }, 100);
    });
  }

  getWorkflow(id) {
    return this.workflows.get(id);
  }

  getAllWorkflows() {
    return Array.from(this.workflows.values());
  }

  getExecution(id) {
    return this.executions.get(id);
  }

  getExecutionHistory(workflowId) {
    return Array.from(this.executions.values())
      .filter(exec => exec.workflowId === workflowId)
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  async persistWorkflows() {
    const workflows = Array.from(this.workflows.values());
    await fs.writeFile(this.workflowsFile, JSON.stringify(workflows, null, 2));
  }

  async persistExecutions() {
    const executions = Array.from(this.executions.values());
    await fs.writeFile(this.executionsFile, JSON.stringify(executions, null, 2));
  }
}

export default AgentOrchestrator;
