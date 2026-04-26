const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Mistral } = require('@mistralai/mistralai');

// ── Provider Clients ────────────────────────────────────────────────

// Gemini
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// Mistral
const mistral = process.env.MISTRAL_API_KEY
  ? new Mistral({ apiKey: process.env.MISTRAL_API_KEY })
  : null;

// ── Provider Implementations ────────────────────────────────────────

async function chatOllama(messages, { temperature, maxTokens, json }) {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3';

  const body = {
    model,
    messages,
    stream: false,
    options: { temperature, num_predict: maxTokens },
  };
  if (json) body.format = 'json';

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.message?.content;
}

async function chatMistral(messages, { temperature, maxTokens, json }) {
  const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';

  const params = {
    model,
    messages,
    temperature,
    maxTokens,
  };
  if (json) {
    params.responseFormat = { type: 'json_object' };
  }

  const result = await mistral.chat.complete(params);
  return result.choices[0].message.content;
}

async function chatGemini(messages, { temperature, maxTokens, json }) {
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  // Separate system instruction from conversation messages
  const systemMsg = messages.find((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  const modelConfig = {
    model: modelName,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };
  if (systemMsg) {
    modelConfig.systemInstruction = systemMsg.content;
  }
  if (json) {
    modelConfig.generationConfig.responseMimeType = 'application/json';
  }

  const model = genAI.getGenerativeModel(modelConfig);

  // Build Gemini-style history + final message
  const history = nonSystem.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const lastMsg = nonSystem[nonSystem.length - 1];

  const chatSession = model.startChat({ history });
  const result = await chatSession.sendMessage(lastMsg.content);
  return result.response.text();
}

// ── Main Chat Router ────────────────────────────────────────────────

/**
 * Core AI completion helper.
 * Routes to the configured provider (ollama, mistral, gemini).
 * Falls back through providers if the primary one fails.
 */
async function chat(messages, { temperature = 0.7, maxTokens = 4096, json = false } = {}) {
  const provider = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
  const opts = { temperature, maxTokens, json };

  // Define fallback order based on chosen primary
  const providers = {
    ollama: [chatOllama, chatMistral, chatGemini],
    mistral: [chatMistral, chatGemini, chatOllama],
    gemini: [chatGemini, chatMistral, chatOllama],
  };

  const chain = providers[provider] || providers.ollama;

  for (const fn of chain) {
    try {
      const result = await fn(messages, opts);
      return result;
    } catch (err) {
      console.warn(`AI provider ${fn.name} failed: ${err.message}. Trying next...`);
    }
  }

  throw new Error('All AI providers failed. Check your API keys and Ollama status.');
}

function stripMarkdownFences(text) {
  if (!text) return '';
  let cleaned = String(text).trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return cleaned;
}

// Extract the first balanced JSON object/array from mixed model output.
function extractFirstJsonBlock(text) {
  const input = stripMarkdownFences(text);
  const start = input.search(/[\[{]/);
  if (start === -1) return input;

  const open = input[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, i + 1).trim();
      }
    }
  }

  // Unbalanced output: return from JSON start and let caller decide on retry.
  return input.slice(start).trim();
}

function parseJsonFromModelOutput(rawText) {
  const candidates = [stripMarkdownFences(rawText), extractFirstJsonBlock(rawText)].filter(Boolean);
  let lastError;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Invalid JSON output from AI model.');
}

function buildFallbackProjectPack(idea, userProfile = {}) {
  const safeIdea = String(idea || 'New Project').trim();
  const projectName = safeIdea.split(':')[0].slice(0, 60) || 'New Project';
  const totalWeeks = 8;
  const teamSize = userProfile.teamSize || 'solo';

  return {
    projectName,
    description: `Starter project for: ${safeIdea}. This fallback pack was generated because AI output formatting failed. Refine details after project creation.`,
    milestones: [
      { name: 'Discovery and Planning', description: 'Finalize scope, requirements, and backlog.', weekNumber: 1 },
      { name: 'Core Development', description: 'Implement primary features and data model.', weekNumber: 4 },
      { name: 'Testing and Stabilization', description: 'Fix bugs and improve quality.', weekNumber: 6 },
      { name: 'Demo and Submission', description: 'Prepare presentation and final handoff.', weekNumber: 8 },
    ],
    modules: [
      {
        name: 'Backend API',
        description: 'Service and API layer implementation.',
        tasks: [
          { title: 'Set up API structure', description: 'Create routes, controllers, and models.', priority: 'high', estimatedHours: 6, status: 'todo', category: 'backend', deadline_week: 1 },
          { title: 'Implement auth flow', description: 'Add signup/login and token validation.', priority: 'high', estimatedHours: 8, status: 'todo', category: 'backend', deadline_week: 2 },
          { title: 'Create core CRUD endpoints', description: 'Implement create/read/update/delete for core entities.', priority: 'high', estimatedHours: 10, status: 'todo', category: 'backend', deadline_week: 3 },
          { title: 'Add API validation', description: 'Validate request payloads and return clear errors.', priority: 'medium', estimatedHours: 5, status: 'todo', category: 'backend', deadline_week: 4 },
        ],
      },
      {
        name: 'Frontend App',
        description: 'User interface and workflows.',
        tasks: [
          { title: 'Create app shell and navigation', description: 'Build core layout and navigation.', priority: 'high', estimatedHours: 6, status: 'todo', category: 'frontend', deadline_week: 1 },
          { title: 'Build key screens', description: 'Implement dashboard and detail views.', priority: 'high', estimatedHours: 12, status: 'todo', category: 'frontend', deadline_week: 3 },
          { title: 'Integrate API services', description: 'Connect UI to backend endpoints.', priority: 'high', estimatedHours: 9, status: 'todo', category: 'frontend', deadline_week: 4 },
          { title: 'Improve UX and responsiveness', description: 'Handle loading states and mobile behavior.', priority: 'medium', estimatedHours: 6, status: 'todo', category: 'design', deadline_week: 5 },
        ],
      },
      {
        name: 'Quality and Delivery',
        description: 'Testing, documentation, and deployment.',
        tasks: [
          { title: 'Write unit/integration tests', description: 'Cover core API and UI flows.', priority: 'medium', estimatedHours: 8, status: 'todo', category: 'testing', deadline_week: 6 },
          { title: 'Prepare SRS draft', description: 'Document requirements and architecture.', priority: 'medium', estimatedHours: 5, status: 'todo', category: 'documentation', deadline_week: 2 },
          { title: 'Create demo script', description: 'Define demo flow and talking points.', priority: 'medium', estimatedHours: 3, status: 'todo', category: 'documentation', deadline_week: 7 },
          { title: 'Deploy and smoke test', description: 'Deploy app and verify production basics.', priority: 'high', estimatedHours: 6, status: 'todo', category: 'deployment', deadline_week: 8 },
        ],
      },
    ],
    timeline: {
      totalWeeks,
      phases: [
        { name: 'Foundation', weeks: '1-2', description: 'Planning, setup, and architecture baseline.' },
        { name: 'Build', weeks: '3-5', description: 'Core feature implementation and integration.' },
        { name: 'Stabilize', weeks: '6-7', description: 'Testing, fixes, and performance improvements.' },
        { name: 'Release', weeks: '8', description: 'Deployment, demo prep, and handoff.' },
      ],
    },
    techStack: {
      frontend: ['AngularJS'],
      backend: ['Ruby on Rails'],
      database: ['PostgreSQL'],
      devops: ['Docker'],
      tools: ['GitHub', 'Postman'],
    },
    risks: [
      { risk: 'Scope creep', impact: 'medium', mitigation: 'Freeze sprint scope and manage backlog priorities.' },
      { risk: 'Integration delays', impact: 'high', mitigation: 'Integrate frontend and backend from week 2 onward.' },
      { risk: 'Testing gaps', impact: 'medium', mitigation: 'Add test checkpoints each sprint.' },
    ],
    srsOutline: `# Software Requirements Specification\n\n## Introduction\nThis project delivers a production-ready starter for ${projectName}. The target team size is ${teamSize}.\n\n## Scope\nThe system supports core workflows, role-based access, and clear data management boundaries.\n\n## Functional Requirements\n- Authentication and authorization\n- Core entity CRUD operations\n- Search/filter and status tracking\n- Dashboard and detail views\n\n## Non-Functional Requirements\n- Responsive UI\n- Error handling and logging\n- Basic security best practices\n- Maintainable architecture\n\n## System Architecture\nA layered architecture separates UI, API, and data persistence. APIs expose business logic and validation, while the frontend handles interaction and presentation.`,
    pptOutline: [
      { slide: 1, title: 'Project Overview', bullets: ['Problem statement', 'Objective', 'Expected outcomes'], speakerNotes: 'Set context and project goals.' },
      { slide: 2, title: 'Architecture', bullets: ['Frontend layer', 'Backend layer', 'Database design'], speakerNotes: 'Explain system components and interactions.' },
      { slide: 3, title: 'Implementation Plan', bullets: ['Milestones', 'Module ownership', 'Timeline'], speakerNotes: 'Walk through delivery plan.' },
      { slide: 4, title: 'Demo Flow', bullets: ['Primary user journey', 'Key feature highlights', 'Expected output'], speakerNotes: 'Show practical usage sequence.' },
      { slide: 5, title: 'Testing and Risks', bullets: ['Testing strategy', 'Top risks', 'Mitigation actions'], speakerNotes: 'Demonstrate quality and risk management.' },
      { slide: 6, title: 'Next Steps', bullets: ['Immediate tasks', 'Future improvements', 'Q&A'], speakerNotes: 'Close with roadmap and discussion.' },
    ],
    researchPack: [
      { title: 'AngularJS Developer Guide', type: 'documentation', url: 'https://docs.angularjs.org/guide', summary: 'Official guide for AngularJS app structure and best practices.' },
      { title: 'Ruby on Rails Guides', type: 'documentation', url: 'https://guides.rubyonrails.org/', summary: 'Official Rails guides for MVC, routing, and deployment basics.' },
      { title: 'WebSocket Protocol (RFC 6455)', type: 'documentation', url: 'https://datatracker.ietf.org/doc/html/rfc6455', summary: 'Reference for real-time communication protocol behavior.' },
      { title: 'OWASP Top 10', type: 'article', url: 'https://owasp.org/www-project-top-ten/', summary: 'Security risks and mitigation patterns for web applications.' },
    ],
    demoChecklist: [
      'Run backend and frontend locally',
      'Show login/signup workflow',
      'Create and update a sample item',
      'Demonstrate one end-to-end real-time or async flow',
      'Show tests/logging and discuss known limitations',
    ],
    firstWeekPlan: [
      { day: 'Day 1', tasks: ['Finalize scope', 'Create repository structure'] },
      { day: 'Day 2', tasks: ['Set up backend skeleton', 'Set up frontend skeleton'] },
      { day: 'Day 3', tasks: ['Define data model', 'Create first API endpoints'] },
      { day: 'Day 4', tasks: ['Build first UI screens', 'Connect initial API calls'] },
      { day: 'Day 5', tasks: ['Write smoke tests', 'Prepare sprint demo notes'] },
    ],
    recommendedRoles: [
      { role: 'Backend Developer', responsibilities: 'API development, business logic, and database integration.' },
      { role: 'Frontend Developer', responsibilities: 'UI implementation, state management, and integration.' },
      { role: 'QA/Documentation', responsibilities: 'Testing, defect tracking, SRS, and presentation prep.' },
    ],
  };
}

// ── AI PROJECT PLANNER ──────────────────────────────────────────────
async function generateProjectPlan(description) {
  const systemPrompt = `You are an expert project manager and software architect.
Given a project idea, generate a comprehensive project plan in JSON with this exact structure:
{
  "projectName": "string",
  "summary": "2-3 sentence summary",
  "modules": [
    { "name": "string", "description": "string", "tasks": [
      { "title": "string", "description": "string", "priority": "high|medium|low", "estimatedHours": number, "category": "backend|frontend|design|testing|deployment|research|documentation" }
    ]}
  ],
  "milestones": [
    { "name": "string", "description": "string", "weekNumber": number }
  ],
  "timeline": { "totalWeeks": number, "phases": [
    { "name": "string", "weeks": "string", "description": "string" }
  ]},
  "risks": [
    { "risk": "string", "impact": "high|medium|low", "mitigation": "string" }
  ],
  "techStack": { "frontend": [], "backend": [], "database": [], "tools": [] }
}
Be thorough. Generate 15-30 tasks across modules. Be realistic with timelines for a student team of 3-5 members.`;

  const result = await chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate a project plan for: ${description}` },
    ],
    { temperature: 0.6, maxTokens: 4096, json: true }
  );
  return JSON.parse(result);
}

// ── AI RESEARCH ASSISTANT ───────────────────────────────────────────
async function researchAssistant(question, projectContext) {
  const systemPrompt = `You are a research and planning AI assistant embedded inside a project management tool for student teams.
You have context about the user's project:

Project Name: ${projectContext.projectName || 'Unknown'}
Project Description: ${projectContext.projectDescription || 'Unknown'}
Current Tasks: ${projectContext.tasks || 'None listed'}
Team Size: ${projectContext.teamSize || 'Unknown'}

Your job:
1. Answer research questions thoroughly with references and examples
2. Help with academic concepts, algorithms, architectures
3. Suggest practical implementation approaches
4. Help structure academic documents (SRS, reports, etc.)
5. Always relate answers back to their project when relevant

Format responses in clean Markdown with headers, bullet points, and code blocks where appropriate.
If asked about research papers, provide real paper names, authors, and years (only ones you are confident exist).`;

  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history if provided
  if (projectContext.conversationHistory) {
    messages.push(...projectContext.conversationHistory);
  }

  messages.push({ role: 'user', content: question });

  return await chat(messages, { temperature: 0.5, maxTokens: 4096 });
}

// ── AI DOCUMENT GENERATOR ───────────────────────────────────────────
async function generateDocument(type, projectContext) {
  const docPrompts = {
    srs: `Generate a professional Software Requirements Specification (SRS) document based on the IEEE 830 standard. Include:
1. Introduction (Purpose, Scope, Definitions, References, Overview)
2. Overall Description (Product Perspective, Functions, User Characteristics, Constraints, Assumptions)
3. Specific Requirements (Functional, Non-Functional, Interface, Performance, Security)
4. Appendices

Make it thorough and academic-quality.`,

    ppt_outline: `Generate a comprehensive presentation outline for a college project demo. Include:
1. Title Slide
2. Team Introduction
3. Problem Statement
4. Proposed Solution
5. System Architecture
6. Technology Stack
7. Key Features (with talking points)
8. Database Design
9. Implementation Highlights
10. Demo Flow
11. Testing Results
12. Challenges & Solutions
13. Future Scope
14. Q&A

For each slide, provide: Title, Bullet Points (3-5), Speaker Notes`,

    demo_script: `Generate a detailed demo script for presenting this project to college faculty. Include:
1. Opening (30 seconds)
2. Problem overview (1 minute)
3. Solution walkthrough (3 minutes)
4. Live demo steps (5 minutes) — step-by-step what to show
5. Technical highlights (2 minutes)
6. Q&A preparation — top 10 likely questions and answers
7. Closing (30 seconds)

Be specific and practical.`,

    architecture: `Generate a detailed system architecture document including:
1. High-Level Architecture Diagram (describe in text/ASCII)
2. Component Diagram
3. Data Flow Diagram
4. Database Schema Design (tables/collections, relationships)
5. API Endpoints List (method, path, description)
6. Technology Justification
7. Deployment Architecture
8. Security Architecture

Be thorough enough for academic documentation.`,

    use_cases: `Generate comprehensive Use Case documentation including:
1. Actor Identification
2. Use Case List (at least 8-12 use cases)
3. For each use case:
   - Use Case ID
   - Name
   - Primary Actor
   - Description
   - Preconditions
   - Main Flow (step by step)
   - Alternative Flows
   - Postconditions
4. Use Case Diagram (describe in text format)

Follow UML standards.`,
  };

  const systemPrompt = `You are an expert technical writer specializing in academic project documentation.
Generate the requested document for:

Project Name: ${projectContext.projectName}
Project Description: ${projectContext.projectDescription}
Tech Stack: ${projectContext.techStack || 'Not specified'}
Modules: ${projectContext.modules || 'Not specified'}
Team Members: ${projectContext.teamSize || 'Not specified'}

Format the output in clean Markdown. Be thorough, professional, and academic-quality.`;

  const prompt = docPrompts[type] || docPrompts.srs;

  return await chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.4, maxTokens: 4096 }
  );
}

// ── PROJECT HEALTH ANALYSIS ─────────────────────────────────────────
async function analyzeProjectHealth(projectData) {
  const systemPrompt = `You are a project health analysis AI. Analyze the project data and return JSON:
{
  "overallHealth": "healthy|at-risk|critical",
  "score": number (0-100),
  "issues": [
    { "type": "overdue|idle|overloaded|blocked|no-assignee|scope-creep", "severity": "high|medium|low", "title": "string", "description": "string", "suggestion": "string" }
  ],
  "insights": [
    { "icon": "📊|⚡|🎯|⏰|👥", "title": "string", "detail": "string" }
  ],
  "recommendations": ["string"]
}
Be specific. Reference actual tasks and members by name. Only flag real issues.`;

  const result = await chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze this project:\n${JSON.stringify(projectData, null, 2)}` },
    ],
    { temperature: 0.3, maxTokens: 2048, json: true }
  );
  return JSON.parse(result);
}

// ── AI TASK BREAKDOWN ───────────────────────────────────────────────
async function breakdownTask(taskDescription, projectContext) {
  const systemPrompt = `You are an expert at breaking down complex tasks into actionable subtasks.
Given a high-level task, break it into smaller, assignable subtasks.

Project context:
- Name: ${projectContext.projectName || 'Unknown'}
- Tech Stack: ${projectContext.techStack || 'Not specified'}

Return JSON:
{
  "parentTask": "string",
  "subtasks": [
    { "title": "string", "description": "string", "priority": "high|medium|low", "estimatedHours": number, "category": "backend|frontend|design|testing|deployment" }
  ],
  "dependencies": ["string — describe task dependencies"],
  "estimatedTotalHours": number
}`;

  const result = await chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Break down this task: ${taskDescription}` },
    ],
    { temperature: 0.5, maxTokens: 2048, json: true }
  );
  return JSON.parse(result);
}

// ── ONE-CLICK PROJECT PACK ──────────────────────────────────────────
async function generateProjectPack(idea, userProfile = {}) {
  const profileCtx = userProfile.profession
    ? `User profile: ${userProfile.profession} at ${userProfile.organization || 'N/A'}, specialization: ${userProfile.specialization || 'N/A'}, experience: ${userProfile.experience || 'beginner'}, team size: ${userProfile.teamSize || 'solo'}, goal: ${userProfile.goal || 'semester-project'}.`
    : '';

  const systemPrompt = `You are an expert project manager, software architect, and academic mentor.
${profileCtx}

Given a project idea, generate a COMPLETE project starter pack as JSON:
{
  "projectName": "string",
  "description": "2-3 sentence professional description",
  "milestones": [
    { "name": "string", "description": "string", "weekNumber": number }
  ],
  "modules": [
    { "name": "string", "description": "string", "tasks": [
      { "title": "string", "description": "string", "priority": "high|medium|low", "estimatedHours": number, "status": "todo", "category": "backend|frontend|design|testing|deployment|research|documentation", "deadline_week": number }
    ]}
  ],
  "timeline": { "totalWeeks": number, "phases": [
    { "name": "string", "weeks": "string", "description": "string" }
  ]},
  "techStack": { "frontend": [], "backend": [], "database": [], "devops": [], "tools": [] },
  "risks": [
    { "risk": "string", "impact": "high|medium|low", "mitigation": "string" }
  ],
  "srsOutline": "A concise 180-250 word SRS draft in markdown covering Introduction, Scope, Functional Requirements, Non-Functional Requirements, and System Architecture overview",
  "pptOutline": [
    { "slide": number, "title": "string", "bullets": ["string"], "speakerNotes": "string" }
  ],
  "researchPack": [
    { "title": "string", "type": "article|paper|tutorial|documentation", "url": "string or empty", "summary": "1-2 sentence summary" }
  ],
  "demoChecklist": ["string — step-by-step demo items"],
  "firstWeekPlan": [
    { "day": "string", "tasks": ["string"] }
  ],
  "recommendedRoles": [
    { "role": "string", "responsibilities": "string" }
  ]
}

Rules:
- Return ONLY valid JSON. No markdown fences. No prose before/after JSON.
- Keep strings concise and practical.
- Generate 12-20 tasks across modules.
- Include realistic deadlines.
- Include 4-6 research resources.
- PPT should have 8-10 slides.
- Keep the full response compact enough to fit in one model response without truncation.`;

  const userPrompt = `Generate a complete project pack for: ${idea}`;

  let result;
  let lastParseError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    result = await chat(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
            attempt === 1
              ? userPrompt
              : `${userPrompt}\n\nPrevious output was not valid complete JSON. Regenerate from scratch as strict, complete, compact JSON only.`,
        },
      ],
      { temperature: attempt === 1 ? 0.6 : 0.2, maxTokens: 8192, json: true }
    );

    try {
      return parseJsonFromModelOutput(result);
    } catch (parseErr) {
      lastParseError = parseErr;
      const rawAttempt = String(result || '').trim();
      console.error(
        `JSON parse failed for project pack (attempt ${attempt}/3). Raw (first 500 chars):`,
        rawAttempt.substring(0, 500)
      );
    }
  }

  console.error('Final project pack parse error:', lastParseError?.message || 'unknown parse error');
  console.warn('Using fallback project pack due to repeated AI JSON formatting failures.');
  return buildFallbackProjectPack(idea, userProfile);
}

module.exports = {
  generateProjectPlan,
  researchAssistant,
  generateDocument,
  analyzeProjectHealth,
  breakdownTask,
  generateProjectPack,
};
