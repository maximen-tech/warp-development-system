# Bugs Found - Agents & Skills Pro-Grade UI Audit

## CRITICAL BUGS (Broken Functionality)

### BUG #1: Agent Cards - Copy/Export buttons completely missing
**Severity**: CRITICAL  
**Location**: agents.html lines 326-332  
**Issue**: Refactored agent cards only have 5 buttons (Details/Edit/Test/Connect/Delete) but old functionality for Copy JSON/Copy YAML/Export is completely lost. No handlers attached.  
**Impact**: Users cannot copy or export individual agents anymore.  
**Fix**: Add dropdown menu or additional buttons for Copy JSON/YAML/Export.

### BUG #2: Skills Cards - Copy YAML button missing
**Severity**: HIGH  
**Location**: agents.html lines 370-375, 379  
**Issue**: Handler for `data-act="copyyaml"` exists (line 379) but button is not in HTML. Only Copy JSON/Export/Edit/Delete buttons exist.  
**Impact**: Users cannot copy skill as YAML (only JSON).  
**Fix**: Either remove handler or add button (decision: remove handler as Copy JSON + Export covers use case).

### BUG #3: Toolbar - 4 buttons completely missing from new UI
**Severity**: CRITICAL  
**Location**: agents.html lines 46-89 vs 29-33  
**Issue**: New toolbar removed these buttons:
- `#reloadAgents` (handler line 655) - reload agents from backend
- `#exportAgents` (handler line 662) - export all agents
- `#changelogBtn` (handler line 657) - view changelog
- `#marketBtn` (handler line 519+) - import skills by URL  
**Impact**: Major features inaccessible, handlers orphaned.  
**Fix**: Add all 4 buttons back to toolbar with proper styling.

## HIGH SEVERITY BUGS (UX Degraded)

### BUG #4: testAgent() uses native window.prompt()
**Severity**: HIGH  
**Location**: agents.html line 631  
**Issue**: `window.prompt('Test prompt', 'Hello')` is native browser dialog, blocks UI, amateur aesthetic, inconsistent with pro design.  
**Impact**: Breaks immersion, poor UX, not mobile-friendly.  
**Fix**: Replace with modal containing styled input + Submit/Cancel buttons.

### BUG #5: confirm() and alert() used throughout
**Severity**: HIGH  
**Location**: Lines 625 (deleteAgent), 626 (deleteSkill), 382 (skill delete check), 606 (validation error), 609 (save failed), 631 (test trigger), 655 (reload), 656 (history)  
**Issue**: Native `confirm()` and `alert()` dialogs are amateur, not styled, break design system.  
**Impact**: Inconsistent UX, poor mobile experience, amateur feel.  
**Fix**: Replace all with custom modals or toast notifications.

### BUG #6: Connectors modal - Badge state not reset on open
**Severity**: MEDIUM  
**Location**: agents.html lines 510-537  
**Issue**: When `openConnectors()` is called, tile/status classes are added but never reset first. If user opens modal multiple times, classes accumulate incorrectly.  
**Impact**: Badge states can be wrong if modal opened twice.  
**Fix**: Reset all tile/status classes before applying new state.

### BUG #7: Connectors Test button - No loading state
**Severity**: MEDIUM  
**Location**: agents.html line 539  
**Issue**: `#connTest` button doesn't show loading spinner or disable during async fetch. User can double-click and trigger multiple requests.  
**Impact**: Confusing UX, potential duplicate requests, no visual feedback during wait.  
**Fix**: Add spinner, disable button during async operation.

### BUG #8: openConnectors() mutates agent object directly
**Severity**: MEDIUM  
**Location**: agents.html line 570  
**Issue**: `agent.connectors = {...}` mutates the passed agent object directly instead of working on a copy. If user clicks X to cancel, changes persist in memory even though not saved to backend.  
**Impact**: Unexpected behavior, dirty state on cancel.  
**Fix**: Work on a copy, only mutate original on explicit Save.

## MEDIUM SEVERITY BUGS (Consistency/Polish)

### BUG #9: Connector modal uses inline onclick strings
**Severity**: LOW  
**Location**: agents.html lines 160, 197  
**Issue**: `onclick="closeModal('#connModal')"` uses inline string instead of proper event handler attachment. Works but inconsistent pattern.  
**Impact**: Inconsistent code style, harder to maintain.  
**Fix**: Attach handler via `addEventListener` or keep for simplicity (decision: keep for simplicity).

### BUG #10: No keyboard shortcuts (Enter/Escape) in modals
**Severity**: MEDIUM  
**Location**: All modals (Edit, Connectors, Details, etc.)  
**Issue**: Modals don't handle Enter (submit) or Escape (cancel) keys. User must click buttons.  
**Impact**: Poor keyboard accessibility, slower workflow.  
**Fix**: Add keydown handlers for Enter/Escape on all modals.

### BUG #11: No loading states on async delete/duplicate/bulk operations
**Severity**: MEDIUM  
**Location**: Lines 625 (deleteAgent), 689 (bulkDelete), 690 (bulkDuplicate)  
**Issue**: Buttons don't show spinner or disable during async operations. User can click multiple times.  
**Impact**: Confusing UX, potential duplicate actions, no feedback during wait.  
**Fix**: Add loading states with spinner + disabled attribute.

### BUG #12: refreshAnalytics() runs every 5s unconditionally
**Severity**: LOW  
**Location**: Line 695  
**Issue**: Analytics refresh every 5s even if page is hidden/inactive. Wastes resources.  
**Impact**: Unnecessary network traffic, battery drain.  
**Fix**: Pause polling when page visibility is hidden (document.visibilityState).

## LOW SEVERITY BUGS (Nice-to-have)

### BUG #13: No "Select All" checkbox for bulk operations
**Severity**: LOW  
**Location**: Agent cards checkboxes  
**Issue**: User must manually check each agent. No "select all" shortcut.  
**Impact**: Tedious for bulk operations on many agents.  
**Fix**: Add "select all" checkbox in toolbar.

### BUG #14: No visual feedback on clipboard copy
**Severity**: LOW  
**Location**: Lines 378 (skills copy JSON), 379 (skills copy YAML - broken)  
**Issue**: `navigator.clipboard.writeText()` succeeds silently. User has no confirmation.  
**Impact**: Uncertainty whether copy worked.  
**Fix**: Show toast notification on successful copy.

### BUG #15: Drag & Drop reorder persists immediately without confirmation
**Severity**: LOW  
**Location**: Lines 388-401  
**Issue**: Dropping an agent card saves order immediately via `validateAndMaybeSave(true)`. No undo.  
**Impact**: Accidental drags can reorder and save unintentionally.  
**Fix**: Show toast with undo button after drag, or require explicit save.

### BUG #16: Empty states not user-friendly
**Severity**: LOW  
**Location**: Onboarding section (lines 69-73)  
**Issue**: Empty state has minimal guidance. Should be more inviting.  
**Impact**: New users might be confused about next steps.  
**Fix**: Enhance with illustrations, clearer CTAs.

## EDGE CASES TO TEST

1. **API down**: Do all buttons handle fetch errors gracefully? Show error toasts?
2. **Validation errors**: Does inline validation prevent invalid saves?
3. **Duplicate names**: Does validation catch duplicate agent/skill names?
4. **Missing skill refs**: If agent references non-existent skill, is there a warning?
5. **Network timeout**: Do loading states eventually resolve or timeout?
6. **Empty data**: What happens if backend returns empty agents/skills arrays?
7. **Malformed JSON**: Import wizard should handle invalid JSON gracefully.
8. **Large datasets**: Does UI remain performant with 100+ agents?

## TOTAL BUGS FOUND: 16
- **Critical**: 3 (missing functionality)
- **High**: 3 (UX degraded)
- **Medium**: 6 (consistency/polish)
- **Low**: 4 (nice-to-have)
