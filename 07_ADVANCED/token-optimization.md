# Token Optimization (60–70% Savings)

Levers
- Route: DeepSeek for planning, Claude for execution
- Prune context: attach only relevant files/diffs
- Compress: summaries vs full logs, chunking
- Determinism: low temperature for code edits
- Stop sequences and max-tokens caps

Playbook
- [ ] Add routing policy in `.warp/models/*`
- [ ] Use minimal-context prompts (file paths + ranges)
- [ ] Prefer diff-based edits over full rewrites
- [ ] Cache plans; reuse across runs
