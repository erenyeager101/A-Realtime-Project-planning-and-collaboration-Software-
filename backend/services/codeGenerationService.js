/**
 * Code Generation Service
 * Uses Mistral codestral-latest to generate actual code from code plans
 */

const { Mistral } = require('@mistralai/mistralai');

// Mistral client with coding-specific API key
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY_CODING });
const MODEL = process.env.CODESTRAL_MODEL || 'codestral-latest';

/**
 * Generate complete code files from a code plan
 * @param {Object} codePlan - The structured code plan
 * @param {Object} diagramAnalysis - The analyzed diagram data
 * @param {Object} options - Generation options
 * @returns {Array} Generated files with content
 */
async function generateCodeFiles(codePlan, diagramAnalysis, options = {}) {
  const files = [];

  // Generate each file in parallel for efficiency
  const generationTasks = [];

  // Backend files
  for (const model of codePlan.backend?.models || []) {
    generationTasks.push(
      generateBackendModel(model, diagramAnalysis).then(content => ({
        path: `backend/models/${model.name}.js`,
        content
      }))
    );
  }

  for (const controller of codePlan.backend?.controllers || []) {
    generationTasks.push(
      generateBackendController(controller, codePlan, diagramAnalysis).then(content => ({
        path: `backend/controllers/${controller.name}.js`,
        content
      }))
    );
  }

  for (const service of codePlan.backend?.services || []) {
    const serviceName = typeof service === 'string' ? service : (service.name || 'service');
    generationTasks.push(
      generateBackendService(serviceName, codePlan, diagramAnalysis).then(content => ({
        path: `backend/services/${serviceName}Service.js`,
        content
      }))
    );
  }

  // Frontend files
  for (const component of codePlan.frontend?.components || []) {
    generationTasks.push(
      generateFrontendComponent(component, codePlan, diagramAnalysis).then(content => ({
        path: `frontend/src/components/${component.name}.jsx`,
        content
      }))
    );
  }

  for (const page of codePlan.frontend?.pages || []) {
    generationTasks.push(
      generateFrontendPage(page, codePlan, diagramAnalysis).then(content => ({
        path: `frontend/src/pages/${page.name}.jsx`,
        content
      }))
    );
  }

  for (const service of codePlan.frontend?.services || []) {
    generationTasks.push(
      generateFrontendService(service, codePlan).then(content => ({
        path: `frontend/src/services/${service}.js`,
        content
      }))
    );
  }

  // Config and setup files
  generationTasks.push(


    generatePackageJson(codePlan).then(content => ({
      path: 'package.json',
      content
    })),
    generateBackendPackageJson(codePlan).then(content => ({
      path: 'backend/package.json',
      content
    })),
    generateFrontendPackageJson(codePlan).then(content => ({
      path: 'frontend/package.json',
      content
    })),
    generateServerJs(codePlan).then(content => ({
      path: 'backend/server.js',
      content
    })),
    generateAppJsx(codePlan).then(content => ({
      path: 'frontend/src/App.jsx',
      content
    })),
    generateMainJsx(codePlan).then(content => ({
      path: 'frontend/src/main.jsx',
      content
    })),
    generateEnvExample(codePlan).then(content => ({
      path: 'backend/.env.example',
      content
    })),
    generateViteConfig(codePlan).then(content => ({
      path: 'frontend/vite.config.js',
      content
    })),
    generateEsLintConfig(codePlan).then(content => ({
      path: 'frontend/.eslintrc.js',
      content
    })),
    generateREADME(codePlan, diagramAnalysis).then(content => ({
      path: 'README.md',
      content
    }))
  );

  // Execute all generation tasks
  const results = await Promise.all(generationTasks);
  files.push(...results);

  return files;
}

/**
 * Generate a backend model using AI
 */
async function generateBackendModel(model, diagramAnalysis) {
  const relatedEntities = diagramAnalysis?.entities
    ?.filter(e => e.name !== model.name)
    ?.map(e => e.name)
    ?.join(', ') || '';

  const entity = diagramAnalysis?.entities?.find(e =>
    e.name.toLowerCase() === model.name.toLowerCase()
  ) || {};

  const prompt = `Generate a complete Mongoose model file for '${model.name}'.

Context from UML diagram:
- Entity type: ${entity.type || 'Class'}
- Attributes: ${JSON.stringify(entity.attributes || [], null, 2)}
- Methods: ${JSON.stringify(entity.methods || [], null, 2)}
- Description: ${entity.description || 'N/A'}

Related entities: ${relatedEntities}

Requirements:
- Use proper Mongoose schema definitions
- Include timestamps
- Add validation rules based on attribute types
- Add reference fields for relationships
- Export the model correctly
- Include JSDoc comments

Generate the complete JavaScript file content:`;

  const response = await mistral.chat.complete({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an expert Node.js/Mongoose developer. Generate clean, production-ready code with proper error handling and documentation. Output only the code, no explanations.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    maxTokens: 4096
  });

  return formatCodeOutput(response.choices[0].message.content);
}

/**
 * Generate a backend controller using AI
 */
async function generateBackendController(controller, codePlan, diagramAnalysis) {
  const modelName = controller.model || controller.name.replace('Controller', '');
  const routes = controller.routes || [
    { method: 'GET', path: `/api/${modelName.toLowerCase()}s` },
    { method: 'GET', path: `/api/${modelName.toLowerCase()}s/:id` },
    { method: 'POST', path: `/api/${modelName.toLowerCase()}s` },
    { method: 'PUT', path: `/api/${modelName.toLowerCase()}s/:id` },
    { method: 'DELETE', path: `/api/${modelName.toLowerCase()}s/:id` }
  ];

  const prompt = `Generate a complete Express controller '${controller.name}' for model '${modelName}'.

Routes needed:
${routes.map(r => `- ${r.method} ${r.path}`).join('\n')}

Context from diagram:
- Framework: Express.js
- Database: MongoDB with Mongoose
- Should follow REST conventions
- Include proper error handling (async/await)
- Respond with JSON
- Use status codes appropriately

Generate complete ${controller.name}.js file:`;

  const response = await mistral.chat.complete({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an expert Express.js developer. Generate clean REST API controllers with proper error handling, input validation, and meaningful response messages. Output only the code.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    maxTokens: 4096
  });

  return formatCodeOutput(response.choices[0].message.content);
}

/**
 * Generate a backend service using AI
 */
async function generateBackendService(serviceName, codePlan, diagramAnalysis) {
  const prompt = `Generate a backend service '${serviceName}' for an Express/Mongoose application.

This service should:
- Encapsulate business logic
- Perform database operations
- Handle errors appropriately
- Be reusable across controllers

Generate complete service file:${serviceName}.js containing valid business logic:`;

  const response = await mistral.chat.complete({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an expert Node.js developer. Generate clean service layer code following the service pattern. Output only the code.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    maxTokens: 4096
  });

  return formatCodeOutput(response.choices[0].message.content);
}

/**
 * Generate a React component using AI
 */
async function generateFrontendComponent(component, codePlan, diagramAnalysis) {
  const entity = diagramAnalysis?.entities?.find(e =>
    component.name.toLowerCase().includes(e.name.toLowerCase())
  );

  const prompt = `Generate a complete React component '${component.name}' in JSX format.

Component details:
- Props: ${JSON.stringify(component.props || [])}
- State: ${JSON.stringify(component.state || [])}
${entity ? `- Related entity: ${entity.name} (${entity.description || 'N/A'})` : ''}

Requirements:
- Use modern React (hooks only, no class components)
- Include PropTypes or JSDoc types
- Add helpful comments
- Handle loading and error states
- Use semantic HTML
- Responsive Tailwind CSS classes

Generate complete ${component.name}.jsx:`;

  const response = await mistral.chat.complete({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an expert React developer. Generate clean, modern React components using hooks. Include proper JSX structure and meaningful component organization. Output only the code.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    maxTokens: 4096
  });

  return formatCodeOutput(response.choices[0].message.content);
}

/**
 * Generate a React page using AI
 */
async function generateFrontendPage(page, codePlan, diagramAnalysis) {
  const prompt = `Generate a complete React page component '${page.name}'.

Page details:
- Route: ${page.route}
- Related components: ${codePlan.frontend?.components?.map(c => c.name).join(', ') || 'None specified'}

Requirements:
- Use React Router for navigation
- Import and use relevant components
- Include page layout structure
- Handle data fetching if needed
- Responsive design with Tailwind CSS

Generate complete ${page.name}.jsx:`;

  const response = await mistral.chat.complete({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an expert React developer. Generate complete page components that import and compose other components effectively. Use modern React patterns. Output only the code.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    maxTokens: 4096
  });

  return formatCodeOutput(response.choices[0].message.content);
}

/**
 * Generate a frontend API service using AI
 */
async function generateFrontendService(serviceName, codePlan) {
  const prompt = `Generate a frontend API service '${serviceName}' for a React application.

Requirements:
- Use axios for HTTP requests
- Define base API URL from environment variable
- Include CRUD operations (list, get, create, update, delete)
- Add error handling
- Return promises
- Export both default export and named exports

Generate complete ${serviceName}.js:`;

  const response = await mistral.chat.complete({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an expert frontend developer. Generate clean API service layers with proper axios configuration and error handling. Output only the code.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    maxTokens: 4096
  });

  return formatCodeOutput(response.choices[0].message.content);
}

/**
 * Generate root package.json
 */
async function generatePackageJson(codePlan) {
  const name = codePlan.projectName?.toLowerCase().replace(/\s+/g, '-') || 'generated-project';

  return JSON.stringify({
    name: name,
    version: '1.0.0',
    description: `Generated from UML diagram - ${codePlan.projectName}`,
    scripts: {
      "install:all": "cd backend && npm install && cd ../frontend && npm install",
      "dev": "concurrently \"cd backend && npm run dev\" \"cd frontend && npm run dev\"",
      "build": "cd frontend && npm run build",
      "start": "cd backend && npm start"
    },
    devDependencies: {
      concurrently: "^8.2.2"
    }
  }, null, 2);
}

/**
 * Generate backend package.json
 */
async function generateBackendPackageJson(codePlan) {
  const name = codePlan.backend?.models?.[0]?.name?.toLowerCase() || 'api';

  return JSON.stringify({
    name: `${name}-backend`,
    version: '1.0.0',
    description: 'Generated backend API',
    main: 'server.js',
    scripts: {
      start: 'node server.js',
      dev: 'nodemon server.js'
    },
    dependencies: {
      express: '^4.18.2',
      mongoose: '^8.0.0',
      cors: '^2.8.5',
      dotenv: '^16.3.1',
      bcryptjs: '^2.4.3',
      jsonwebtoken: '^9.0.2',
      'express-validator': '^7.0.1'
    },
    devDependencies: {
      nodemon: '^3.0.1'
    }
  }, null, 2);
}

/**
 * Generate frontend package.json
 */
async function generateFrontendPackageJson(codePlan) {
  const name = codePlan.projectName?.toLowerCase().replace(/\s+/g, '-') || 'app';

  return JSON.stringify({
    name: `${name}-frontend`,
    private: true,
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      lint: 'eslint . --ext .js,.jsx --report-unused-disable-directives --max-warnings 0',
      preview: 'vite preview'
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      'react-router-dom': '^6.20.0',
      axios: '^1.6.2',
      tailwindcss: '^3.3.0'
    },
    devDependencies: {
      '@types/react': '^18.2.43',
      '@types/react-dom': '^18.2.17',
      '@vitejs/plugin-react': '^4.2.1',
      eslint: '^8.55.0',
      'eslint-plugin-react-hooks': '^4.6.0',
      'eslint-plugin-react-refresh': '^0.4.5',
      vite: '^5.0.8',
      'eslint-plugin-react': '^7.33.2'
    }
  }, null, 2);
}

/**
 * Generate server.js
 */
async function generateServerJs(codePlan) {
  const modelImports = codePlan.backend?.models?.map(m =>
    `const ${m.name} = require('./models/${m.name}');`
  ).join('\n') || '';

  const controllerImports = codePlan.backend?.controllers?.map(c =>
    `const ${c.name.toLowerCase()}Routes = require('./routes/${c.name.toLowerCase()}Routes');`
  ).join('\n') || '';

  return `const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import models
${modelImports}

// Import routes
${controllerImports}

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173'
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mount routes
${codePlan.backend?.controllers?.map(c => `app.use('/api/${c.name.toLowerCase().replace('controller', '')}s', ${c.name.toLowerCase()}Routes);`).join('\n') || '// Routes will be added here'}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

async function startServer() {
  try {
    if (MONGO_URI) {
      await mongoose.connect(MONGO_URI);
      console.log('✅ Connected to MongoDB');
    } else {
      console.log('⚠️ No MONGO_URI provided, starting without database');
    }

    app.listen(PORT, () => {
      console.log(\`🚀 Server running on port \${PORT}\`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
`;
}

/**
 * Generate App.jsx
 */
async function generateAppJsx(codePlan) {
  const imports = codePlan.frontend?.pages?.map(p =>
    `import ${p.name} from './pages/${p.name}';`
  ).join('\n') || '';

  const routes = codePlan.frontend?.pages?.map(p =>
    `      <Route path="${p.route}" element={<${p.name} />} />`
  ).join('\n') || '';

  return `import { BrowserRouter, Routes, Route } from 'react-router-dom';
${imports}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
${routes}
          <Route path="/" element={<Navigate to="${codePlan.frontend?.pages?.[0]?.route || '/dashboard'}" />} />
          <Route path="*" element={<div className="text-center py-20">404 - Page Not Found</div>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
`;
}

/**
 * Generate main.jsx
 */
async function generateMainJsx(codePlan) {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
}

/**
 * Generate .env.example
 */
async function generateEnvExample(codePlan) {
  const dbName = codePlan.projectName?.toLowerCase().replace(/\s+/g, '_') || 'generated_db';

  return `# Server Configuration
PORT=5000

# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/${dbName}

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# CORS
CLIENT_URL=http://localhost:5173

# Email (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Cloud Storage (optional)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
`;
}

/**
 * Generate Vite config
 */
async function generateViteConfig(codePlan) {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
`;
}

/**
 * Generate ESLint config
 */
async function generateEsLintConfig(codePlan) {
  return `module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'off',
  },
};
`;
}

/**
 * Generate README.md
 */
async function generateREADME(codePlan, diagramAnalysis) {
  return `# ${codePlan.projectName}

${codePlan.projectName} was generated from UML architecture diagrams using AI-powered code generation.

## 📋 Generated From

**Diagram Analysis:**
- **Diagram Type**: ${diagramAnalysis.diagramType}
- **Target Languages**: ${diagramAnalysis.languages?.join(', ') || 'JavaScript'}
- **Entities**: ${diagramAnalysis.entities?.length || 0}
- **Relationships**: ${diagramAnalysis.relationships?.length || 0}
- **Architectural Patterns**: ${diagramAnalysis.architecture?.patterns?.join(', ') || 'N/A'}

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Git

### Installation

1. Clone the repository:
\`\`\`bash
git clone <your-repo-url>
cd ${codePlan.projectName?.toLowerCase().replace(/\s+/g, '-') || 'generated-project'}
\`\`\`

2. Install all dependencies:
\`\`\`bash
npm run install:all
\`\`\`

3. Set up environment variables:
\`\`\`bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and other settings
\`\`\`

4. Start development servers:
\`\`\`bash
npm run dev
\`\`\`

This will start:
- Backend: http://localhost:5000
- Frontend: http://localhost:5173

## 📁 Project Structure

\`\`\`
├── backend/
│   ├── controllers/      # Express controllers
│   ├── models/           # Mongoose models
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── server.js         # Entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   └── App.jsx       # App component
│   └── package.json
│
└── README.md
\`\`\`

## 🏗️ Backend Models

${codePlan.backend?.models?.map(m => `- **${m.name}**: ${m.description || 'Generated model'}`).join('\n') || 'Models generated from diagram entities'}

## 🎨 Frontend Components

${codePlan.frontend?.components?.map(c => `- **${c.name}**: ${c.description || 'Generated component'}`).join('\n') || 'Components generated from diagram'}

## 🔧 Customization

The generated code provides a solid foundation. You'll likely want to:

1. **Add Authentication**: Implement JWT-based auth or OAuth
2. **Add Validation**: Enhance input validation using express-validator or Joi
3. **Add Tests**: Write unit and integration tests
4. **Customize UI**: Update Tailwind styles and layouts
5. **Add Features**: Implement business-specific logic

## 🧪 Running Tests

\`\`\`bash
# Backend tests
cd backend
npm test

# Frontend tests
cd ../frontend
npm test
\`\`\`

## 📝 API Documentation

All API endpoints are prefixed with \`/api\`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
${codePlan.backend?.controllers?.map(c =>
  c.routes?.map(r =>
    `| ${r.method} | ${r.path} | ${c.name} ${r.method.toLowerCase()} |`
  ).join('\n')
).join('\n') || ''}

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: \`git checkout -b feature/amazing-feature\`
3. Commit your changes: \`git commit -m 'Add amazing feature'\`
4. Push to the branch: \`git push origin feature/amazing-feature\`
5. Open a Pull Request

## 📄 License

This project is generated from architectural diagrams. Customize as needed for your use case.

---

*Generated with ❤️ by AI-powered code generation*
`;
}

/**
 * Helper: Format code output by removing markdown fences if present
 */
function formatCodeOutput(content) {
  if (!content) return '';
  let cleaned = content.trim();

  // Remove markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:\w+)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  if (cleaned.startsWith('```javascript')) {
    cleaned = cleaned.replace(/^```javascript\s*/i, '').replace(/```\s*$/, '').trim();
  }
  if (cleaned.startsWith('```jsx')) {
    cleaned = cleaned.replace(/^```jsx\s*/i, '').replace(/```\s*$/, '').trim();
  }
  if (cleaned.startsWith('```js')) {
    cleaned = cleaned.replace(/^```js\s*/i, '').replace(/```\s*$/, '').trim();
  }

  return cleaned;
}

module.exports = {
  generateCodeFiles
};
