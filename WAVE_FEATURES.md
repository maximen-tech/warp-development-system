# Wave 2 Feature Specifications

## 1. Import Wizard Enhancements

### Cell-level validation & error highlighting
- Per-cell validation results in table rows (red background on errors)
- Error hints inline (e.g., "Name must be unique" or "Referenced skill not found")
- Live feedback as user edits/selects rows
- Auto-fix suggestions (e.g., propose `agent_copy` for duplicates)

### Batch undo & export fixes
- Track import batch ID (UUID) in S.importBatch
- Store pre-import state via rollback-group snapshot
- "Undo this batch" single-click button post-import
- "Export corrected file" to download CSV/JSON with fixes applied

**Implementation:**
- Enhance validateSel() to return per-cell error map
- Render table cells with data-errors, class="err-cell" for visual marking
- Add auto-fix hints in per-cell div.err-hint
- Track import session ID; POST /api/agents/import-audit on completion
- Add "Undo batch" button in success message

**Files:** `agents.html` (import modal section + helpers)

---

## 2. Approvals Pyramid UX

### Drag graphical pyramid
- Make pyramid interactive (onClick + drag to set autonomy 0-3)
- Visual feedback: highlight active level, show tooltip "autonomy N"
- Smooth transition when slider/pyramid synced

### History & summary
- Show 5 recent autonomy changes (timestamp, old→new, reason)
- "Policy changed from Safe to Balanced" summary badges
- Display current policy label (Safe/Balanced/Autonomous/Custom)

### Undo/redo logic & feedback
- Track autonomy changes as separate undo/redo stack (within agent edit session)
- Ctrl+Z/Y increments slider, highlights change (green flash)
- Visual indicator "unsaved autonomy change" when diff from loaded state

**Implementation:**
- Make pyramid draggable (mousedown on pyramid, calc Y offset → autonomy level)
- Add S.approvalHistory = [] tracking autonomy edits with timestamp
- Hook slider.oninput to record change in history
- Add visual highlight on slider/pyramid when changed
- Add Ctrl+Z/Y listener for approval-specific undo in edit modal

**Files:** `agents.html` (editor modal approvals section)

---

## 3. Inline Docs Everywhere

### FAQ/help modal & field tooltips
- "Help?" button in header → modal with FAQ sections (collapsible)
  - Q: "What's autonomy?" A: "Level 0-3 controls approval workflows..."
  - Q: "How to attach skills?" A: "Multi-select skills in editor..."
  - Q: "What's a policy preset?" A: "Safe/Balanced/Autonomous presets configure guardrails..."
- Add title="..." attributes to all form fields (hover tooltips)
- Deep-link FAQ sections to README anchors (e.g., "Learn more → #approvals-policies")

### Show-as-code toggle & onboarding
- Toggle in editor modal: "Show as YAML" / "Show as JSON"
- Live YAML/JSON export of current form state displayed in collapsible pane
- First-visit banner: "Welcome! Click Help for guides" (localStorage dismissed)
- Inline onboarding hints on role/model/skills fields (first 3 edits only)

**Implementation:**
- Create helpModal with collapsible sections (FAQs)
- Add kvField helper wrapper to inject title attrs
- Add "Show-as-code" toggle in editorModal footer
- Parse editObj → YAML via simple conversion (name: ..., role: ..., etc.)
- Add S.firstVisit flag, show banner if true, dismiss on click
- Track field edit count in S.onboardingHints

**Files:** `agents.html` (modals, helpers), `styles.css` (modal collapsible styles)

---

## 4. Marketplace Safety

### Subset preview & compatibility checker
- Enhanced marketModal preview:
  - Compatibility matrix: shows conflicts (e.g., "Requires agent-base skill")
  - Version check: "This skill requires model v1.5+" (parse from metadata)
  - Safe-merge explainer: "We'll merge skill definitions without overwriting existing agents"
- Color-code skills (green=safe, yellow=warning, red=blocked)
- Show aggregate warnings count before import

### Rollback batch & audit logs
- POST /api/marketplace/import-audit { batchId, skills, timestamp, userId, status }
- Store audit in runtime/marketplace_audit.jsonl
- "Undo import" button post-import, calls rollback-group with batch ID
- Audit panel in Marketplace showing last 10 imports (status: ok/rolled-back)

**Implementation:**
- Enhance marketPreview to fetch skill metadata (versioning, deps)
- Add compatibility checks: validate agent refs, model version reqs
- Color-code rows: class="warning" / class="blocked"
- Generate batchId (Date.now() + random), pass to import API
- Add marketAudit array to S, render history in marketplace modal
- Add rollback button in success state

**Files:** `agents.html` (marketplace modal), `server.js` (POST /api/marketplace/import-audit)

---

## 5. Live Optimizations

### Push notifications (SSE)
- Extend /agents-changes SSE to include agent-specific notifications
- Browser Notification API: "Agent executor-1 now has 3 errors" (if auto-expand off)
- Opt-in via toggle "Desktop notifications for errors"

### Voice command (Web Speech API)
- Mic button in top toolbar (active when focused)
- Recognize: "sort by errors", "show agent planner", "help"
- Fallback to search/sort, or route to FAQ

### Real-time error watch
- Background check every 2s (not just 5s) when auto-expand on error disabled
- SSE event "error_spike" triggers breadcrumb + auto-expand (if disabled, show banner)
- Show "X errors detected" badge in header

### Agent auto-recovery proposals
- On error detected: fetch /api/agents/suggest-recovery?agent=NAME
- Show inline suggestion: "Try restarting executor-1" or "Check guardrail: memory limit"
- "Apply fix" button triggers action (e.g., POST /api/agents/recover)

**Implementation:**
- Hook Notification API on error_spike events
- Add SpeechRecognition listener in header (toggle mic icon)
- Route commands to existing actions (sort, search, navigate FAQ)
- Reduce refresh interval when critical
- Add suggest-recovery stub endpoint
- Show suggestions in details drawer

**Files:** `agents.html`, `server.js`, `app.js`

---

## Delivery Schedule

### Batch 1 (Commit 1): Import wizard + Approvals pyramid
- Focus: highest UX friction reduction (import errors are costly, autonomy changes need clear feedback)
- Expected: 2-3h implementation + test

### Batch 2 (Commit 2): Inline docs + Marketplace safety
- Focus: discovery + trust (new users need guidance, marketplaceimports need governance)
- Expected: 2-3h

### Batch 3 (Commit 3): Live optimizations
- Focus: background intelligence (real-time errors, auto-recovery)
- Estimate: 1-2h for MVP (notifications + error watch; voice/recovery = nice-to-have)

### All commits
- Update README with feature descriptions + UX impacts + productivity metrics
- Add screenshots (before/after) for major UX changes
- Link to autodocs in code comments

---

## Productivity Impact Estimates

| Feature | Friction Reduced | Time Saved Per Task | Compounding Gain |
|---------|-----------------|---------------------|-----------------|
| Import validation | File re-uploads on error | 2-5 min/import | 10+ imports/sprint → 100+ min/sprint |
| Autonomy tracking | Manual note-taking | 1 min/change | 5+ changes/sprint → 5+ min/sprint |
| Inline docs | Wiki navigation | 3 min/question | 10+ questions/sprint → 30+ min/sprint |
| Marketplace safety | Broken imports, manual fixes | 5 min/import | 2-3 broken/sprint → 10-15 min/sprint |
| Error watch + recovery | Manual log tailing | 5 min/incident | 3-5 incidents/sprint → 15-25 min/sprint |
| **Total per sprint** | | | **160-185 min saved** |
| **Per year** | | | **~13 hours saved** |

Full Elon mode: cut friction, compound velocity. 🚀

---

## Extension Hooks

Future enhancements (marked as TODO):
- `validateCell(kind, field, value, context)` → plugin system for custom validators
- `recoverAgent(name, errorType)` → strategy pattern for recovery actions
- `marketplaceCompatibility(skill, agents)` → extensible conflict detection
- `approvalPolicyHistory(agent)` → audit trail integration
