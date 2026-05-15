const fs = require('fs');
const path = require('path');

const oxfordPath = path.join(__dirname, '..', 'src', 'assets', 'startDB', 'oxford-3000.json');

if (!fs.existsSync(oxfordPath)) {
  console.error(`Oxford source file not found: ${oxfordPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(oxfordPath, 'utf8');
const data = JSON.parse(raw);

if (!Array.isArray(data)) {
  console.error('Oxford source must be a JSON array');
  process.exit(1);
}

const sample = data.slice(0, 10);
const hasCEFR = data.some((entry) => typeof entry === 'string' && /\bA1\b|\bA2\b|\bB1\b|\bB2\b/i.test(entry));
const hasPartOfSpeech = data.some((entry) => typeof entry === 'string' && /\bnoun\b|\bverb\b|\badjective\b|\badverb\b|\bpreposition\b/i.test(entry));

console.log({
  file: oxfordPath,
  entries: data.length,
  sample,
  hasCEFR,
  hasPartOfSpeech,
});
