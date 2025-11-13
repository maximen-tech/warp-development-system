# Platform Architecture

## Vision: Meta-Platform for Multi-Project Development

Warp is transforming from a single-project dashboard into a **meta-platform** - a core development hub for creating, managing, and optimizing multiple software projects. Each project operates in complete isolation with its own repository, configuration, and tooling, while sharing the powerful Warp ecosystem.

## Architecture Overview

```
Warp Platform
├── Core Dashboard (hub)
│   ├── Project Selector (context switching)
│   ├── Agents Management (per-project)
│   ├── Terminal (scoped to active project)
│   ├── Analytics (project-filtered)
│   └── Prompts Library (project-specific)
│
├── Projects Hub
│   ├── Grid View (search/filter/sort)
│   ├── Create Workflow (scaffold from templates)
│   ├── Import Workflow (clone + analyze + optimize)
│   └── Project Cards (status, optimization, stats)
│
├── Project Database (projects.json)
│   └── { id, name, path, status, tech_stack, config, stats, optimization_level }
│
└── Per-Project Isolation
    ├── .warp/agents.yml (3-5 agents, auto-generated)
    ├── .warp/skills.yml (2-5 skills, stack-specific)
    ├── .warp/approval-defaults.yml (automation rules)
    └── Independent git repository
```

## Core Components

### 1. Projects Database (`runtime/projects.json`)

Schema:
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "project-name",
      "path": "/absolute/path/to/project",
      "status": "active|archived|error",
      "tech_stack": ["Node.js", "React", "TypeScript"],
      "created_at": "ISO8601",
      "last_accessed": "ISO8601",
      "optimization_level": 85,
      "config": {
        "agents_count": 3,
        "skills_count": 2,
        "has_ci": true,
        "has_tests": true
      },
      "stats": {
        "loc": 15000,
        "files": 120,
        "last_commit": "ISO8601"
      }
    }
  ]
}
```

### 2. Workflows

#### **Create Project** (<10s)
1. User selects template (Next.js, Express, Python, Blank)
2. Scaffolder generates project structure + package.json/requirements.txt
3. Auto-generate `.warp/` configuration (3 agents, 2-3 skills)
4. Run `npm install` / `pip install`
5. Initialize git repository
6. Add entry to `projects.json`
7. Redirect to Projects Hub

#### **Import Project** (<15s)
1. User provides git URL or local path
2. Clone repository (if URL) or validate path
3. **Analyzer** detects tech stack (package.json, requirements.txt, go.mod, etc.)
4. Count LOC, files, detect patterns (tests, CI, linting, TypeScript)
5. **Optimizer** auto-generates `.warp/` config based on analysis
6. Calculate optimization score (40-100%):
   - Base: 40
   - Tests: +20
   - Linting: +15
   - CI/CD: +10
   - Type safety: +10
   - Documentation: +5
7. Add to `projects.json`
8. Redirect to Projects Hub

#### **Context Switching** (<500ms)
1. User selects project from dropdown
2. Update `localStorage.active_project_id`
3. Reload tools scoped to new project:
   - Agents: load from `<project>/.warp/agents.yml`
   - Terminal: set cwd to `project.path`
   - Analytics: filter events by `project_id`
   - Prompts: load from `<project>/.warp/prompts.json`
4. Display toast notification

## API Endpoints

### Projects CRUD
- `GET /api/projects` - List all projects (with search/filter/sort)
- `GET /api/projects/:id` - Get single project (updates last_accessed)
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Workflows
- `GET /api/projects/templates` - List available templates
- `POST /api/projects/create` - Scaffold new project
  - Body: `{ name, template }`
  - Returns: `{ success, project }`
- `POST /api/projects/import` - Import existing project
  - Body: `{ source, type: 'url'|'path' }`
  - Returns: `{ success, project }`
- `GET /api/projects/:id/health` - Run health checks
- `PUT /api/projects/:id/optimize` - Re-run optimization

## Optimization Engine

### Analyzer (`lib/analyzer.js`)
- **Stack Detection**: Identifies Node.js, Python, Go, Rust, React, Next.js, Express, FastAPI, etc.
- **LOC Counting**: Recursively counts lines of code (ignores node_modules, .git, dist)
- **Pattern Detection**: Detects src-structure, API patterns, linting, TypeScript, Docker
- **Health Checks**: 8 checks (README, .gitignore, tests, CI, lint, types, docs, security)

### Optimizer (`lib/optimizer.js`)
- **Agents Generation**: Creates 3-5 agents based on project complexity
  - Planner (o3-mini): Architecture and planning
  - Coder (Claude): Implementation
  - Reviewer (Claude): Quality checks
  - DevOps (conditional): If LOC >10k or dockerized
  - API Specialist (conditional): If API patterns detected
- **Skills Generation**: Creates 2-5 skills based on stack
  - Test runner: `npm test`, `pytest`, `go test`
  - Linter: `npm run lint`, `ruff check`
  - Type checker: `tsc --noEmit`, `mypy`
  - Build: `npm run build`
  - Security: `npm audit`
- **Approval Defaults**: Generates automation rules based on test/lint status

### Scaffolder (`lib/scaffolder.js`)
- **Templates**: Next.js (TypeScript + Tailwind), Express, Python FastAPI, Blank
- **File Generation**: package.json, tsconfig.json, .gitignore, README, src files
- **Post-Create Hooks**: Runs `npm install` for Node.js projects
- **Warp Config**: Auto-generates `.warp/agents.yml` and `.warp/skills.yml`

## Tool Isolation

Each project maintains complete isolation:

1. **Agents**: Loaded from `<project>/.warp/agents.yml`
2. **Skills**: Loaded from `<project>/.warp/skills.yml`
3. **Terminal**: Working directory set to `project.path`
4. **Analytics**: Events filtered by `project_id` field
5. **Prompts**: Stored in `<project>/.warp/prompts.json`
6. **Git**: Independent repository per project
7. **Dependencies**: Separate `node_modules`, `venv`, etc.

## Performance

- **Create Project**: <10s (including npm install)
- **Import Project**: <15s (including clone + analysis)
- **Context Switch**: <500ms (lazy-load on dropdown change)
- **Projects Hub**: <2s load time
- **Optimization Score**: <3s calculation

## Backwards Compatibility

All existing features remain unchanged:
- Dashboard timeline/KPIs/approvals work identically
- Notifications, marketplace, collaboration unaffected
- Terminal, agents, prompts enhanced with project scoping
- Zero breaking changes to existing APIs

## Future Enhancements

- **Project Templates Marketplace**: Share custom templates
- **Team Collaboration**: Multi-user project access
- **CI/CD Integration**: GitHub Actions, GitLab CI triggers
- **Analytics Dashboards**: Per-project metrics and trends
- **AI Optimization Suggestions**: Auto-detect improvement opportunities
- **Cloud Deployment**: One-click deploy to Vercel, Railway, etc.

## Technology Stack

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JS, CSS (zero dependencies)
- **Database**: JSON files (projects.json, agents.yml, skills.yml)
- **Analysis**: fs.promises, regex, execSync for git commands
- **Templating**: String interpolation (no complex AST parsing)