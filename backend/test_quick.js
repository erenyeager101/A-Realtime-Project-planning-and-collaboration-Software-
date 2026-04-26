require('dotenv').config();
const { Mistral } = require('@mistralai/mistralai');

console.log('MISTRAL_API_KEY exists:', !!process.env.MISTRAL_API_KEY);
console.log('AI_PROVIDER:', process.env.AI_PROVIDER);

const m = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
m.chat.complete({
  model: 'mistral-small-latest',
  messages: [{ role: 'user', content: 'Reply with JSON: {"msg":"hello"}' }],
  responseFormat: { type: 'json_object' }
}).then(r => {
  console.log('OK:', r.choices[0].message.content);
  process.exit(0);
}).catch(e => {
  console.log('ERR:', e.message);
  process.exit(1);
});
