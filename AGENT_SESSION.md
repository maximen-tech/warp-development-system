# Working With The Agent (Session Guide)

1) State intent using 7 primitives (see 08_TEMPLATES/universal-template.md)
2) Attach precise context: file paths, diffs, or selections
3) Ask for a diff preview; iterate until scope is correct
4) Run /review locally; fix lint/tests before PR
5) Use approval gates for prod-impacting changes

Shortcuts
- /plan "<task>" → generate steps
- /build → build
- /test → tests
- /review → summarize diffs and checks
- /deploy staging → gated deploy
