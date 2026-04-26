/**
 * Test script for code generation pipeline
 * Tests with mock diagram analysis since we don't have a real UML image
 */

require('dotenv').config();

const { generateCodeFiles } = require('./services/codeGenerationService');
const { generateCodePlan } = require('./services/diagramAnalysisService');
const fs = require('fs');
const path = require('path');

// Mock diagram analysis (simulating what would come from image analysis)
const mockDiagramAnalysis = {
  diagramType: 'uml-class',
  languages: ['JavaScript', 'TypeScript'],
  entities: [
    {
      name: 'User',
      type: 'class',
      attributes: [
        { name: 'id', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'role', type: 'string' },
        { name: 'createdAt', type: 'date' }
      ],
      methods: [
        { name: 'validatePassword', params: [{ name: 'password', type: 'string' }], returnType: 'boolean' },
        { name: 'generateToken', returnType: 'string' }
      ],
      description: 'User entity with authentication'
    },
    {
      name: 'Project',
      type: 'class',
      attributes: [
        { name: 'id', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'dueDate', type: 'date' }
      ],
      methods: [
        { name: 'addMember', params: [{ name: 'userId', type: 'string' }], returnType: 'void' },
        { name: 'updateStatus', params: [{ name: 'status', type: 'string' }], returnType: 'void' }
      ],
      description: 'Project entity for managing tasks'
    },
    {
      name: 'Task',
      type: 'class',
      attributes: [
        { name: 'id', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'priority', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'assigneeId', type: 'string' }
      ],
      methods: [
        { name: 'assignTo', params: [{ name: 'userId', type: 'string' }], returnType: 'void' },
        { name: 'addComment', params: [{ name: 'comment', type: 'string' }], returnType: 'void' }
      ],
      description: 'Task entity within a project'
    }
  ],
  relationships: [
    { source: 'Project', target: 'User', type: 'composition', multiplicity: '1..*' },
    { source: 'Task', target: 'Project', type: 'composition', multiplicity: '1' },
    { source: 'Task', target: 'User', type: 'association', multiplicity: '0..1' }
  ],
  architecture: {
    layers: ['presentation', 'business', 'data'],
    patterns: ['MVC', 'Repository', 'Service Layer'],
    frameworks: ['Express', 'React', 'MongoDB']
  },
  dataFlow: [
    { from: 'Frontend', to: 'API', description: 'REST API calls' },
    { from: 'API', to: 'Database', description: 'Mongoose queries' }
  ]
};

async function testCodeGeneration() {
  console.log('🧪 Testing Code Generation Pipeline\n');
  console.log('====================================\n');

  const startTime = Date.now();

  try {
    // Step 1: Generate code plan from mock analysis
    console.log('Step 1: Generating code plan from diagram analysis...');
    const codePlan = await generateCodePlan(mockDiagramAnalysis, {
      targetLanguage: 'javascript',
      targetFramework: 'express-react-mongodb',
      includeTests: true,
      includeDocs: true
    });
    console.log('✅ Code plan generated');
    console.log('   Project name:', codePlan.projectName);
    console.log('   Backend models:', codePlan.backend?.models?.length || 0);
    console.log('   Frontend components:', codePlan.frontend?.components?.length || 0);
    console.log('');

    // Save code plan
    fs.writeFileSync(
      path.join(__dirname, 'test_output_codeplan.json'),
      JSON.stringify(codePlan, null, 2)
    );
    console.log('📝 Saved code plan to test_output_codeplan.json\n');

    // Step 2: Generate actual code files
    console.log('Step 2: Generating code files with Codestral...');
    console.log('   (This may take 30-60 seconds for ~15 files)\n');

    const files = await generateCodeFiles(codePlan, mockDiagramAnalysis, {
      includeTests: true
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Code files generated (${duration}ms)`);
    console.log('   Total files:', files.length);

    // Count by category
    const counts = {
      backend: files.filter(f => f.path.startsWith('backend/')).length,
      frontend: files.filter(f => f.path.startsWith('frontend/')).length,
      root: files.filter(f => !f.path.includes('/')).length
    };
    console.log('   Backend files:', counts.backend);
    console.log('   Frontend files:', counts.frontend);
    console.log('   Root config files:', counts.root);

    // Show file structure
    console.log('\n📁 Generated file structure:');
    const structure = {};
    for (const file of files) {
      const parts = file.path.split('/');
      const dir = parts[0];
      if (!structure[dir]) structure[dir] = [];
      structure[dir].push(file.path);
    }
    for (const [dir, paths] of Object.entries(structure)) {
      console.log(`   ${dir}/ (${paths.length} files)`);
      if (paths.length <= 5) {
        paths.forEach(p => console.log(`      - ${p.split('/').pop()}`));
      } else {
        console.log(`      - ... ${paths.length} files total`);
      }
    }

    // Save file manifest
    fs.writeFileSync(
      path.join(__dirname, 'test_output_files.json'),
      JSON.stringify(files.map(f => ({
        path: f.path,
        size: f.content.length,
        preview: f.content.substring(0, 200) + (f.content.length > 200 ? '...' : '')
      })), null, 2)
    );
    console.log('\n📝 Saved file manifest to test_output_files.json');

    // Step 3: Save sample files for review
    console.log('\nStep 3: Saving sample files...');
    const samples = [
      files.find(f => f.path === 'backend/server.js'),
      files.find(f => f.path.includes('models/') && f.path.endsWith('.js')),
      files.find(f => f.path === 'backend/package.json'),
      files.find(f => f.path === 'frontend/src/App.jsx'),
      files.find(f => f.path === 'README.md')
    ];

    const samplesDir = path.join(__dirname, 'test_samples');
    if (!fs.existsSync(samplesDir)) fs.mkdirSync(samplesDir, { recursive: true });

    for (const sample of samples) {
      if (sample) {
        const sampleName = sample.path.replace(/\//g, '_');
        fs.writeFileSync(path.join(samplesDir, sampleName), sample.content);
        console.log(`   📝 Saved sample: ${sample.path}`);
      }
    }
    console.log(`   📂 All samples saved to: test_samples/`);

    // Step 4: Run validation
    console.log('\nStep 4: Validating generated files...');
    const validation = validateGeneratedFiles(files);
    if (validation.valid) {
      console.log('✅ File structure is valid');
    } else {
      console.log('⚠️ Missing recommended files:', validation.missing.join(', '));
    }

    // Final stats
    console.log('\n====================================');
    console.log('✅ Test completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Total files: ${files.length}`);
    console.log(`   Backend: ${counts.backend}, Frontend: ${counts.frontend}`);
    console.log(`   Total code size: ${files.reduce((sum, f) => sum + f.content.length, 0).toLocaleString()} bytes`);
    console.log(`   Duration: ${duration}ms`);
    console.log('\n📌 Next steps:');
    console.log('   Review sample files in test_samples/');
    console.log('   Check test_output_files.json for full manifest');
    console.log('   Connect to GitHub to push this code to a branch');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function validateGeneratedFiles(files) {
  const required = ['backend/package.json', 'frontend/package.json', 'README.md'];
  const present = new Set(files.map(f => f.path));
  const missing = required.filter(r => !present.has(r));
  return { valid: missing.length === 0, missing };
}

// Run the test
testCodeGeneration();
