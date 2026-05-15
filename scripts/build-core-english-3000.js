const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'src', 'assets', 'startDB', 'oxford-3000.json');
const targetPath = path.join(__dirname, '..', 'src', 'assets', 'startDB', 'core-english-3000.seed.json');

const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

if (!Array.isArray(raw)) {
  console.error('Oxford 3000 source must be a JSON array');
  process.exit(1);
}

const seen = new Set();
let duplicatesRemoved = 0;

const entries = raw
  .map((entry) => {
    if (typeof entry !== 'string') {
      console.error('Oxford 3000 source must contain only strings');
      process.exit(1);
    }
    return entry.trim();
  })
  .filter(Boolean)
  .filter((word) => {
    const key = word.toLowerCase();
    if (seen.has(key)) {
      duplicatesRemoved += 1;
      return false;
    }
    seen.add(key);
    return true;
  })
  .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  .map((word) => ({
    word,
    normalized: word.toLowerCase(),
    part_of_speech: null,
    level: null,
    rank: null,
    sources: ['oxford3000'],
    translations: [],
  }));

const payload = {
  meta: {
    id: 'core-english-3000',
    name: 'Core English 3000',
    version: 1,
    base_language: 'en',
    description: 'Normalized starter English vocabulary based on the bundled Oxford 3000 source list.',
    sources: ['oxford3000'],
  },
  entries,
};

fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log({
  sourcePath,
  targetPath,
  rawEntries: raw.length,
  generatedEntries: entries.length,
  duplicatesRemoved,
});
