// Prompt Synthesizer - AI-powered prompt generation with secure API integration
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_OUTPUT_LENGTH = 5000;

class PromptSynthesizer {
  constructor() {
    this.hasAPIKey = !!ANTHROPIC_API_KEY;
    this.cache = new Map(); // Cache for identical inputs (5 min TTL)
    console.log(`[prompt-synthesizer] Mode: ${this.hasAPIKey ? 'AI (Claude API)' : 'Template Fallback'}`);
  }

  async synthesize(input) {
    const { terminalOutput, userIdea, selectedSkills, projectContext } = input;

    // Validate inputs
    if (!userIdea || !userIdea.trim()) {
      throw new Error('User idea is required');
    }

    // Check cache
    const cacheKey = this.getCacheKey(input);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        console.log('[prompt-synthesizer] Cache hit');
        return cached.result;
      }
    }

    // Generate prompt
    const result = this.hasAPIKey 
      ? await this.synthesizeWithAI(input)
      : await this.synthesizeWithTemplate(input);

    // Cache result
    this.cache.set(cacheKey, { result, timestamp: Date.now() });

    // Cleanup old cache entries
    if (this.cache.size > 50) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    return result;
  }

  async synthesizeWithAI(input) {
    const { terminalOutput, userIdea, selectedSkills, projectContext } = input;

    const systemPrompt = `You are an elite AI prompt architect specializing in generating optimal prompts for Claude AI (BIBLE CLAUDE compliant).

Your task: Synthesize a perfect XML-formatted prompt that integrates:
1. Terminal output (developer's current context)
2. User's optimization idea
3. Available skills from project
4. Project context (name, tech stack)

Output Requirements:
- XML format (BIBLE CLAUDE style)
- Include: <role>, <task>, <context>, <instructions>, <deliverable>
- Be specific, actionable, and developer-friendly
- Use appropriate expertise tags based on tech stack
- NO explanations, ONLY the synthesized prompt`;

    const userPrompt = `Generate an optimal AI prompt for this developer scenario:

**Terminal Output:**
\`\`\`
${this.truncate(terminalOutput, 3000)}
\`\`\`

**Developer's Idea:**
${userIdea}

**Available Skills:**
${selectedSkills.length > 0 ? selectedSkills.join(', ') : 'None selected'}

**Project Context:**
- Name: ${projectContext.name || 'Unknown'}
- Tech Stack: ${projectContext.stack?.join(', ') || 'Unknown'}
- Path: ${projectContext.path || 'N/A'}

**Output Format:**
Provide ONLY the synthesized XML prompt, ready to copy/paste. No preamble, no explanation.`;

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[prompt-synthesizer] API error:', error);
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const generatedPrompt = data.content[0].text;

      return {
        prompt: generatedPrompt,
        mode: 'ai',
        model: 'claude-3-5-sonnet-20241022',
        tokens: this.estimateTokens(generatedPrompt),
        confidence: 95,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[prompt-synthesizer] AI synthesis failed, falling back to template:', error.message);
      return await this.synthesizeWithTemplate(input);
    }
  }

  async synthesizeWithTemplate(input) {
    const { terminalOutput, userIdea, selectedSkills, projectContext } = input;

    // Infer role from skills and tech stack
    const role = this.inferRole(selectedSkills, projectContext.stack);

    // Extract constraints from terminal output
    const constraints = this.extractConstraints(terminalOutput);

    // Build XML prompt
    const prompt = `<role>${role}</role>
<extendedthinkingbudget>2048</extendedthinkingbudget>
<mode>QUANTUM_HYPERSPEED</mode>

<task>${userIdea}</task>

<context>
  <project>
    <name>${projectContext.name || 'Current Project'}</name>
    <stack>${projectContext.stack?.join(', ') || 'Unknown'}</stack>
    <path>${projectContext.path || 'N/A'}</path>
  </project>
  
  <terminal_output>
${this.truncate(terminalOutput, 2000).split('\n').map(line => `    ${line}`).join('\n')}
  </terminal_output>
  
  <available_skills>
${selectedSkills.length > 0 ? selectedSkills.map(skill => `    - ${skill}`).join('\n') : '    - No skills selected'}
  </available_skills>
  
  ${constraints.length > 0 ? `<constraints>\n${constraints.map(c => `    - ${c}`).join('\n')}\n  </constraints>` : ''}
</context>

<instructions>
  <objective>
    Implement the requested changes efficiently and correctly.
  </objective>
  
  <approach>
    1. Analyze the terminal output for errors, warnings, or context
    2. Apply the user's idea systematically
    3. Use the available skills when relevant
    4. Ensure backwards compatibility
    5. Test the implementation
  </approach>
  
  <quality_standards>
    - Clean, maintainable code
    - Proper error handling
    - Performance optimized
    - Well-documented
    - Production-ready
  </quality_standards>
</instructions>

<deliverable>
  Provide complete implementation with:
  - Code changes (file paths + diffs)
  - Explanation of approach (<150 words)
  - Testing instructions
  - Any additional setup needed
</deliverable>

<validation>
  ✅ Implementation addresses user's idea
  ✅ Terminal errors/warnings resolved (if any)
  ✅ Code follows project conventions
  ✅ No breaking changes to existing features
  ✅ Ready for immediate deployment
</validation>

<execution_directive>
  Execute with quantum speed. Zero fluff. Ship immediately.
</execution_directive>`;

    return {
      prompt,
      mode: 'template',
      model: 'local-template-v1',
      tokens: this.estimateTokens(prompt),
      confidence: 75,
      timestamp: new Date().toISOString()
    };
  }

  inferRole(skills, stack) {
    const skillsLower = skills.map(s => s.toLowerCase()).join(' ');
    const stackLower = (stack || []).join(' ').toLowerCase();
    const combined = `${skillsLower} ${stackLower}`;

    if (combined.includes('devops') || combined.includes('docker') || combined.includes('kubernetes')) {
      return 'Elite DevOps Engineer + Cloud Infrastructure Architect';
    }
    if (combined.includes('frontend') || combined.includes('react') || combined.includes('vue')) {
      return 'Elite Frontend Developer + UX Engineer';
    }
    if (combined.includes('backend') || combined.includes('api') || combined.includes('database')) {
      return 'Elite Backend Engineer + API Architect';
    }
    if (combined.includes('fullstack') || combined.includes('full-stack')) {
      return 'Elite Full-Stack Engineer + System Architect';
    }
    if (combined.includes('test') || combined.includes('qa')) {
      return 'Elite QA Engineer + Test Automation Specialist';
    }
    if (combined.includes('security')) {
      return 'Elite Security Engineer + Penetration Testing Specialist';
    }
    if (combined.includes('python')) {
      return 'Elite Python Developer + Data Engineer';
    }
    if (combined.includes('javascript') || combined.includes('typescript') || combined.includes('node')) {
      return 'Elite JavaScript/TypeScript Engineer';
    }
    if (combined.includes('go') || combined.includes('golang')) {
      return 'Elite Go Developer + Systems Programmer';
    }

    return 'Elite Software Engineer + Technical Architect';
  }

  extractConstraints(terminalOutput) {
    const constraints = [];
    const lines = terminalOutput.split('\n');

    for (const line of lines) {
      const lower = line.toLowerCase();
      
      if (lower.includes('error:') || lower.includes('failed')) {
        const errorMatch = line.match(/error:?\s*(.+)/i);
        if (errorMatch) constraints.push(`Fix error: ${errorMatch[1].trim()}`);
      }
      
      if (lower.includes('warning:')) {
        const warnMatch = line.match(/warning:?\s*(.+)/i);
        if (warnMatch) constraints.push(`Address warning: ${warnMatch[1].trim()}`);
      }
      
      if (lower.includes('deprecated')) {
        constraints.push('Update deprecated code');
      }
      
      if (lower.includes('cannot find module') || lower.includes('module not found')) {
        const moduleMatch = line.match(/['"]([^'"]+)['"]/);
        if (moduleMatch) constraints.push(`Install missing module: ${moduleMatch[1]}`);
      }
    }

    return constraints.slice(0, 5); // Max 5 constraints
  }

  truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '\n... [truncated]';
  }

  estimateTokens(text) {
    // Simple heuristic: ~4 chars per token
    return Math.ceil(text.length / 4);
  }

  getCacheKey(input) {
    const { terminalOutput, userIdea, selectedSkills, projectContext } = input;
    return `${projectContext.name}_${userIdea}_${selectedSkills.join(',')}_${terminalOutput.substring(0, 100)}`;
  }

  getStatus() {
    return {
      mode: this.hasAPIKey ? 'ai' : 'template',
      apiKeyConfigured: this.hasAPIKey,
      cacheSize: this.cache.size
    };
  }
}

export default PromptSynthesizer;