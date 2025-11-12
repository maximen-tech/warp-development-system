# Agents & Skills (Configuration Guide)

- Define atomic skills in `.warp/agents/skills.yml`
- Compose named agents in `.warp/agents/agents.yml`
- Use `/agent-sync` to validate and print the active agents and skills

Design tips
- Keep skills small and measurable (inputs/outputs)
- Assign strict guardrails to each skill
- Route planning vs execution models per agent responsibility
