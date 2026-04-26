/**
 * Test script for diagram code generation feature
 * Tests the full workflow without GitHub integration
 */

require('dotenv').config();

const { analyzeDiagram, generateCodePlan } = require('./services/diagramAnalysisService');
const { generateCodeFiles } = require('./services/codeGenerationService');
const path = require('path');
const fs = require('fs');

// Create a test image path (you'll need an actual diagram image)
const TEST_IMAGE_PATH = process.argv[2];

async function testPipeline() {
  console.log('🧪 Testing Diagram Code Generation Pipeline\n');

  let step = 1;

  try {
    // Step 1: Validate input
    console.log(`Step ${step++}: Validating input...`);
    if (!TEST_IMAGE_PATH) {
      console.error('❌ Please provide a diagram image path:');
      console.error('   node test_diagram_generation.js <path-to-image>');
      process.exit(1);
    }

    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.error(`❌ File not found: ${TEST_IMAGE_PATH}`);
      process.exit(1);
    }

    console.log(`✅ Using image: ${TEST_IMAGE_PATH}\n`);

    // Step 2: Analyze diagram
    console.log(`Step ${step++}: Analyzing diagram with Mistral...`);
    const analysis = await analyzeDiagram(TEST_IMAGE_PATH, 'auto-detect');
    console.log('✅ Analysis complete!');
    console.log('   Detected type:', analysis.diagramType);
    console.log('   Entities:', analysis.entities?.length);
    console.log('   Relationships:', analysis.relationships?.length);
    console.log('   Patterns:', analysis.architecture?.patterns?.join(', ') || 'None detected');
    console.log('   Languages:', analysis.languages?.join(', ') || 'JavaScript');
    console.log('');

    // Save analysis for debugging
    fs.writeFileSync(
      path.join(__dirname, 'test_output_analysis.json'),
      JSON.stringify(analysis, null, 2)
    );
    console.log('📝 Saved analysis to test_output_analysis.json\n');

    // Step 3: Generate code plan
    console.log(`Step ${step++}: Generating code plan...`);
    const codePlan = await generateCodePlan(analysis, {
      targetLanguage: 'javascript',
      targetFramework: 'express-react-mongodb',
      includeTests: true,
      includeDocs: true
    });
    console.log('✅ Code plan generated!');
    console.log('   Project name:', codePlan.projectName);
    console.log('   Backend models:', codePlan.backend?.models?.length || 0);
    console.log('   Backend controllers:', codePlan.backend?.controllers?.length || 0);
    console.log('   Frontend components:', codePlan.frontend?.components?.length || 0);
    console.log('   Frontend pages:', codePlan.frontend?.pages?.length || 0);
    console.log('');

    // Save code plan for debugging
    fs.writeFileSync(
      path.join(__dirname, 'test_output_codeplan.json'),
      JSON.stringify(codePlan, null, 2)
    );
    console.log('📝 Saved code plan to test_output_codeplan.json\n');

    // Step 4: Generate actual code files
    console.log(`Step ${step++}: Generating code files with Codestral...`);
    console.log('   This may take 30-60 seconds...\n');

    const files = await generateCodeFiles(codePlan, analysis, { includeTests: true });

    console.log('✅ Code files generated!');
    console.log('   Total files:', files.length);
    console.log('   Backend files:', files.filter(f => f.path.startsWith('backend/')).length);
    console.log('   Frontend files:', files.filter(f => f.path.startsWith('frontend/')).length);
    console.log('   Config files:', files.filter(f => !f.path.includes('/')).length);

    // Group by directory
    const groups = {};
    for (const file of files) {
      const dir = file.path.split('/')[0];
      if (!groups[dir]) groups[dir] = [];
      groups[dir].push(file.path);
    }

    console.log('\n📁 Generated structure:');
    for (const [dir, paths] of Object.entries(groups)) {
      console.log(`   ${dir}/ (${paths.length} files)`);
    }

    // Save file listing
    fs.writeFileSync(
      path.join(__dirname, 'test_output_files.json'),
      JSON.stringify(files.map(f => ({ path: f.path, size: f.content.length })), null, 2)
    );
    console.log('\n📝 Saved file manifest to test_output_files.json');

    // Save a sample file content for verification
    const serverJs = files.find(f => f.path === 'backend/server.js');
    if (serverJs) {
      fs.writeFileSync(
        path.join(__dirname, 'test_output_sample_server.js'),
        serverJs.content
      );
      console.log('📝 Saved sample server.js to test_output_sample_server.js');
    }

    console.log('\n✅ Pipeline test completed successfully!');
    console.log('\n📌 Next steps:');
    console.log('   1. Review generated files in test_output_*.json');
    console.log('   2. Test on a real project with GitHub integration');
    console.log('   3. Check sample code quality in test_output_sample_server.js');

  } catch (error) {
    console.error('\n❌ Pipeline test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testPipeline();
