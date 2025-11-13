// Optimizer - Generate optimal .warp configuration
import fs from 'fs/promises';
import path from 'path';

export async function optimizeProject(projectPath, analysis) {
  const warpPath = path.join(projectPath, '.warp');
  
  // Create .warp directory if not exists
  try {
    await fs.mkdir(warpPath, { recursive: true });
  } catch {}

  // Generate agents.yml
  const agentsConfig = generateAgentsConfig(analysis);
  await fs.writeFile(path.join(warpPath, 'agents.yml'), agentsConfig);

  // Generate skills.yml
  const skillsConfig = generateSkillsConfig(analysis);
  await fs.writeFile(path.join(warpPath, 'skills.yml'), skillsConfig);

  // Generate approval-defaults.yml
  const approvalConfig = generateApprovalConfig(analysis);
  await fs.writeFile(path.join(warpPath, 'approval-defaults.yml'), approvalConfig);

  // Count generated configs
  const agentsCount = (agentsConfig.match(/- id:/g) || []).length;
  const skillsCount = (skillsConfig.match(/- id:/g) || []).length;

  // Calculate optimization score
  const optimizationScore = calculateOptimizationScore(analysis);

  return {
    agents_count: agentsCount,
    skills_count: skillsCount,
    has_ci: analysis.config.has_ci,
    has_tests: analysis.config.has_tests,
    optimization_level: optimizationScore
  };
}

function generateAgentsConfig(analysis) {
  const { stack, patterns, stats } = analysis;
  
  let agents = `# Auto-generated agents configuration
# Optimized for: ${stack.join(', ')}

agents:
  - id: planner
    name: Solution Architect
    model: o3-mini
    role: architect
    expertise: [system-design, architecture, planning, ${stack[0]?.toLowerCase()}]
    instructions: |
      Analyze requirements and design optimal solutions.
      Create detailed implementation plans with milestones.
      Consider scalability, maintainability, and best practices.
      Tech stack: ${stack.join(', ')}

  - id: coder
    name: Senior Engineer
    model: claude-sonnet-4
    role: implementer
    expertise: [${getCodeExpertise(stack).join(', ')}]
    instructions: |
      Implement features following best practices for ${stack.join(', ')}.
      Write clean, maintainable, well-documented code.
      Include proper error handling and edge cases.
      ${patterns.includes('typed') ? 'Use TypeScript with strict types.' : ''}
      ${patterns.includes('linted') ? 'Follow linter rules and code standards.' : ''}

  - id: reviewer
    name: Code Reviewer
    model: claude-sonnet-4
    role: quality
    expertise: [code-review, ${stack[0]?.toLowerCase()}, testing, security]
    instructions: |
      Review code for correctness, performance, and security.
      Check for bugs, anti-patterns, and potential issues.
      Ensure tests cover critical paths.
      Verify adherence to project standards.
`;

  // Add specialized agents based on project size/complexity
  if (stats.loc > 10000 || patterns.includes('dockerized')) {
    agents += `
  - id: devops
    name: DevOps Engineer
    model: claude-sonnet-4
    role: operations
    expertise: [docker, ci-cd, deployment, monitoring]
    instructions: |
      Optimize build and deployment processes.
      Ensure proper containerization and orchestration.
      Monitor performance and system health.
      ${analysis.config.has_ci ? 'Maintain CI/CD pipelines.' : 'Consider implementing CI/CD.'}
`;
  }

  if (patterns.includes('api-structure') || stack.includes('FastAPI') || stack.includes('Express')) {
    agents += `
  - id: api-specialist
    name: API Architect
    model: claude-sonnet-4
    role: specialist
    expertise: [api-design, rest, graphql, authentication]
    instructions: |
      Design and review API endpoints for consistency.
      Ensure proper error handling and validation.
      Implement authentication and authorization correctly.
      Document APIs with OpenAPI/Swagger specs.
`;
  }

  return agents;
}

function generateSkillsConfig(analysis) {
  const { stack, patterns, config } = analysis;
  
  let skills = `# Auto-generated skills configuration
# Project: ${analysis.path}

skills:
`;

  // Test runner
  if (config.has_tests) {
    if (stack.includes('Node.js')) {
      skills += `  - id: test-runner
    name: Run Tests
    command: npm test
    triggers: [after-code-change, before-commit]
    timeout: 60s

`;
    } else if (stack.includes('Python')) {
      skills += `  - id: test-runner
    name: Run Tests
    command: pytest
    triggers: [after-code-change, before-commit]
    timeout: 60s

`;
    } else if (stack.includes('Go')) {
      skills += `  - id: test-runner
    name: Run Tests
    command: go test ./...
    triggers: [after-code-change, before-commit]
    timeout: 60s

`;
    }
  }

  // Linter
  if (patterns.includes('linted')) {
    if (stack.includes('Node.js')) {
      skills += `  - id: linter
    name: Lint Code
    command: npm run lint
    triggers: [before-commit]
    timeout: 30s

`;
    } else if (stack.includes('Python')) {
      skills += `  - id: linter
    name: Lint Code
    command: ruff check .
    triggers: [before-commit]
    timeout: 30s

`;
    }
  }

  // Type checker
  if (patterns.includes('typed')) {
    skills += `  - id: type-check
    name: Type Check
    command: ${stack.includes('TypeScript') ? 'tsc --noEmit' : 'mypy .'}
    triggers: [before-commit]
    timeout: 30s

`;
  }

  // Build
  if (stack.includes('Node.js')) {
    skills += `  - id: build
    name: Build Project
    command: npm run build
    triggers: [before-deploy]
    timeout: 120s

`;
  }

  // Security scan
  if (stack.includes('Node.js')) {
    skills += `  - id: security-scan
    name: Security Audit
    command: npm audit
    triggers: [weekly]
    timeout: 60s

`;
  }

  return skills;
}

function generateApprovalConfig(analysis) {
  const { patterns, stats, config } = analysis;
  
  // More automated for well-tested/linted projects
  const automationLevel = config.has_tests && patterns.includes('linted') ? 'high' : 'medium';
  
  return `# Auto-generated approval defaults
# Automation level: ${automationLevel}

defaults:
  # Auto-approve low-risk changes
  auto_approve:
    - pattern: "*.md"
      reason: "Documentation updates"
    
    - pattern: "*.test.*"
      condition: "tests_pass"
      reason: "Test file changes when tests pass"
    
    ${patterns.includes('linted') ? `- pattern: "*.{js,ts,py}"
      condition: "lint_pass && tests_pass"
      reason: "Code changes when quality checks pass"` : ''}

  # Always require approval
  manual_approve:
    - pattern: "*.yml"
      reason: "Configuration changes"
    
    - pattern: "Dockerfile"
      reason: "Container configuration"
    
    - pattern: "package.json"
      reason: "Dependency changes"
    
    ${config.has_ci ? `- pattern: ".github/**"
      reason: "CI/CD pipeline changes"` : ''}

  # Notifications
  notifications:
    slack: false
    email: false
    console: true
`;
}

function calculateOptimizationScore(analysis) {
  let score = 40; // Base score
  
  // Tests (+20)
  if (analysis.config.has_tests) score += 20;
  
  // Linting (+15)
  if (analysis.patterns.includes('linted')) score += 15;
  
  // CI/CD (+10)
  if (analysis.config.has_ci) score += 10;
  
  // Type safety (+10)
  if (analysis.patterns.includes('typed')) score += 10;
  
  // Documentation (+5)
  if (analysis.patterns.includes('src-structure')) score += 5;
  
  return Math.min(score, 100);
}

function getCodeExpertise(stack) {
  const expertise = [];
  
  if (stack.includes('Node.js')) expertise.push('javascript', 'node');
  if (stack.includes('TypeScript')) expertise.push('typescript');
  if (stack.includes('React')) expertise.push('react', 'jsx');
  if (stack.includes('Next.js')) expertise.push('nextjs', 'ssr');
  if (stack.includes('Express')) expertise.push('express', 'rest-api');
  if (stack.includes('Python')) expertise.push('python');
  if (stack.includes('FastAPI')) expertise.push('fastapi', 'async');
  if (stack.includes('Django')) expertise.push('django', 'orm');
  if (stack.includes('Go')) expertise.push('go', 'concurrency');
  
  expertise.push('testing', 'debugging', 'refactoring');
  
  return expertise;
}