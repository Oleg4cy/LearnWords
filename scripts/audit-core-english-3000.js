const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, '..', 'src', 'assets', 'startDB', 'core-english-3000.seed.json');

const payload = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const errors = [];

if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
  errors.push('Seed payload must be an object');
}

if (!payload.meta || typeof payload.meta !== 'object' || Array.isArray(payload.meta)) {
  errors.push('meta must exist and be an object');
}

if (!Array.isArray(payload.entries)) {
  errors.push('entries must be an array');
}

const entries = Array.isArray(payload.entries) ? payload.entries : [];
const normalizedSet = new Set();
let duplicateCount = 0;
let entriesWithLevel = 0;
let entriesWithPartOfSpeech = 0;
let entriesWithTranslations = 0;

for (const entry of entries) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    errors.push('each entry must be an object');
    continue;
  }

  if (!entry.word || !String(entry.word).trim()) {
    errors.push('entry missing word');
  }

  if (!entry.normalized || !String(entry.normalized).trim()) {
    errors.push(`entry "${entry.word || '<unknown>'}" missing normalized`);
  }

  const normalized = String(entry.normalized || '').trim().toLowerCase();
  if (normalized) {
    if (normalizedSet.has(normalized)) {
      duplicateCount += 1;
      errors.push(`duplicate normalized value "${normalized}"`);
    } else {
      normalizedSet.add(normalized);
    }
  }

  if (!Array.isArray(entry.sources) || entry.sources.length === 0) {
    errors.push(`entry "${entry.word || '<unknown>'}" must have non-empty sources`);
  }

  if (!Array.isArray(entry.translations)) {
    errors.push(`entry "${entry.word || '<unknown>'}" translations must be an array`);
  } else if (entry.translations.length > 0) {
    entriesWithTranslations += 1;
    for (const translation of entry.translations) {
      if (!translation.language_code) {
        errors.push(`entry "${entry.word || '<unknown>'}" translation missing language_code`);
      }
      if (!translation.value) {
        errors.push(`entry "${entry.word || '<unknown>'}" translation missing value`);
      }
      if (!translation.status) {
        errors.push(`entry "${entry.word || '<unknown>'}" translation missing status`);
      }
    }
  }

  if (entry.level !== null && entry.level !== undefined) {
    entriesWithLevel += 1;
  }

  if (entry.part_of_speech !== null && entry.part_of_speech !== undefined) {
    entriesWithPartOfSpeech += 1;
  }
}

console.log({
  file: seedPath,
  totalEntries: entries.length,
  duplicateCount,
  entriesWithLevel,
  entriesWithPartOfSpeech,
  entriesWithTranslations,
});

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
