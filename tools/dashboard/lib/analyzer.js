// Analyzer - Codebase analysis and intelligence
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'venv', '__pycache__', 'target', 'vendor']);
const CODE_EXTENSIONS = new Set(['.js', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.cs']);

export async function analyzeCodebase(projectPath) {
  const analysis = {
    path: projectPath,
    stack: [],
    stats: { loc: 0, files: 0, dirs: 0 },
    config: { agents_count: 0, skills_count: 0, has_ci: false, has_tests: false },
    dependencies: [],
    patterns: [],
    health: { score: 0, checks: [] }
  };

  try {
    // Detect stack
    analysis.stack = await detectStack(projectPath);

    // Count LOC and files
    const stats = await countLOC(projectPath);
    analysis.stats = stats;

    // Check for tests
    analysis.config.has_tests = await hasTests(projectPath);

    // Check for CI
    analysis.config.has_ci = await hasCI(projectPath);

    // Parse dependencies
    analysis.dependencies = await parseDependencies(projectPath, analysis.stack);

    // Detect patterns
    analysis.patterns = await detectPatterns(projectPath, analysis.stack);

    // Check for existing .warp config
    const warpPath = path.join(projectPath, '.warp');
    try {
      await fs.access(warpPath);
      const agentsFile = path.join(warpPath, 'agents.yml');
      const skillsFile = path.join(warpPath, 'skills.yml');
      
      try {
        const agents = await fs.readFile(agentsFile, 'utf-8');
        analysis.config.agents_count = (agents.match(/- id:/g) || []).length;
      } catch {}
      
      try {
        const skills = await fs.readFile(skillsFile, 'utf-8');
        analysis.config.skills_count = (skills.match(/- id:/g) || []).length;
      } catch {}
    } catch {
      // No .warp directory
    }

    // Health checks
    analysis.health = await runHealthChecks(projectPath, analysis);

    // Get last commit
    try {
      const lastCommit = execSync('git log -1 --format=%at', { cwd: projectPath, encoding: 'utf-8' }).trim();
      analysis.stats.last_commit = new Date(parseInt(lastCommit) * 1000).toISOString();
    } catch {}

  } catch (e) {
    console.error('Analysis error:', e);
    analysis.error = e.message;
  }

  return analysis;
}

async function detectStack(projectPath) {
  const stack = [];

  // Node.js
  if (await fileExists(path.join(projectPath, 'package.json'))) {
    stack.push('Node.js');
    const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
    if (pkg.dependencies?.react || pkg.devDependencies?.react) stack.push('React');
    if (pkg.dependencies?.next || pkg.devDependencies?.next) stack.push('Next.js');
    if (pkg.dependencies?.express) stack.push('Express');
    if (pkg.dependencies?.vue || pkg.devDependencies?.vue) stack.push('Vue');
    if (await fileExists(path.join(projectPath, 'tsconfig.json'))) stack.push('TypeScript');
    else stack.push('JavaScript');
  }

  // Python
  if (await fileExists(path.join(projectPath, 'requirements.txt')) || 
      await fileExists(path.join(projectPath, 'pyproject.toml'))) {
    stack.push('Python');
    try {
      const reqs = await fs.readFile(path.join(projectPath, 'requirements.txt'), 'utf-8');
      if (reqs.includes('fastapi')) stack.push('FastAPI');
      if (reqs.includes('django')) stack.push('Django');
      if (reqs.includes('flask')) stack.push('Flask');
    } catch {}
  }

  // Go
  if (await fileExists(path.join(projectPath, 'go.mod'))) {
    stack.push('Go');
  }

  // Rust
  if (await fileExists(path.join(projectPath, 'Cargo.toml'))) {
    stack.push('Rust');
  }

  return stack.length > 0 ? stack : ['Unknown'];
}

async function countLOC(projectPath, dir = projectPath) {
  let loc = 0;
  let files = 0;
  let dirs = 0;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        dirs++;
        const subStats = await countLOC(projectPath, fullPath);
        loc += subStats.loc;
        files += subStats.files;
        dirs += subStats.dirs;
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (CODE_EXTENSIONS.has(ext)) {
          files++;
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            loc += content.split('\n').length;
          } catch {}
        }
      }
    }
  } catch (e) {
    console.error('LOC count error:', e.message);
  }

  return { loc, files, dirs };
}

async function hasTests(projectPath) {
  // Check for test files/directories
  const testPatterns = ['test', 'tests', '__tests__', 'spec', '*.test.js', '*.spec.js', 'test_*.py'];
  
  try {
    const entries = await fs.readdir(projectPath);
    for (const entry of entries) {
      if (testPatterns.some(p => entry.includes(p) || entry.match(p))) return true;
    }
  } catch {}

  // Check package.json for test script
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
    if (pkg.scripts?.test && !pkg.scripts.test.includes('no test specified')) return true;
  } catch {}

  return false;
}

async function hasCI(projectPath) {
  const ciFiles = [
    '.github/workflows',
    '.gitlab-ci.yml',
    '.circleci',
    'jenkins',
    'azure-pipelines.yml',
    '.travis.yml'
  ];

  for (const file of ciFiles) {
    if (await fileExists(path.join(projectPath, file))) return true;
  }

  return false;
}

async function parseDependencies(projectPath, stack) {
  const deps = [];

  // Node.js
  if (stack.includes('Node.js')) {
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name, version] of Object.entries(allDeps || {})) {
        deps.push({ name, version, type: 'npm' });
      }
    } catch {}
  }

  // Python
  if (stack.includes('Python')) {
    try {
      const reqs = await fs.readFile(path.join(projectPath, 'requirements.txt'), 'utf-8');
      reqs.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          const [name, version] = line.split(/[=><!]/);
          deps.push({ name: name.trim(), version: version?.trim() || '*', type: 'pip' });
        }
      });
    } catch {}
  }

  return deps.slice(0, 20); // Top 20
}

async function detectPatterns(projectPath, stack) {
  const patterns = [];

  // Check for common directories
  if (await fileExists(path.join(projectPath, 'src'))) patterns.push('src-structure');
  if (await fileExists(path.join(projectPath, 'app'))) patterns.push('app-structure');
  if (await fileExists(path.join(projectPath, 'api'))) patterns.push('api-structure');
  if (await fileExists(path.join(projectPath, 'components'))) patterns.push('component-based');
  if (await fileExists(path.join(projectPath, 'routes'))) patterns.push('route-based');

  // Check for config files
  if (await fileExists(path.join(projectPath, 'eslint'))) patterns.push('linted');
  if (await fileExists(path.join(projectPath, 'prettier'))) patterns.push('formatted');
  if (await fileExists(path.join(projectPath, 'tsconfig.json'))) patterns.push('typed');
  if (await fileExists(path.join(projectPath, 'docker-compose.yml'))) patterns.push('dockerized');
  if (await fileExists(path.join(projectPath, 'Dockerfile'))) patterns.push('containerized');

  return patterns;
}

async function runHealthChecks(projectPath, analysis) {
  const checks = [];
  let score = 0;
  const maxScore = 100;

  // Basic structure (20 points)
  if (await fileExists(path.join(projectPath, 'README.md'))) {
    checks.push({ name: 'README exists', status: 'pass', points: 10 });
    score += 10;
  } else {
    checks.push({ name: 'README exists', status: 'fail', points: 0 });
  }

  if (await fileExists(path.join(projectPath, '.gitignore'))) {
    checks.push({ name: '.gitignore exists', status: 'pass', points: 10 });
    score += 10;
  } else {
    checks.push({ name: '.gitignore exists', status: 'fail', points: 0 });
  }

  // Tests (20 points)
  if (analysis.config.has_tests) {
    checks.push({ name: 'Tests present', status: 'pass', points: 20 });
    score += 20;
  } else {
    checks.push({ name: 'Tests present', status: 'fail', points: 0 });
  }

  // CI/CD (15 points)
  if (analysis.config.has_ci) {
    checks.push({ name: 'CI/CD configured', status: 'pass', points: 15 });
    score += 15;
  } else {
    checks.push({ name: 'CI/CD configured', status: 'fail', points: 0 });
  }

  // Linting (15 points)
  if (analysis.patterns.includes('linted')) {
    checks.push({ name: 'Linter configured', status: 'pass', points: 15 });
    score += 15;
  } else {
    checks.push({ name: 'Linter configured', status: 'fail', points: 0 });
  }

  // Type safety (10 points)
  if (analysis.patterns.includes('typed')) {
    checks.push({ name: 'Type checking', status: 'pass', points: 10 });
    score += 10;
  } else {
    checks.push({ name: 'Type checking', status: 'fail', points: 0 });
  }

  // Documentation (10 points)
  if (await fileExists(path.join(projectPath, 'docs'))) {
    checks.push({ name: 'Documentation', status: 'pass', points: 10 });
    score += 10;
  } else {
    checks.push({ name: 'Documentation', status: 'warn', points: 0 });
  }

  // Security (10 points)
  const hasSecurityConfig = await fileExists(path.join(projectPath, '.snyk')) ||
                            await fileExists(path.join(projectPath, 'security'));
  if (hasSecurityConfig) {
    checks.push({ name: 'Security scanning', status: 'pass', points: 10 });
    score += 10;
  } else {
    checks.push({ name: 'Security scanning', status: 'warn', points: 0 });
  }

  return { score: Math.round((score / maxScore) * 100), checks };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export { detectStack, countLOC, hasTests, hasCI };