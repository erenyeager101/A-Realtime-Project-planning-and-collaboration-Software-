/**
 * Diagram Analysis Service
 * Analyzes UML and architecture diagram images using Mistral's multimodal API
 * Returns structured analysis of entities, relationships, and code structure
 */

const fs = require('fs');
const { Mistral } = require('@mistralai/mistralai');

// Initialize Mistral client with coding API key
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY_CODING });
const DEFAULT_VISION_MODELS = ['pixtral-large-latest', 'pixtral-12b-latest', 'pixtral-12b-2409'];

function ensureMistralConfigured() {
  if (!process.env.MISTRAL_API_KEY_CODING) {
    throw new Error('AI diagram analysis is not configured. Set MISTRAL_API_KEY_CODING in backend/.env.');
  }
}

function getVisionModelCandidates() {
  const candidates = [
    process.env.MISTRAL_VISION_MODEL,
    process.env.MISTRAL_MODEL,
    ...DEFAULT_VISION_MODELS
  ].filter(Boolean);

  return [...new Set(candidates)];
}

function parseStatusCodeFromError(error) {
  const message = String(error?.message || '');
  const match = message.match(/Status\s+(\d{3})/i);
  return match ? Number(match[1]) : null;
}

function isModelImageCapabilityError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('image input is not enabled for this model')
    || message.includes('"code":"3051"')
    || message.includes("code':'3051'")
    || message.includes('code: "3051"')
    || message.includes('code: 3051');
}

async function analyzeDiagramWithModel({ model, systemPrompt, userPrompt, mimeType, base64Image }) {
  const response = await mistral.chat.complete({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          {
            type: 'image_url',
            imageUrl: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high'
            }
          }
        ]
      }
    ],
    temperature: 0.2,
    maxTokens: 4096,
    responseFormat: { type: 'json_object' }
  });

  const content = response?.choices?.[0]?.message?.content;
  const rawText = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((part) => part?.text || '').join('\n')
      : JSON.stringify(content);

  if (!rawText) {
    throw new Error('Diagram analysis model returned empty output');
  }

  return JSON.parse(rawText);
}

/**
 * Analyze an uploaded diagram image
 * @param {string} imagePath - Path to the uploaded image file
 * @param {string} diagramType - Type of diagram (uml-class, uml-sequence, architecture, er, component)
 * @returns {Object} Structured analysis of the diagram
 */
async function analyzeDiagram(imagePath, diagramType = 'auto-detect') {
  ensureMistralConfigured();

  // Read image and convert to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const mimeType = getMimeType(imagePath);

  const systemPrompt = `You are an expert software architect and UML analyst. Analyze the provided diagram image and extract key architectural elements.

Based on the diagram content, identify:
1. All entities/classes with their attributes
2. All relationships between entities (inheritance, composition, association, etc.)
3. Operations/methods for each entity
4. Design patterns used (if any)
5. Architectural layers or tiers
6. Data flows and interactions

Return your analysis as a JSON object with this structure:
{
  "diagramType": "detected type (uml-class|uml-sequence|architecture|er|component)",
  "languages": ["detected programming language(s)"],
  "entities": [
    {
      "name": "ClassName",
      "type": "class|interface|enum|component|service",
      "attributes": [{"name": "attrName", "type": "string", "visibility": "public|private|protected"}],
      "methods": [{"name": "methodName", "params": [{"name": "param", "type": "string"}], "returnType": "void", "visibility": "public"}],
      "description": "purpose of this entity"
    }
  ],
  "relationships": [
    {
      "source": "SourceEntity",
      "target": "TargetEntity",
      "type": "inheritance|composition|aggregation|association|dependency",
      "multiplicity": "1..*"
    }
  ],
  "architecture": {
    "layers": ["presentation", "business", "data"],
    "patterns": ["MVC", "Repository", "Factory"],
    "frameworks": ["detected frameworks"]
  },
  "dataFlow": [
    {"from": "ComponentA", "to": "ComponentB", "description": "API calls"}
  ]
}

Be thorough and accurate. If uncertain about specific details, make educated guesses based on standard naming conventions and best practices.`;

  const userPrompt = diagramType === 'auto-detect'
    ? 'Analyze this software diagram and extract all entities, relationships, methods, and architectural patterns. Return a detailed JSON analysis.'
    : `Analyze this ${diagramType} diagram and extract all relevant information. Return a detailed JSON analysis.`;

  const modelCandidates = getVisionModelCandidates();
  let lastError = null;

  for (const model of modelCandidates) {
    try {
      const analysis = await analyzeDiagramWithModel({
        model,
        systemPrompt,
        userPrompt,
        mimeType,
        base64Image
      });

      // Validate and enrich the analysis
      return validateAndEnrichAnalysis(analysis);
    } catch (error) {
      lastError = error;

      // Try next model when current model does not support images.
      if (isModelImageCapabilityError(error)) {
        continue;
      }

      throw new Error(`Failed to analyze diagram using model "${model}": ${error.message}`);
    }
  }

  const tried = modelCandidates.join(', ');
  const statusCode = parseStatusCodeFromError(lastError);
  const prefix = statusCode ? `[HTTP_${statusCode}] ` : '';
  throw new Error(
    `${prefix}Failed to analyze diagram: no configured Mistral model accepted image input. Tried: ${tried}. Last error: ${lastError?.message || 'unknown error'}`
  );
}

/**
 * Generate a code generation plan from diagram analysis
 * @param {Object} analysis - The diagram analysis result
 * @param {Object} options - Generation options (targetFramework, database, etc.)
 * @returns {Object} Code generation plan
 */
async function generateCodePlan(analysis, options = {}) {
  ensureMistralConfigured();

  const {
    targetLanguage = 'javascript',
    targetFramework = 'express-react-mongodb',
    includeTests = true,
    includeDocs = true
  } = options;

  const systemPrompt = `You are an expert full-stack developer. Given a diagram analysis, create a complete code generation plan.

The plan should include:
1. File structure and organization
2. Class/module definitions for each entity
3. API endpoints for CRUD operations
4. Database schemas/collections
5. Frontend components for each entity
6. Service implementations
7. Configuration files

Return as JSON:
{
  "projectName": "Suggested project name",
  "structure": {
    "folders": ["folder names"],
    "files": [{"path": "relative/path", "purpose": "what this file does"}]
  },
  "backend": {
    "models": [{"name": "ModelName", "fields": [{"name": "field", "type": "string", "required": true}], "relationships": []}],
    "controllers": [{"name": "ControllerName", "methods": ["list", "create", "update", "delete"], "routes": [{"method": "GET", "path": "/api/items"}]}],
    "services": [{"name": "ServiceName", "methods": ["method signatures"]}],
    "middleware": ["auth", "validation"]
  },
  "frontend": {
    "components": [{"name": "ComponentName", "props": ["prop names"], "state": ["state fields"]}],
    "pages": [{"name": "PageName", "route": "/path"}],
    "hooks": ["custom hooks"],
    "services": ["API service files"]
  },
  "database": {
    "type": "mongodb|postgresql|mysql",
    "collections": [{"name": "collection", "schema": "description"}]
  },
  "tests": {
    "unit": ["what to test"],
    "integration": ["endpoints to test"]
  },
  "configFiles": [{"name": "package.json", "purpose": "dependencies"}]
}

The plan must be comprehensive enough to generate working code.`;

  try {
    const response = await mistral.chat.complete({
      model: process.env.MISTRAL_MODEL || 'codestral-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Create a code generation plan for this diagram analysis:

${JSON.stringify(analysis, null, 2)}

Target: ${targetLanguage} with ${targetFramework}
Options: includeTests=${includeTests}, includeDocs=${includeDocs}`
        }
      ],
      temperature: 0.3,
      maxTokens: 4096,
      responseFormat: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Code plan generation error:', error);
    throw new Error(`Failed to generate code plan: ${error.message}`);
  }
}

/**
 * Helper: Get MIME type from file path
 */
function getMimeType(filePath) {
  const ext = filePath.toLowerCase().split('.').pop();
  const types = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp'
  };
  return types[ext] || 'image/png';
}

/**
 * Helper: Validate and enrich analysis with defaults
 */
function validateAndEnrichAnalysis(analysis) {
  // Ensure required fields exist
  if (!analysis.entities) analysis.entities = [];
  if (!analysis.relationships) analysis.relationships = [];
  if (!analysis.architecture) analysis.architecture = { layers: [], patterns: [] };
  if (!analysis.dataFlow) analysis.dataFlow = [];

  // Add default visibility if missing
  analysis.entities.forEach(entity => {
    if (!entity.attributes) entity.attributes = [];
    if (!entity.methods) entity.methods = [];

    entity.attributes.forEach(attr => {
      if (!attr.visibility) attr.visibility = 'private';
    });

    entity.methods.forEach(method => {
      if (!method.visibility) method.visibility = 'public';
      if (!method.params) method.params = [];
    });
  });

  return analysis;
}

/**
 * Generate file contents for the code plan
 * @param {Object} codePlan - The code generation plan
 * @returns {Array} Array of file objects with path and content
 */
async function generateFileContents(codePlan) {
  const files = [];

  // Generate package.json
  files.push({
    path: 'package.json',
    content: generatePackageJson(codePlan)
  });

  // Generate backend models
  for (const model of codePlan.backend?.models || []) {
    files.push({
      path: `backend/models/${model.name}.js`,
      content: generateMongooseModel(model)
    });
  }

  // Generate backend controllers
  for (const controller of codePlan.backend?.controllers || []) {
    files.push({
      path: `backend/controllers/${controller.name}.js`,
      content: generateController(controller)
    });
  }

  // Generate routes
  files.push({
    path: 'backend/routes/index.js',
    content: generateRoutes(codePlan.backend?.controllers || [])
  });

  // Generate frontend components
  for (const component of codePlan.frontend?.components || []) {
    files.push({
      path: `frontend/src/components/${component.name}.jsx`,
      content: generateReactComponent(component)
    });
  }

  // Generate frontend pages
  for (const page of codePlan.frontend?.pages || []) {
    files.push({
      path: `frontend/src/pages/${page.name}.jsx`,
      content: generateReactPage(page, codePlan)
    });
  }

  // Generate services
  for (const service of codePlan.frontend?.services || []) {
    files.push({
      path: `frontend/src/services/${service}.js`,
      content: generateFrontendService(service, codePlan)
    });
  }

  // Generate config files
  files.push(
    { path: 'backend/.env.example', content: generateEnvExample(codePlan) },
    { path: 'backend/server.js', content: generateServerJs(codePlan) },
    { path: 'frontend/vite.config.js', content: generateViteConfig(codePlan) },
    { path: 'frontend/index.html', content: generateIndexHtml(codePlan) },
    { path: 'README.md', content: generateReadmeMd(codePlan) }
  );

  return files;
}

// --- Code Generation Helpers ---

function generatePackageJson(plan) {
  const name = plan.projectName?.toLowerCase().replace(/\s+/g, '-') || 'generated-project';
  return JSON.stringify({
    name,
    version: '1.0.0',
    description: `Generated from UML diagram - ${plan.projectName}`,
    scripts: {
      "install:all": "cd backend && npm install && cd ../frontend && npm install",
      "dev": "concurrently \"cd backend && npm run dev\" \"cd frontend && npm run dev\"",
      "build": "cd frontend && npm run build",
      "start": "cd backend && npm start"
    },
    devDependencies: {
      concurrently: '^8.2.2'
    }
  }, null, 2);
}

function generateMongooseModel(model) {
  const fields = model.fields?.map(f => {
    const required = f.required ? ', required: true' : '';
    const ref = f.ref ? `, ref: '${f.ref}'` : '';
    const defaultVal = f.default ? `, default: ${typeof f.default === 'string' ? `'${f.default}'` : f.default}` : '';
    return `  ${f.name}: { type: ${mapType(f.type)}${required}${ref}${defaultVal} },`;
  }).join('\n') || '';

  const relationships = model.relationships?.map(r => {
    return `  ${r.as || r.name}: { type: mongoose.Schema.Types.ObjectId, ref: '${r.ref}', required: false },`;
  }).join('\n') || '';

  return `const mongoose = require('mongoose');

const ${model.name.toLowerCase()}Schema = new mongoose.Schema({
${fields}
${relationships}
}, { timestamps: true });

module.exports = mongoose.model('${model.name}', ${model.name.toLowerCase()}Schema);
`;
}

function generateController(controller) {
  const modelName = controller.model || controller.name.replace('Controller', '');
  const lowerModel = modelName.toLowerCase();

  return `const ${modelName} = require('../models/${modelName}');

class ${controller.name} {
  async list(req, res) {
    try {
      const items = await ${modelName}.find();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const item = await ${modelName}.findById(req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const item = new ${modelName}(req.body);
      await item.save();
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const item = await ${modelName}.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const item = await ${modelName}.findByIdAndDelete(req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ${controller.name}();
`;
}

function generateRoutes(controllers) {
  const imports = controllers.map(c => `const ${c.name.toLowerCase()} = require('./controllers/${c.name}');`).join('\n');
  const routes = controllers.map(c => {
    const base = c.routes?.[0]?.path || `/api/${c.name.toLowerCase().replace('controller', 's')}`;
    const name = c.name.toLowerCase();
    return `
// ${c.name} routes
router.get('${base}', ${name}.list);
router.get('${base}/:id', ${name}.getById);
router.post('${base}', ${name}.create);
router.put('${base}/:id', ${name}.update);
router.delete('${base}/:id', ${name}.delete);`;
  }).join('\n');

  return `const express = require('express');
const router = express.Router();

${imports}

${routes}

module.exports = router;
`;
}

function generateReactComponent(component) {
  const propsDestructuring = component.props?.length ? `{ ${component.props.join(', ')} }` : '';
  const stateHooks = component.state?.map(s => `const [${s.name}, set${capitalize(s.name)}] = useState(${s.default || "''"});`).join('\n') || '';

  return `import React, { useState, useEffect } from 'react';

export default function ${component.name}(${propsDestructuring}) {
${stateHooks}

  return (
    <div className="${component.name.toLowerCase()}">
      {/* TODO: Implement ${component.name} component */}
    </div>
  );
}
`;
}

function generateReactPage(page, plan) {
  return `import React from 'react';

export default function ${page.name}() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">${page.name.replace(/([A-Z])/g, ' $1').trim()}</h1>
      {/* TODO: Implement page content */}
    </div>
  );
}
`;
}

function generateFrontendService(name, plan) {
  return `import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// TODO: Implement ${name} service methods
// Example:
// export const getAll = () => api.get('/items');
// export const create = (data) => api.post('/items', data);
// export const update = (id, data) => api.put(\`/items/\${id}\`, data);
// export const remove = (id) => api.delete(\`/items/\${id}\`);

export default api;
`;
}

function generateServerJs(plan) {
  const models = plan.backend?.models?.map(m => m.name).join(', ') || 'User, Project';
  return `const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const routes = require('./routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
    })
    .catch(err => {
      console.error('MongoDB connection error:', err.message);
    });
} else {
  console.log('No MONGO_URI configured - start server with MONGO_URI env var');
  app.listen(PORT, () => console.log(\`Server running on port \${PORT} (no database)\`));
}

module.exports = app;
`;
}

function generateViteConfig(plan) {
  return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
`;
}

function generateIndexHtml(plan) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${plan.projectName || 'Generated Project'}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

function generateEnvExample(plan) {
  return `# MongoDB
MONGO_URI=mongodb://localhost:27017/${plan.projectName?.toLowerCase().replace(/\s+/g, '_') || 'generated_db'}

# JWT Secret
JWT_SECRET=your-secret-key-change-in-production

# Client URL (for CORS)
CLIENT_URL=http://localhost:5173

# Server Port
PORT=5000
`;
}

function generateReadmeMd(plan) {
  return `# ${plan.projectName || 'Generated Project'}

This project was generated from a UML diagram using AI-powered code generation.

## Generated Structure

### Backend
${plan.backend?.models?.map(m => `- **${m.name}**: Database model`).join('\n') || '- Models generated from diagram entities'}

### Frontend
${plan.frontend?.components?.map(c => `- **${c.name}**: React component`).join('\n') || '- Components generated from diagram'}

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm run install:all
   \`\`\`

2. Set up environment:
   \`\`\`bash
   cd backend && cp .env.example .env
   # Edit .env with your MongoDB URI
   \`\`\`

3. Start development servers:
   \`\`\`bash
   npm run dev
   \`\`\`

## Architecture

Generated based on the following diagram analysis:
- **Entities**: ${plan.backend?.models?.length || 0}
- **Components**: ${plan.frontend?.components?.length || 0}
- **Pages**: ${plan.frontend?.pages?.length || 0}

## Next Steps

1. Review generated code
2. Customize business logic
3. Add authentication/authorization
4. Write tests
5. Deploy to production
`;
}

// --- Type Mapping Helpers ---

function mapType(type) {
  const typeMap = {
    string: 'String',
    number: 'Number',
    integer: 'Number',
    boolean: 'Boolean',
    date: 'Date',
    datetime: 'Date',
    array: '[String]',
    object: 'Object',
    any: 'Schema.Types.Mixed'
  };
  return typeMap[type?.toLowerCase()] || 'String';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
  analyzeDiagram,
  generateCodePlan,
  generateFileContents
};
