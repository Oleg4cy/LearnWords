const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, '..', 'src', 'assets', 'startDB', 'core-english-3000.seed.json');
const translationSeedPath = path.join(
  __dirname,
  '..',
  'src',
  'assets',
  'translations',
  'core-english-3000.ru.seed.json',
);
const topicSeedPath = path.join(
  __dirname,
  '..',
  'src',
  'assets',
  'topics',
  'core-english-3000.topics.seed.json',
);

const payload = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const translationPayload = fs.existsSync(translationSeedPath)
  ? JSON.parse(fs.readFileSync(translationSeedPath, 'utf8'))
  : null;
const topicPayload = fs.existsSync(topicSeedPath)
  ? JSON.parse(fs.readFileSync(topicSeedPath, 'utf8'))
  : null;
const errors = [];
const topicIds = new Set();

function validateTranslation(translation, label) {
  if (!translation || typeof translation !== 'object' || Array.isArray(translation)) {
    errors.push(`${label} must be an object`);
    return;
  }

  if (!translation.language_code) {
    errors.push(`${label} missing language_code`);
  }
  if (!translation.value) {
    errors.push(`${label} missing value`);
  }
  if (!translation.status) {
    errors.push(`${label} missing status`);
  }
  if (translation.example !== undefined && typeof translation.example !== 'string') {
    errors.push(`${label} example must be a string if present`);
  }
  if (
    translation.example_translation !== undefined &&
    typeof translation.example_translation !== 'string'
  ) {
    errors.push(`${label} example_translation must be a string if present`);
  }
  if (translation.context !== undefined && typeof translation.context !== 'string') {
    errors.push(`${label} context must be a string if present`);
  }
  if (translation.topics !== undefined && !Array.isArray(translation.topics)) {
    errors.push(`${label} topics must be an array if present`);
    return;
  }

  if (Array.isArray(translation.topics) && topicIds.size > 0) {
    for (const topicId of translation.topics) {
      if (!topicIds.has(topicId)) {
        errors.push(`${label} references unknown topic "${topicId}"`);
      }
    }
  }
}

if (topicPayload !== null) {
  if (!topicPayload || typeof topicPayload !== 'object' || Array.isArray(topicPayload)) {
    errors.push('topic payload must be an object');
  } else if (!Array.isArray(topicPayload.topics)) {
    errors.push('topic payload topics must be an array');
  } else {
    for (const topic of topicPayload.topics) {
      if (!topic || typeof topic !== 'object' || Array.isArray(topic)) {
        errors.push('each topic must be an object');
        continue;
      }

      if (!topic.id || !String(topic.id).trim()) {
        errors.push('topic missing id');
        continue;
      }

      topicIds.add(String(topic.id));
    }
  }
}

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
const wordSet = new Set();
const translationWordSet = new Set();
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

  const entryWord = String(entry.word || '').trim();
  if (entryWord) {
    wordSet.add(entryWord);
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
      validateTranslation(translation, `entry "${entry.word || '<unknown>'}" translation`);
    }
  }

  if (entry.level !== null && entry.level !== undefined) {
    entriesWithLevel += 1;
  }

  if (entry.part_of_speech !== null && entry.part_of_speech !== undefined) {
    entriesWithPartOfSpeech += 1;
  }
}

if (translationPayload !== null) {
  if (
    !translationPayload ||
    typeof translationPayload !== 'object' ||
    Array.isArray(translationPayload)
  ) {
    errors.push('translation payload must be an object');
  } else if (!Array.isArray(translationPayload.translations)) {
    errors.push('translation payload translations must be an array');
  } else {
    for (const entry of translationPayload.translations) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        errors.push('each translation seed entry must be an object');
        continue;
      }

      if (!entry.word || !String(entry.word).trim()) {
        errors.push('translation seed entry missing word');
      }

      const translationWord = String(entry.word || '').trim();
      if (translationWord) {
        if (translationWordSet.has(translationWord)) {
          errors.push(`duplicate translation seed entry "${translationWord}"`);
        } else {
          translationWordSet.add(translationWord);
        }

        if (!wordSet.has(translationWord)) {
          errors.push(`translation seed entry "${translationWord}" is missing in base seed`);
        }
      }

      if (!Array.isArray(entry.translations)) {
        errors.push(`translation seed entry "${entry.word || '<unknown>'}" translations must be an array`);
        continue;
      }

      for (const translation of entry.translations) {
        validateTranslation(
          translation,
          `translation seed entry "${entry.word || '<unknown>'}" translation`,
        );
      }
    }
  }
}

console.log({
  file: seedPath,
  translationSeedPath: translationPayload ? translationSeedPath : null,
  topicSeedPath: topicPayload ? topicSeedPath : null,
  totalEntries: entries.length,
  duplicateCount,
  entriesWithLevel,
  entriesWithPartOfSpeech,
  entriesWithTranslations,
  loadedTopics: topicIds.size,
  translationSeedEntries:
    translationPayload && Array.isArray(translationPayload.translations)
      ? translationPayload.translations.length
      : 0,
});

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
