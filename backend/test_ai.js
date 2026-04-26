require('dotenv').config();
const { generateProjectPack } = require('./services/aiService');

console.log('Testing generateProjectPack via chat() with fallback chain...');
console.log('Primary provider:', process.env.AI_PROVIDER);

generateProjectPack('Simple Todo app with MERN stack', {})
  .then((r) => {
    console.log('SUCCESS! Type:', typeof r);
    console.log('Keys:', Object.keys(r));
    console.log('Project Name:', r.projectName);
    console.log('Modules:', r.modules?.length);
    process.exit(0);
  })
  .catch((e) => {
    console.error('FAIL:', e.message);
    console.error('Stack:', e.stack?.split('\n').slice(0, 5).join('\n'));
    process.exit(1);
  });
