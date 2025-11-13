// Wave 2 Batch 1: Import Wizard + Approvals Pyramid Enhancements
// To be merged into agents.html after validation testing

// ==============================================
// HELPER: Import Wizard Cell Validation
// ==============================================

function validateImportCells(agents, skills, allAgents, allSkills) {
  const errors = {}; // { "agent:0:name": "error msg", ... }
  const agentNames = new Set(allAgents.map(a => a.name));
  const skillNames = new Set(allSkills.map(s => s.name));
  const importAgentNames = new Set();
  
  // Validate agents
  agents.forEach((a, idx) => {
    const prefix = `agent:${idx}`;
    
    // Check name uniqueness
    if (!a.name || !a.name.trim()) {
      errors[`${prefix}:name`] = 'Name required';
    } else if (importAgentNames.has(a.name)) {
      errors[`${prefix}:name`] = 'Duplicate in import';
    } else if (agentNames.has(a.name)) {
      errors[`${prefix}:name`] = `Already exists`;
    } else {
      importAgentNames.add(a.name);
    }
    
    // Check role
    if (a.role && !['planner', 'executor', 'validator', 'custom'].includes(a.role)) {
      errors[`${prefix}:role`] = 'Invalid role';
    }
    
    // Check model
    if (!a.model || !a.model.trim()) {
      errors[`${prefix}:model`] = 'Model required';
    }
    
    // Check skills exist
    (a.skills || []).forEach((skill, sidx) => {
      if (!skillNames.has(skill)) {
        errors[`${prefix}:skills:${sidx}`] = `Skill "${skill}" not found`;
      }
    });
  });
  
  // Validate skills
  const skillNamesImport = new Set();
  skills.forEach((s, idx) => {
    const prefix = `skill:${idx}`;
    
    if (!s.name || !s.name.trim()) {
      errors[`${prefix}:name`] = 'Name required';
    } else if (skillNamesImport.has(s.name)) {
      errors[`${prefix}:name`] = 'Duplicate in import';
    } else if (skillNames.has(s.name)) {
      errors[`${prefix}:name`] = 'Already exists';
    } else {
      skillNamesImport.add(s.name);
    }
  });
  
  return errors;
}

// Auto-fix suggestions
function suggestFix(fieldKey, value, context) {
  const { kind, field, index, existing } = context;
  
  if (field === 'name' && kind === 'agent') {
    if (existing.includes(value)) {
      return `${value}-imported`; // suggest unique name
    }
  }
  
  if (field === 'model' && !value) {
    return 'gpt-4'; // default model
  }
  
  return null;
}

// Render import table with cell errors
function renderImportTable(agents, skills, cellErrors = {}, onCellEdit = null) {
  const rows = [];
  
  rows.push('<div><b>Agents</b> <span class="small" style="color:var(--warn)">(' + Object.keys(cellErrors).filter(k => k.startsWith('agent:')).length + ' issues)</span></div>');
  rows.push('<table class="small" style="border-collapse:collapse;width:100%"><tr><th style="border:1px solid var(--border);padding:4px"><input type="checkbox" id="selAllAgents"/></th><th style="border:1px solid var(--border);padding:4px">Name</th><th style="border:1px solid var(--border);padding:4px">Role</th><th style="border:1px solid var(--border);padding:4px">Model</th><th style="border:1px solid var(--border);padding:4px">Skills</th></tr>');
  
  agents.forEach((a, i) => {
    const nameErr = cellErrors[`agent:${i}:name`];
    const roleErr = cellErrors[`agent:${i}:role`];
    const modelErr = cellErrors[`agent:${i}:model`];
    const nameStyle = nameErr ? 'background-color:rgba(255,0,0,.15);border:1px solid var(--warn)' : 'border:1px solid var(--border)';
    const roleStyle = roleErr ? 'background-color:rgba(255,0,0,.15);border:1px solid var(--warn)' : 'border:1px solid var(--border)';
    const modelStyle = modelErr ? 'background-color:rgba(255,0,0,.15);border:1px solid var(--warn)' : 'border:1px solid var(--border)';
    
    rows.push(`<tr data-import-agent=${i}><td style="border:1px solid var(--border);padding:4px"><input type=checkbox data-kind=agent data-index=${i} checked/></td><td style="${nameStyle};padding:4px"><div>${a.name || ''}</div>${nameErr ? `<div class="small" style="color:var(--warn);font-size:0.8em">⚠ ${nameErr}</div>` : ''}</td><td style="${roleStyle};padding:4px">${a.role || ''}</td><td style="${modelStyle};padding:4px">${a.model || ''}</td><td style="border:1px solid var(--border);padding:4px">${(a.skills || []).join(', ')}</td></tr>`);
  });
  
  rows.push('</table>');
  rows.push('<div style="margin-top:8px"><b>Skills</b> <span class="small" style="color:var(--warn)">(' + Object.keys(cellErrors).filter(k => k.startsWith('skill:')).length + ' issues)</span></div>');
  rows.push('<table class="small" style="border-collapse:collapse;width:100%"><tr><th style="border:1px solid var(--border);padding:4px"><input type="checkbox" id="selAllSkills"/></th><th style="border:1px solid var(--border);padding:4px">Name</th><th style="border:1px solid var(--border);padding:4px">Description</th></tr>');
  
  skills.forEach((s, i) => {
    const nameErr = cellErrors[`skill:${i}:name`];
    const nameStyle = nameErr ? 'background-color:rgba(255,0,0,.15);border:1px solid var(--warn)' : 'border:1px solid var(--border)';
    
    rows.push(`<tr data-import-skill=${i}><td style="border:1px solid var(--border);padding:4px"><input type=checkbox data-kind=skill data-index=${i} checked/></td><td style="${nameStyle};padding:4px"><div>${s.name || ''}</div>${nameErr ? `<div class="small" style="color:var(--warn);font-size:0.8em">⚠ ${nameErr}</div>` : ''}</td><td style="border:1px solid var(--border);padding:4px">${(s.description || '').slice(0, 60)}</td></tr>`);
  });
  
  rows.push('</table>');
  
  return rows.join('');
}

// ==============================================
// HELPER: Approvals Pyramid UX
// ==============================================

function createApprovalPyramid(currentAutonomy = 0, onchange = null) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'cursor:pointer;user-select:none;position:relative;';
  wrap.innerHTML = `
    <div style="font-family:monospace;text-align:center;line-height:1;user-select:none;">
      <div style="margin:4px;color:${currentAutonomy >= 0 ? 'var(--warn)' : 'var(--border)'};transition:color 0.2s">▲</div>
      <div style="margin:2px;color:${currentAutonomy >= 1 ? 'var(--warn)' : 'var(--border)'};transition:color 0.2s">▲ ▲</div>
      <div style="margin:0px;color:${currentAutonomy >= 2 ? 'var(--warn)' : 'var(--border)'};transition:color 0.2s">▲ ▲ ▲</div>
      <div style="margin:-2px;color:${currentAutonomy >= 3 ? 'var(--ok)' : 'var(--border)'};transition:color 0.2s">▲ ▲ ▲ ▲</div>
    </div>
  `;
  
  wrap.onclick = (e) => {
    const rect = wrap.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const ratio = y / height;
    const newLevel = Math.max(0, Math.min(3, Math.floor(ratio * 4)));
    
    if (onchange) onchange(newLevel);
    
    // Trigger re-render with animation
    wrap.style.opacity = '0.7';
    setTimeout(() => { wrap.style.opacity = '1'; }, 100);
  };
  
  wrap.title = `Click to set autonomy level (0=Safe → 3=Autonomous)`;
  
  return wrap;
}

// Track autonomy history in edit session
function trackAutonomyChange(agent, oldVal, newVal, reason = 'manual') {
  if (!agent._approvalHistory) agent._approvalHistory = [];
  agent._approvalHistory.push({
    ts: Date.now(),
    oldValue: oldVal,
    newValue: newVal,
    reason
  });
}

// Render approval history mini-panel
function renderApprovalHistory(agent) {
  if (!agent._approvalHistory || !agent._approvalHistory.length) {
    return '<div class="small" style="color:var(--border)">No changes yet</div>';
  }
  
  const rows = agent._approvalHistory.slice(-5).reverse().map(h => {
    const time = new Date(h.ts).toLocaleTimeString();
    return `<div class="small" style="padding:2px 0"><span style="color:var(--warn)">${time}</span>: ${h.oldValue} → ${h.newValue} (${h.reason})</div>`;
  });
  
  return rows.join('');
}

// ==============================================
// INTEGRATION POINTS (to be merged into agents.html)
// ==============================================

/*

// 1. In kvApprovals() function, replace pyramid rendering:

      const pyr = document.createElement('div'); 
      pyr.className='small'; 
      const pyramid = createApprovalPyramid(appr.autonomy || 0, (level) => {
        obj.approvals = obj.approvals || {}; 
        trackAutonomyChange(obj, obj.approvals.autonomy, level, 'pyramid-drag');
        obj.approvals.autonomy = level; 
        slider.value = String(level);
        val.textContent = `autonomy ${level}`;
        S.saveReason = 'autonomy-change';
        validateLive();
      });
      pyr.appendChild(pyramid);
      div.appendChild(pyr);

// 2. In import wizard, replace table rendering:

      const cellErrors = validateImportCells(agents, skills, S.agents, S.skills);
      table.innerHTML = renderImportTable(agents, skills, cellErrors);
      const errorCount = Object.keys(cellErrors).length;
      status.textContent = errorCount > 0 
        ? `⚠ ${errorCount} validation issues found`
        : 'Valid ✓';
      qs('#applyImport').disabled = errorCount > 0;

// 3. Add batch ID tracking post-import success:

      S.importBatch = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const undoBtn = document.createElement('button');
      undoBtn.className = 'pill';
      undoBtn.textContent = 'Undo this import';
      undoBtn.onclick = async () => {
        if (!confirm('Undo import batch?')) return;
        await fetch('/api/agents/rollback-group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names: [S.importBatch] })
        });
        await loadAll();
      };
      status.appendChild(undoBtn);

// 4. Add history summary in approval editor:

      const historyDiv = document.createElement('div');
      historyDiv.className = 'small';
      historyDiv.innerHTML = '<b style="display:block;margin:8px 0">Autonomy Changes:</b>' + renderApprovalHistory(S.editObj);
      form.appendChild(historyDiv);

*/
