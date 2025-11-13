// Analytics Dashboard - Data & Visualization Engine

let analyticsData = null;
let charts = {};
let agentsData = [];

// Initialize on load
(async function init() {
  await loadAnalytics();
  renderKPIs();
  renderCharts();
  renderAgentTable();
  renderHeatmap();
  renderInsights();
  renderCostTracking();
  
  // Time range selector
  document.getElementById('timeRange').addEventListener('change', (e) => {
    loadAnalytics(e.target.value);
  });
  
  // Agent search
  document.getElementById('agentSearch').addEventListener('input', filterAgents);
})();

async function loadAnalytics(window = '24h') {
  try {
    const res = await fetch(`/api/analytics/kpi?window=${window}`);
    analyticsData = await res.json();
    
    // Load agent-specific data
    const agentRes = await fetch('/api/analytics/agents');
    agentsData = (await agentRes.json()).agents || [];
    
  } catch (e) {
    console.error('Failed to load analytics:', e);
    analyticsData = getMockData();
  }
}

function getMockData() {
  return {
    totalRuns: 1247,
    successRate: 0.94,
    avgLatency: 342,
    totalCost: 12.45,
    activeAgents: 8,
    errorRate: 0.06,
    trends: {
      runs: [120, 145, 132, 158, 149, 167, 189, 201, 187, 195, 203, 198],
      success: [88, 91, 89, 93, 92, 94, 95, 93, 96, 94, 95, 93],
      latency: [350, 345, 340, 338, 335, 330, 328, 325, 320, 318, 315, 312]
    },
    agentUsage: {
      'code-gen': 45,
      'test-runner': 32,
      'deploy-manager': 18,
      'debug-assistant': 15,
      'docs-writer': 12,
      'review-bot': 8
    },
    costByModel: {
      'claude-3': 5.2,
      'gpt-4': 3.8,
      'deepseek': 2.1,
      'claude-haiku': 1.35
    },
    latencyDist: [45, 67, 89, 112, 98, 76, 54, 32, 21, 10]
  };
}

function renderKPIs() {
  const data = analyticsData || getMockData();
  
  // Total Runs
  document.getElementById('kpiRuns').textContent = formatNumber(data.totalRuns);
  document.getElementById('kpiRunsTrend').innerHTML = getTrendIndicator(+12);
  
  // Success Rate
  document.getElementById('kpiSuccess').textContent = formatPercent(data.successRate);
  document.getElementById('kpiSuccessTrend').innerHTML = getTrendIndicator(+3);
  
  // Avg Latency
  document.getElementById('kpiLatency').textContent = `${Math.round(data.avgLatency)}ms`;
  document.getElementById('kpiLatencyTrend').innerHTML = getTrendIndicator(-5);
  
  // Total Cost
  document.getElementById('kpiCost').textContent = `$${data.totalCost.toFixed(2)}`;
  document.getElementById('kpiCostTrend').innerHTML = getTrendIndicator(-8);
  
  // Active Agents
  document.getElementById('kpiAgents').textContent = data.activeAgents;
  document.getElementById('kpiAgentsTrend').innerHTML = getTrendIndicator(0);
  
  // Error Rate
  document.getElementById('kpiErrors').textContent = formatPercent(data.errorRate);
  document.getElementById('kpiErrorsTrend').innerHTML = getTrendIndicator(-2);
}

function getTrendIndicator(percent) {
  if (percent === 0) return '<span style="opacity:0.5;">—</span>';
  const color = percent > 0 ? 'var(--success)' : 'var(--error)';
  const arrow = percent > 0 ? '↑' : '↓';
  return `<span style="color:${color};">${arrow} ${Math.abs(percent)}%</span>`;
}

function formatNumber(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatPercent(val) {
  return `${(val * 100).toFixed(1)}%`;
}

function renderCharts() {
  const data = analyticsData || getMockData();
  
  // Trends Chart (Line)
  const trendsCtx = document.getElementById('trendsChart').getContext('2d');
  if (charts.trends) charts.trends.destroy();
  charts.trends = new Chart(trendsCtx, {
    type: 'line',
    data: {
      labels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
      datasets: [
        {
          label: 'Success',
          data: data.trends.success,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.3,
          fill: false
        },
        {
          label: 'Total',
          data: data.trends.runs.map(r => r * 0.94),
          borderColor: 'rgb(54, 162, 235)',
          tension: 0.3,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: true, position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });
  
  // Agent Usage Chart (Bar)
  const agentCtx = document.getElementById('agentChart').getContext('2d');
  if (charts.agent) charts.agent.destroy();
  charts.agent = new Chart(agentCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(data.agentUsage),
      datasets: [{
        label: 'Runs',
        data: Object.values(data.agentUsage),
        backgroundColor: 'rgba(54, 162, 235, 0.8)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
  
  // Cost Chart (Pie)
  const costCtx = document.getElementById('costChart').getContext('2d');
  if (charts.cost) charts.cost.destroy();
  charts.cost = new Chart(costCtx, {
    type: 'pie',
    data: {
      labels: Object.keys(data.costByModel),
      datasets: [{
        data: Object.values(data.costByModel),
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { position: 'right' } }
    }
  });
  
  // Latency Chart (Histogram)
  const latencyCtx = document.getElementById('latencyChart').getContext('2d');
  if (charts.latency) charts.latency.destroy();
  charts.latency = new Chart(latencyCtx, {
    type: 'bar',
    data: {
      labels: ['0-50', '50-100', '100-150', '150-200', '200-250', '250-300', '300-350', '350-400', '400-450', '450+'],
      datasets: [{
        label: 'Frequency',
        data: data.latencyDist,
        backgroundColor: 'rgba(153, 102, 255, 0.8)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Count' } } }
    }
  });
}

function renderAgentTable() {
  if (!agentsData.length) {
    agentsData = [
      { name: 'code-gen', runs: 450, success: 0.96, latency: 312, errors: 18, cost: 4.5, health: 'healthy' },
      { name: 'test-runner', runs: 320, success: 0.93, latency: 289, errors: 22, cost: 3.2, health: 'healthy' },
      { name: 'deploy-manager', runs: 180, success: 0.98, latency: 412, errors: 4, cost: 2.8, health: 'healthy' },
      { name: 'debug-assistant', runs: 150, success: 0.89, latency: 543, errors: 17, cost: 1.8, health: 'warning' },
      { name: 'docs-writer', runs: 120, success: 0.91, latency: 234, errors: 11, cost: 0.9, health: 'healthy' },
      { name: 'review-bot', runs: 80, success: 0.94, latency: 387, errors: 5, cost: 0.6, health: 'healthy' }
    ];
  }
  
  renderAgentRows(agentsData);
}

function renderAgentRows(agents) {
  const tbody = document.getElementById('agentTableBody');
  tbody.innerHTML = agents.map(a => {
    const healthColor = a.health === 'healthy' ? 'var(--success)' : a.health === 'warning' ? 'var(--warning)' : 'var(--error)';
    return `
      <tr>
        <td><strong>${a.name}</strong></td>
        <td>${a.runs}</td>
        <td>${formatPercent(a.success)}</td>
        <td>${a.latency}ms</td>
        <td>${a.errors}</td>
        <td>$${a.cost.toFixed(2)}</td>
        <td><span class="health-badge" style="background:${healthColor};">${a.health}</span></td>
        <td><button class="pill small" onclick="viewAgentDetail('${a.name}')">Details</button></td>
      </tr>
    `;
  }).join('');
}

function sortAgents(sortBy) {
  const sorted = [...agentsData].sort((a, b) => {
    if (sortBy === 'runs') return b.runs - a.runs;
    if (sortBy === 'success') return b.success - a.success;
    if (sortBy === 'latency') return a.latency - b.latency;
    if (sortBy === 'errors') return b.errors - a.errors;
    if (sortBy === 'cost') return b.cost - a.cost;
    return 0;
  });
  renderAgentRows(sorted);
}

function filterAgents() {
  const search = document.getElementById('agentSearch').value.toLowerCase();
  const filtered = agentsData.filter(a => a.name.toLowerCase().includes(search));
  renderAgentRows(filtered);
}

function viewAgentDetail(name) {
  alert(`Agent Details: ${name}\n\nDetailed metrics view coming soon!`);
}

function renderHeatmap() {
  const container = document.getElementById('heatmapContainer');
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Generate mock heatmap data
  const data = days.map(() => hours.map(() => Math.floor(Math.random() * 100)));
  
  const maxVal = Math.max(...data.flat());
  
  container.innerHTML = `
    <div class="heatmap">
      <div class="heatmap-y-axis">
        ${days.map(d => `<div class="heatmap-label">${d}</div>`).join('')}
      </div>
      <div class="heatmap-grid">
        ${data.map((row, dayIdx) => `
          <div class="heatmap-row">
            ${row.map((val, hourIdx) => {
              const intensity = val / maxVal;
              const color = `rgba(59, 130, 246, ${intensity})`;
              return `<div class="heatmap-cell" style="background:${color};" title="${days[dayIdx]} ${hourIdx}:00 - ${val} events"></div>`;
            }).join('')}
          </div>
        `).join('')}
      </div>
      <div class="heatmap-x-axis">
        ${[0, 6, 12, 18].map(h => `<div class="heatmap-label">${h}:00</div>`).join('')}
      </div>
    </div>
  `;
}

function renderInsights() {
  const container = document.getElementById('insightsContainer');
  const insights = [
    { type: 'warning', title: 'Increased Error Rate', message: 'debug-assistant error rate up 15% in last 2h. Review recent changes.' },
    { type: 'success', title: 'Cost Optimization Opportunity', message: 'Switching 60% of code-gen calls to DeepSeek could save $150/month.' },
    { type: 'info', title: 'Peak Traffic Detected', message: 'Highest activity at 14:00-16:00. Consider scaling during this window.' },
    { type: 'warning', title: 'Latency Spike', message: 'deploy-manager latency increased 23%. Investigate infrastructure.' }
  ];
  
  container.innerHTML = insights.map(insight => {
    const icon = insight.type === 'success' ? '✅' : insight.type === 'warning' ? '⚠️' : 'ℹ️';
    const color = insight.type === 'success' ? 'var(--success)' : insight.type === 'warning' ? 'var(--warning)' : 'var(--accent)';
    return `
      <div class="insight" style="border-left: 4px solid ${color};">
        <div class="insight-header">
          <span class="insight-icon">${icon}</span>
          <strong>${insight.title}</strong>
        </div>
        <div class="insight-body">${insight.message}</div>
      </div>
    `;
  }).join('');
}

function renderCostTracking() {
  const budget = 500;
  const spend = 312.45;
  const remaining = budget - spend;
  const percent = (spend / budget) * 100;
  
  document.getElementById('budgetSpend').textContent = `$${spend.toFixed(2)}`;
  document.getElementById('budgetRemaining').textContent = `$${remaining.toFixed(2)}`;
  document.getElementById('budgetProgress').style.width = `${percent}%`;
  document.getElementById('budgetProgress').style.background = percent > 80 ? 'var(--error)' : percent > 60 ? 'var(--warning)' : 'var(--success)';
  
  // Cost by model table
  const models = [
    { name: 'Claude 3', tokens: '2.1M', rate: '$0.015/1K', cost: 31.50, percent: 10.1 },
    { name: 'GPT-4', tokens: '1.8M', rate: '$0.03/1K', cost: 54.00, percent: 17.3 },
    { name: 'DeepSeek', tokens: '5.2M', rate: '$0.002/1K', cost: 10.40, percent: 3.3 },
    { name: 'Claude Haiku', tokens: '15.3M', rate: '$0.00025/1K', cost: 3.83, percent: 1.2 }
  ];
  
  const tbody = document.getElementById('costTableBody');
  tbody.innerHTML = models.map(m => `
    <tr>
      <td><strong>${m.name}</strong></td>
      <td>${m.tokens}</td>
      <td>${m.rate}</td>
      <td>$${m.cost.toFixed(2)}</td>
      <td>${m.percent}%</td>
    </tr>
  `).join('');
  
  // Recommendations
  const recommendations = [
    '💡 Switch non-critical tasks to DeepSeek for 40% cost reduction',
    '💡 Batch similar requests to reduce API calls by 15%',
    '💡 Cache frequent prompts to save $45/month'
  ];
  
  document.getElementById('costRecommendations').innerHTML = `
    <h4 style="margin-top: 1.5rem;">Recommendations</h4>
    ${recommendations.map(r => `<div class="recommendation">${r}</div>`).join('')}
  `;
}

async function refreshAnalytics() {
  const window = document.getElementById('timeRange').value;
  await loadAnalytics(window);
  renderKPIs();
  renderCharts();
  renderAgentTable();
  renderHeatmap();
  renderInsights();
  renderCostTracking();
  showToast('Analytics refreshed', 'success');
}

function refreshInsights() {
  renderInsights();
  showToast('Insights regenerated', 'success');
}

function exportReport() {
  const report = {
    timestamp: new Date().toISOString(),
    kpis: analyticsData || getMockData(),
    agents: agentsData
  };
  
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analytics-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Report exported', 'success');
}

function showToast(msg, type = 'info') {
  if (window.toast) {
    window.toast(msg, type);
  } else {
    console.log(`[${type}] ${msg}`);
  }
}
