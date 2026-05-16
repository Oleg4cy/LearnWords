#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const SOURCE_SEED_PATH = path.join(
  ROOT_DIR,
  'src',
  'assets',
  'startDB',
  'core-english-3000.seed.json',
);
const TOPIC_SEED_PATH = path.join(
  ROOT_DIR,
  'src',
  'assets',
  'topics',
  'core-english-3000.topics.seed.json',
);
const TRANSLATION_PACK_PATH = path.join(
  ROOT_DIR,
  'src',
  'assets',
  'translations',
  'core-english-3000.ru.seed.json',
);
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

const DEFAULT_DRY_RUN_LIMIT = 3;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

const OPERATION_GENERATE = 'generate';
const OPERATION_SUGGEST_TOPICS = 'suggest-topics';
const OPERATION_RECLASSIFY_TOPICS = 'reclassify-topics';
const OPERATION_REGENERATE_CONTEXT = 'regenerate-context';
const OPERATION_REGENERATE_EXAMPLES = 'regenerate-examples';
const OPERATION_VERIFY_TRANSLATIONS = 'verify-translations';
const TOPIC_SUGGESTION_PRESETS = new Map([
  [
    'clothing',
    {
      name: 'Clothing & Accessories',
      description:
        'Clothes, shoes, accessories, garments, dressing, and wearable personal items.',
    },
  ],
  [
    'entertainment',
    {
      name: 'Entertainment & Leisure',
      description:
        'Theater, cinema, games, hobbies, leisure activities, performances, shows, and fun.',
    },
  ],
]);

class UnknownTopicsError extends Error {
  constructor({message, unknownTopics}) {
    super(message);
    this.name = 'UnknownTopicsError';
    this.unknownTopics = unknownTopics;
  }
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const options = {
    provider: readStringFlag(argv, '--provider', null),
    dryRun,
    yes: argv.includes('--yes'),
    force: argv.includes('--force'),
    batchSize: readNumberFlag(argv, '--batch-size', DEFAULT_BATCH_SIZE),
    limit: readOptionalNumberFlag(argv, '--limit', dryRun ? DEFAULT_DRY_RUN_LIMIT : null),
    model: readStringFlag(argv, '--model', DEFAULT_DEEPSEEK_MODEL),
    maxRetries: readNumberFlag(argv, '--max-retries', DEFAULT_MAX_RETRIES),
    temperature: readFloatFlag(argv, '--temperature', DEFAULT_TEMPERATURE),
    suggestTopics: argv.includes('--suggest-topics'),
    appendSuggestedTopics: argv.includes('--append-suggested-topics'),
    reclassifyTopics: argv.includes('--reclassify-topics'),
    regenerateContext: argv.includes('--regenerate-context'),
    regenerateExamples: argv.includes('--regenerate-examples'),
    verifyTranslations: argv.includes('--verify-translations'),
    onlyTopic: readStringFlag(argv, '--only-topic', null),
    onlyWords: readCsvFlag(argv, '--only-words'),
    onlyMissingTopics: argv.includes('--only-missing-topics'),
  };

  options.operation = resolveOperation(options);
  validateOptionCompatibility(options);
  return options;
}

function resolveOperation(options) {
  const enabledOperations = [
    options.suggestTopics ? OPERATION_SUGGEST_TOPICS : null,
    options.reclassifyTopics ? OPERATION_RECLASSIFY_TOPICS : null,
    options.regenerateContext ? OPERATION_REGENERATE_CONTEXT : null,
    options.regenerateExamples ? OPERATION_REGENERATE_EXAMPLES : null,
    options.verifyTranslations ? OPERATION_VERIFY_TRANSLATIONS : null,
  ].filter(Boolean);

  if (enabledOperations.length > 1) {
    throw new Error(`Only one selective mode may be enabled at a time: ${enabledOperations.join(', ')}`);
  }

  return enabledOperations[0] || OPERATION_GENERATE;
}

function validateOptionCompatibility(options) {
  if (options.appendSuggestedTopics && !options.suggestTopics) {
    throw new Error('--append-suggested-topics requires --suggest-topics');
  }
  if (
    options.operation !== OPERATION_RECLASSIFY_TOPICS &&
    (options.onlyTopic !== null || options.onlyMissingTopics)
  ) {
    throw new Error('--only-topic and --only-missing-topics are supported only with --reclassify-topics');
  }
}

function readStringFlag(argv, flag, fallbackValue) {
  const flagIndex = argv.indexOf(flag);
  if (flagIndex === -1) {
    return fallbackValue;
  }

  const rawValue = argv[flagIndex + 1];
  if (!rawValue || rawValue.startsWith('--')) {
    throw new Error(`Expected a value after ${flag}`);
  }

  return rawValue;
}

function readCsvFlag(argv, flag) {
  const rawValue = readStringFlag(argv, flag, null);
  if (rawValue === null) {
    return null;
  }

  const values = rawValue
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    throw new Error(`Expected a comma-separated value list after ${flag}`);
  }

  return values;
}

function readOptionalNumberFlag(argv, flag, fallbackValue) {
  const flagIndex = argv.indexOf(flag);
  if (flagIndex === -1) {
    return fallbackValue;
  }

  return readNumberFlag(argv, flag, fallbackValue);
}

function readNumberFlag(argv, flag, fallbackValue) {
  const flagIndex = argv.indexOf(flag);
  if (flagIndex === -1) {
    return fallbackValue;
  }

  const rawValue = argv[flagIndex + 1];
  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Expected a positive integer after ${flag}`);
  }

  return parsedValue;
}

function readFloatFlag(argv, flag, fallbackValue) {
  const flagIndex = argv.indexOf(flag);
  if (flagIndex === -1) {
    return fallbackValue;
  }

  const rawValue = argv[flagIndex + 1];
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Expected a numeric value after ${flag}`);
  }

  return parsedValue;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertSourceSeed(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Source seed must be an object');
  }

  if (!payload.meta || typeof payload.meta !== 'object' || Array.isArray(payload.meta)) {
    throw new Error('Source seed meta must be an object');
  }

  if (!Array.isArray(payload.entries)) {
    throw new Error('Source seed entries must be an array');
  }
}

function assertTranslationPack(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Translation pack must be an object');
  }

  if (!payload.meta || typeof payload.meta !== 'object' || Array.isArray(payload.meta)) {
    throw new Error('Translation pack meta must be an object');
  }

  if (!Array.isArray(payload.translations)) {
    throw new Error('Translation pack translations must be an array');
  }
}

function assertTopicSeed(topicSeed) {
  if (!topicSeed || typeof topicSeed !== 'object' || Array.isArray(topicSeed)) {
    throw new Error('Topic seed must be an object');
  }
  if (!topicSeed.meta || typeof topicSeed.meta !== 'object' || Array.isArray(topicSeed.meta)) {
    throw new Error('Topic seed meta must be an object');
  }
  if (!Array.isArray(topicSeed.topics)) {
    throw new Error('Topic seed topics must be an array');
  }

  const seenIds = new Set();
  for (const topic of topicSeed.topics) {
    if (!topic || typeof topic !== 'object' || Array.isArray(topic)) {
      throw new Error('Each topic must be an object');
    }

    const keys = Object.keys(topic).sort();
    if (keys.join(',') !== 'description,id,name') {
      throw new Error(`Topic "${String(topic.id || '').trim() || '<unknown>'}" must contain exactly id, name, description`);
    }

    const id = String(topic.id || '').trim();
    const name = String(topic.name || '').trim();
    const description = String(topic.description || '').trim();

    if (!id) {
      throw new Error('Topic missing id');
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate topic id "${id}"`);
    }
    if (!name) {
      throw new Error(`Topic "${id}" is missing name`);
    }
    if (!description) {
      throw new Error(`Topic "${id}" is missing description`);
    }

    seenIds.add(id);
  }
}

function createTopicIndex(topicSeed) {
  assertTopicSeed(topicSeed);

  return new Map(
    topicSeed.topics
      .filter(topic => topic && typeof topic.id === 'string' && topic.id.trim())
      .map(topic => [topic.id, topic]),
  );
}

function assertKnownSelectedTopic(topicIndex, topicId) {
  if (topicId !== null && !topicIndex.has(topicId)) {
    throw new Error(`Unknown topic id for --only-topic: "${topicId}"`);
  }
}

function createExistingTranslationIndex(translationPack) {
  return new Map(translationPack.translations.map(entry => [entry.word, entry]));
}

function applyLimit(items, limit) {
  return limit === null ? items : items.slice(0, Math.max(0, Number(limit) || 0));
}

function createBatches(items, batchSize, getWord) {
  const batches = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batchItems = items.slice(index, index + batchSize);
    batches.push({
      batchNumber: batches.length + 1,
      startIndex: index,
      endIndex: Math.min(index + batchSize, items.length),
      size: batchItems.length,
      words: batchItems.map(getWord),
      items: batchItems,
    });
  }

  return batches;
}

function createOnlyWordsSet(onlyWords) {
  return onlyWords ? new Set(onlyWords) : null;
}

function hasTranslatedContent(entry) {
  return (
    entry &&
    Array.isArray(entry.translations) &&
    entry.translations.some(translation => {
      const value = String(translation?.value || '').trim();
      return Boolean(value);
    })
  );
}

function normalizeTopics(topics, topicIndex, label, options = {}) {
  const {allowUnknownTopics = false} = options;

  if (!Array.isArray(topics)) {
    throw new Error(`${label} topics must be an array`);
  }

  const normalizedTopics = topics.map(topicId => String(topicId || '').trim()).filter(Boolean);

  if (normalizedTopics.length === 0) {
    throw new Error(`${label} must include at least one topic`);
  }
  if (normalizedTopics.length > 3) {
    throw new Error(`${label} must include at most 3 topics`);
  }
  if (new Set(normalizedTopics).size !== normalizedTopics.length) {
    throw new Error(`${label} must not contain duplicate topics`);
  }

  const unknownTopicIds = normalizedTopics.filter(topicId => !topicIndex.has(topicId));
  if (!allowUnknownTopics && unknownTopicIds.length > 0) {
    throw new UnknownTopicsError({
      message: `${label} references unknown topic "${unknownTopicIds[0]}"`,
      unknownTopics: unknownTopicIds.map(topicId => ({
        id: topicId,
        words: [],
      })),
    });
  }

  return normalizedTopics;
}

function collectUnknownTopicsFromEntries(entries, topicIndex) {
  const unknownTopics = new Map();

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const word = String(entry.word || '').trim();
    const translations = Array.isArray(entry.translations) ? entry.translations : [];

    for (const translation of translations) {
      const topics = Array.isArray(translation?.topics)
        ? translation.topics.map(topicId => String(topicId || '').trim()).filter(Boolean)
        : [];

      for (const topicId of topics) {
        if (topicIndex.has(topicId)) {
          continue;
        }

        if (!unknownTopics.has(topicId)) {
          unknownTopics.set(topicId, new Set());
        }

        if (word) {
          unknownTopics.get(topicId).add(word);
        }
      }
    }
  }

  return Array.from(unknownTopics.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([id, words]) => ({
      id,
      words: Array.from(words).sort((left, right) => left.localeCompare(right)),
    }));
}

function ensureNoUnknownTopicsInBatch(entries, topicIndex) {
  const unknownTopics = collectUnknownTopicsFromEntries(entries, topicIndex);
  if (unknownTopics.length === 0) {
    return;
  }

  throw new UnknownTopicsError({
    message: formatUnknownTopicsErrorMessage(unknownTopics),
    unknownTopics,
  });
}

function formatUnknownTopicsErrorMessage(unknownTopics) {
  const lines = [
    'Translation batch contains unknown topics.',
    '',
    'Unknown topics:',
  ];

  for (const topic of unknownTopics) {
    lines.push(`- ${topic.id}`);
    lines.push('  words:');
    for (const word of topic.words) {
      lines.push(`    - ${word}`);
    }
    lines.push('');
  }

  lines.push('Run:');
  lines.push('--suggest-topics');
  lines.push('to review or append new topic definitions.');

  return lines.join('\n');
}

function createTopicDisplayName(topicId) {
  const preset = TOPIC_SUGGESTION_PRESETS.get(topicId);
  if (preset) {
    return preset.name;
  }

  const tokens = String(topicId || '')
    .trim()
    .split(/[-_]+/u)
    .filter(Boolean);

  if (tokens.length === 0) {
    return 'Topic';
  }

  const replacements = new Map([
    ['ai', 'AI'],
    ['tv', 'TV'],
    ['pc', 'PC'],
    ['it', 'IT'],
    ['hr', 'HR'],
    ['usa', 'USA'],
    ['uk', 'UK'],
    ['ph', 'Public Health'],
  ]);

  return tokens
    .map(token => {
      const lowerToken = token.toLowerCase();
      if (replacements.has(lowerToken)) {
        return replacements.get(lowerToken);
      }
      return lowerToken.charAt(0).toUpperCase() + lowerToken.slice(1);
    })
    .join(' ');
}

function createTopicDescription(topicId, topicWords) {
  const preset = TOPIC_SUGGESTION_PRESETS.get(topicId);
  if (preset) {
    return preset.description;
  }

  const sampleWords = topicWords.slice(0, 6);
  const displayName = createTopicDisplayName(topicId);
  const samplePart =
    sampleWords.length > 0 ? ` Common triggers include ${sampleWords.join(', ')}.` : '';

  return `${displayName} vocabulary and closely related concepts that belong to this semantic area rather than a broader generic topic.${samplePart}`;
}

function buildSuggestedTopics(unknownTopics, topicIndex) {
  return unknownTopics
    .filter(topic => !topicIndex.has(topic.id))
    .map(topic => ({
      id: topic.id,
      name: createTopicDisplayName(topic.id),
      description: createTopicDescription(topic.id, topic.words),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function saveTopicSeedAtomic(filePath, topicSeed) {
  assertTopicSeed(topicSeed);
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(topicSeed, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function appendSuggestedTopicsToSeed(topicSeed, suggestedTopics) {
  const existingIds = new Set(topicSeed.topics.map(topic => topic.id));
  const topicsToAppend = suggestedTopics.filter(topic => !existingIds.has(topic.id));

  const nextTopicSeed = {
    ...topicSeed,
    topics: [...topicSeed.topics, ...topicsToAppend].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };

  assertTopicSeed(nextTopicSeed);

  return {
    nextTopicSeed,
    appendedTopics: topicsToAppend,
  };
}

function normalizeTranslationRecord(translation, topicIndex, wordLabel, options = {}) {
  if (!translation || typeof translation !== 'object' || Array.isArray(translation)) {
    throw new Error(`Translation for "${wordLabel}" must be an object`);
  }

  const languageCode = String(translation.language_code || '').trim();
  const value = String(translation.value || '').trim();
  const context = String(translation.context || '').trim();
  const example = String(translation.example || '').trim();
  const exampleTranslation = String(translation.example_translation || '').trim();
  const status = String(translation.status || '').trim();
  const topics = normalizeTopics(
    translation.topics,
    topicIndex,
    `Translation for "${wordLabel}"`,
    options,
  );

  if (languageCode !== 'ru') {
    throw new Error(`Translation for "${wordLabel}" must use language_code "ru"`);
  }
  if (!value) {
    throw new Error(`Translation for "${wordLabel}" is missing value`);
  }
  if (!context) {
    throw new Error(`Translation for "${wordLabel}" is missing context`);
  }
  if (!example) {
    throw new Error(`Translation for "${wordLabel}" is missing example`);
  }
  if (!exampleTranslation) {
    throw new Error(`Translation for "${wordLabel}" is missing example_translation`);
  }
  if (status !== 'machine_unverified') {
    throw new Error(`Translation for "${wordLabel}" must use status "machine_unverified"`);
  }

  return {
    language_code: 'ru',
    value,
    context,
    example,
    example_translation: exampleTranslation,
    status: 'machine_unverified',
    topics,
  };
}

function buildSelectionSummary(options) {
  return {
    onlyTopic: options.onlyTopic,
    onlyWords: options.onlyWords,
    onlyMissingTopics: options.onlyMissingTopics,
    limit: options.limit,
    batchSize: options.batchSize,
  };
}

function createGenerationProgressState({seedPayload, translationPack, batchSize, limit, force, onlyWords}) {
  const existingTranslationIndex = createExistingTranslationIndex(translationPack);
  const onlyWordsSet = createOnlyWordsSet(onlyWords);
  const eligibleEntries = seedPayload.entries.filter(entry => {
    const word = String(entry.word || '').trim();
    if (!word) {
      return false;
    }

    if (onlyWordsSet && !onlyWordsSet.has(word)) {
      return false;
    }

    if (force) {
      return true;
    }

    return !existingTranslationIndex.has(word);
  });
  const pendingEntries = applyLimit(eligibleEntries, limit);

  return {
    totalEntries: seedPayload.entries.length,
    translatedEntries: translationPack.translations.length,
    eligibleEntries,
    pendingEntries,
    batches: createBatches(pendingEntries, batchSize, entry => entry.word),
    existingTranslationIndex,
  };
}

function entryMatchesTopicFilters(entry, options) {
  if (options.onlyTopic !== null) {
    const hasTopic = entry.translations.some(translation =>
      Array.isArray(translation.topics) && translation.topics.includes(options.onlyTopic),
    );
    if (!hasTopic) {
      return false;
    }
  }

  if (options.onlyMissingTopics) {
    const hasMissingTopics = entry.translations.some(
      translation => !Array.isArray(translation.topics) || translation.topics.length === 0,
    );
    if (!hasMissingTopics) {
      return false;
    }
  }

  return true;
}

function createReclassificationProgressState({translationPack, batchSize, limit, options}) {
  const onlyWordsSet = createOnlyWordsSet(options.onlyWords);
  const eligibleEntries = translationPack.translations.filter(entry => {
    const word = String(entry.word || '').trim();
    if (!word) {
      return false;
    }
    if (!hasTranslatedContent(entry)) {
      return false;
    }
    if (onlyWordsSet && !onlyWordsSet.has(word)) {
      return false;
    }
    return entryMatchesTopicFilters(entry, options);
  });
  const pendingEntries = applyLimit(eligibleEntries, limit);

  return {
    totalEntries: translationPack.translations.length,
    translatedEntries: translationPack.translations.length,
    eligibleEntries,
    pendingEntries,
    batches: createBatches(pendingEntries, batchSize, entry => entry.word),
  };
}

function selectEntriesForDryRun(progressState, limit) {
  return progressState.pendingEntries.slice(0, limit);
}

function createDryRunTranslation(entry) {
  return {
    word: entry.word,
    translations: [
      {
        language_code: 'ru',
        value: `__RU_VALUE_FOR_${entry.word}__`,
        context: `__RU_CONTEXT_FOR_${entry.word}__`,
        example: `__EN_EXAMPLE_FOR_${entry.word}__`,
        example_translation: `__RU_EXAMPLE_TRANSLATION_FOR_${entry.word}__`,
        status: 'machine_unverified',
        topics: ['__TOPIC_ID__'],
      },
    ],
  };
}

function createGenerationDryRunPreview({entries, translationPack}) {
  return {
    meta: translationPack.meta,
    translations: entries.map(entry => createDryRunTranslation(entry)),
  };
}

function mergeGeneratedEntries(translationPack, generatedEntries) {
  const existingTranslationIndex = createExistingTranslationIndex(translationPack);

  for (const entry of generatedEntries) {
    existingTranslationIndex.set(entry.word, entry);
  }

  return {
    ...translationPack,
    translations: Array.from(existingTranslationIndex.values()).sort((left, right) =>
      left.word.localeCompare(right.word),
    ),
  };
}

function applyWordUpdates(translationPack, updatesByWord, updateEntry) {
  return {
    ...translationPack,
    translations: translationPack.translations.map(entry => {
      const word = String(entry.word || '').trim();
      if (!updatesByWord.has(word)) {
        return entry;
      }

      return updateEntry(entry, updatesByWord.get(word));
    }),
  };
}

function applyTopicClassifications(translationPack, classifications) {
  const updatesByWord = new Map(classifications.map(classification => [classification.word, classification]));

  return applyWordUpdates(translationPack, updatesByWord, (entry, classification) => ({
    ...entry,
    translations: entry.translations.map(translation => ({
      ...translation,
      topics: [...classification.topics],
    })),
  }));
}

function saveTranslationPackAtomic(filePath, translationPack) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(translationPack, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalizedLine = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = normalizedLine.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable ${name}. Check ${ENV_PATH}.`);
  }

  return value.trim();
}

function createTopicPromptSection(topicIndex) {
  return Array.from(topicIndex.values())
    .map(topic => `- ${topic.id}: ${topic.name} — ${topic.description}`)
    .join('\n');
}

function buildDeepSeekGenerationPrompt({batchWords, topicIndex, allowCandidateTopics = false}) {
  const allowedTopics = Array.from(topicIndex.keys());
  const topicPromptSection = createTopicPromptSection(topicIndex);
  const systemPrompt = [
    allowCandidateTopics
      ? 'If the existing topic seed is semantically insufficient, you may return a new lowercase topic id.'
      : 'Never invent new topic ids.',
    'If a concept looks like crime, police, court, punishment, justice, or legal rules, use "law"; do not return "crime".',
    'Return only valid json.',
    'Do not include markdown.',
    'Do not include prose.',
    'You generate Russian translations for an English vocabulary-learning app.',
    'The response json must match this example exactly in structure:',
    '{',
    '  "translations": [',
    '    {',
    '      "word": "ability",',
    '      "translations": [',
    '        {',
    '          "language_code": "ru",',
    '          "value": "способность",',
    '          "context": "Используется, когда речь о возможности или умении что-то делать.",',
    '          "example": "She has the ability to learn quickly.",',
    '          "example_translation": "Она способна быстро учиться.",',
    '          "status": "machine_unverified",',
    '          "topics": ["education", "people"]',
    '        }',
    '      ]',
    '    }',
    '  ]',
    '}',
  ].join('\n');

  const userPrompt = [
    'Generate json for these English words:',
    JSON.stringify(batchWords),
    '',
    'Rules:',
    '- Return only valid json with top-level key "translations".',
    '- For each word return "word" and "translations".',
    '- Each translations array must contain 1 or 2 objects.',
    '- language_code must be "ru".',
    '- value, context, example, example_translation, and status must be non-empty strings.',
    '- status must be "machine_unverified".',
    '- example must be in English.',
    '- example_translation must be in Russian.',
    '- context must be in Russian and explain when this translation is used.',
    '- Prefer the most common meaning for beginner/intermediate English learners.',
    '- If a word has several very common meanings, include up to 2 translations.',
    '- topics must contain 1 to 3 topic ids.',
    allowCandidateTopics
      ? '- Prefer existing topic ids, but if no existing topic fits well enough, you may propose a new lowercase topic id using letters, numbers, and hyphens.'
      : '- Use ONLY topic ids from the allowed list.',
    allowCandidateTopics ? '- Keep any new topic id semantically narrow and reusable.' : '- Never invent new topic ids.',
    '- Prefer the most semantically accurate topics.',
    '- Do not overuse generic topics like people or education.',
    '- Grammar or function words should use grammar.',
    '- Time expressions should use time.',
    '- Abstract ideas should use abstract.',
    '- Measurements and quantities should use numbers or measurement.',
    '- Movement, direction, and location concepts should use movement, or transport when the meaning is specifically about vehicles, traffic, or transport systems.',
    allowCandidateTopics
      ? '- Existing topic ids and descriptions for reuse:'
      : '- Use only allowed topic ids from this list:',
    topicPromptSection,
    '',
    'Topic examples:',
    '- "a" -> ["grammar"]',
    '- "a.m." -> ["time"]',
    '- "ability" -> ["abstract", "education"]',
    '- "above" -> ["movement"]',
    '- "accept" -> ["communication", "people"]',
    '- "accident" -> ["transport", "health"]',
    '',
    `Existing topic ids json: ${JSON.stringify(allowedTopics)}`,
  ].join('\n');

  return {
    systemPrompt,
    userPrompt,
  };
}

function buildReclassificationPayloadEntry(entry) {
  return {
    word: entry.word,
    translations: entry.translations.map(translation => ({
      value: String(translation?.value || '').trim(),
      context: String(translation?.context || '').trim(),
      example: String(translation?.example || '').trim(),
      current_topics: Array.isArray(translation?.topics) ? translation.topics : [],
    })),
  };
}

function buildDeepSeekReclassificationPrompt({batchEntries, topicIndex}) {
  const allowedTopics = Array.from(topicIndex.keys());
  const topicPromptSection = createTopicPromptSection(topicIndex);
  const payloadPreview = batchEntries.map(buildReclassificationPayloadEntry);
  const systemPrompt = [
    'Return only valid json.',
    'Never invent new topic ids.',
    'If a concept looks like crime, police, court, punishment, justice, or legal rules, use "law"; do not return "crime".',
    'Do not include markdown.',
    'Do not include prose.',
    'You reclassify topic ids for an existing Russian vocabulary translation pack.',
    'Do NOT regenerate translations.',
    'Do NOT regenerate examples.',
    'Do NOT regenerate contexts.',
    'ONLY return updated topic ids.',
    'The response json must match this example exactly in structure:',
    '{',
    '  "classifications": [',
    '    {',
    '      "word": "ability",',
    '      "topics": ["abstract", "education"]',
    '    }',
    '  ]',
    '}',
  ].join('\n');

  const userPrompt = [
    'Reclassify topics for these existing translation entries:',
    JSON.stringify(payloadPreview, null, 2),
    '',
    'Rules:',
    '- Return ONLY valid JSON with top-level key "classifications".',
    '- For each word return exactly one object with keys "word" and "topics".',
    '- Do NOT regenerate translations.',
    '- Do NOT regenerate examples.',
    '- Do NOT regenerate contexts.',
    '- ONLY return updated topic ids.',
    '- topics must be a non-empty array with 1 to 3 topic ids.',
    '- Use ONLY allowed topic ids from the topic seed.',
    '- Never invent new topic ids.',
    '- Prefer semantically accurate topics.',
    '- Avoid generic overuse of "people" and "education".',
    '- Use this list of allowed topic ids and descriptions:',
    topicPromptSection,
    '',
    `Allowed topic ids json: ${JSON.stringify(allowedTopics)}`,
  ].join('\n');

  return {
    systemPrompt,
    userPrompt,
  };
}

function calculateMaxTokens(batchWords) {
  return Math.max(1500, batchWords.length * 350);
}

async function callDeepSeekJson({apiKey, model, temperature, systemPrompt, userPrompt, maxTokens}) {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {role: 'system', content: systemPrompt},
        {role: 'user', content: userPrompt},
      ],
      response_format: {type: 'json_object'},
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const rawBody = await response.text();
  let parsedBody = null;

  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : null;
  } catch (error) {
    parsedBody = null;
  }

  if (!response.ok) {
    const errorMessage =
      parsedBody && parsedBody.error && parsedBody.error.message
        ? parsedBody.error.message
        : rawBody || `HTTP ${response.status}`;
    throw new Error(`DeepSeek API request failed (${response.status}): ${errorMessage}`);
  }

  const content = parsedBody?.choices?.[0]?.message?.content;
  const finishReason = parsedBody?.choices?.[0]?.finish_reason;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(
      `DeepSeek returned empty content${finishReason ? ` (finish_reason=${finishReason})` : ''}.`,
    );
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`DeepSeek returned invalid JSON content: ${error.message}`);
  }
}

async function callDeepSeekGenerationBatch({apiKey, model, temperature, batchWords, topicIndex}) {
  const {systemPrompt, userPrompt} = buildDeepSeekGenerationPrompt({
    batchWords,
    topicIndex,
  });
  return callDeepSeekJson({
    apiKey,
    model,
    temperature,
    systemPrompt,
    userPrompt,
    maxTokens: calculateMaxTokens(batchWords),
  });
}

async function callDeepSeekSuggestionBatch({apiKey, model, temperature, batchWords, topicIndex}) {
  const {systemPrompt, userPrompt} = buildDeepSeekGenerationPrompt({
    batchWords,
    topicIndex,
    allowCandidateTopics: true,
  });
  return callDeepSeekJson({
    apiKey,
    model,
    temperature,
    systemPrompt,
    userPrompt,
    maxTokens: calculateMaxTokens(batchWords),
  });
}

async function callDeepSeekReclassificationBatch({
  apiKey,
  model,
  temperature,
  batchEntries,
  topicIndex,
}) {
  const {systemPrompt, userPrompt} = buildDeepSeekReclassificationPrompt({
    batchEntries,
    topicIndex,
  });
  return callDeepSeekJson({
    apiKey,
    model,
    temperature,
    systemPrompt,
    userPrompt,
    maxTokens: Math.max(1200, batchEntries.length * 220),
  });
}

function validateGeneratedBatch(payload, batchWords, topicIndex) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('DeepSeek batch payload must be an object');
  }

  if (!Array.isArray(payload.translations)) {
    throw new Error('DeepSeek batch payload must include a translations array');
  }

  const requestedWords = new Set(batchWords);
  const seenWords = new Set();
  const normalizedEntries = [];

  for (const entry of payload.translations) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Each generated batch entry must be an object');
    }

    const word = String(entry.word || '').trim();
    if (!word) {
      throw new Error('Generated batch entry is missing word');
    }
    if (!requestedWords.has(word)) {
      throw new Error(`DeepSeek returned unexpected word "${word}"`);
    }
    if (seenWords.has(word)) {
      throw new Error(`DeepSeek returned duplicate word "${word}" in one batch`);
    }
    seenWords.add(word);

    if (!Array.isArray(entry.translations) || entry.translations.length === 0) {
      throw new Error(`Generated word "${word}" must include a non-empty translations array`);
    }
    if (entry.translations.length > 2) {
      throw new Error(`Generated word "${word}" must include at most 2 translations`);
    }

    normalizedEntries.push({
      word,
      translations: entry.translations.map(translation =>
        normalizeTranslationRecord(translation, topicIndex, word, {
          allowUnknownTopics: true,
        }),
      ),
    });
  }

  for (const requestedWord of requestedWords) {
    if (!seenWords.has(requestedWord)) {
      throw new Error(`DeepSeek response is missing requested word "${requestedWord}"`);
    }
  }

  const sortedEntries = normalizedEntries.sort((left, right) => left.word.localeCompare(right.word));
  ensureNoUnknownTopicsInBatch(sortedEntries, topicIndex);
  return sortedEntries;
}

function validateSuggestionBatch(payload, batchWords) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('DeepSeek batch payload must be an object');
  }

  if (!Array.isArray(payload.translations)) {
    throw new Error('DeepSeek batch payload must include a translations array');
  }

  const requestedWords = new Set(batchWords);
  const seenWords = new Set();
  const normalizedEntries = [];

  for (const entry of payload.translations) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Each generated batch entry must be an object');
    }

    const word = String(entry.word || '').trim();
    if (!word) {
      throw new Error('Generated batch entry is missing word');
    }
    if (!requestedWords.has(word)) {
      throw new Error(`DeepSeek returned unexpected word "${word}"`);
    }
    if (seenWords.has(word)) {
      throw new Error(`DeepSeek returned duplicate word "${word}" in one batch`);
    }
    seenWords.add(word);

    if (!Array.isArray(entry.translations) || entry.translations.length === 0) {
      throw new Error(`Generated word "${word}" must include a non-empty translations array`);
    }
    if (entry.translations.length > 2) {
      throw new Error(`Generated word "${word}" must include at most 2 translations`);
    }

    normalizedEntries.push({
      word,
      translations: entry.translations.map(translation => {
        if (!translation || typeof translation !== 'object' || Array.isArray(translation)) {
          throw new Error(`Translation for "${word}" must be an object`);
        }

        const languageCode = String(translation.language_code || '').trim();
        const value = String(translation.value || '').trim();
        const context = String(translation.context || '').trim();
        const example = String(translation.example || '').trim();
        const exampleTranslation = String(translation.example_translation || '').trim();
        const status = String(translation.status || '').trim();
        const topics = Array.isArray(translation.topics)
          ? translation.topics.map(topicId => String(topicId || '').trim()).filter(Boolean)
          : null;

        if (languageCode !== 'ru') {
          throw new Error(`Translation for "${word}" must use language_code "ru"`);
        }
        if (!value) {
          throw new Error(`Translation for "${word}" is missing value`);
        }
        if (!context) {
          throw new Error(`Translation for "${word}" is missing context`);
        }
        if (!example) {
          throw new Error(`Translation for "${word}" is missing example`);
        }
        if (!exampleTranslation) {
          throw new Error(`Translation for "${word}" is missing example_translation`);
        }
        if (status !== 'machine_unverified') {
          throw new Error(`Translation for "${word}" must use status "machine_unverified"`);
        }
        if (!topics) {
          throw new Error(`Translation for "${word}" topics must be an array`);
        }
        if (topics.length === 0) {
          throw new Error(`Translation for "${word}" must include at least one topic`);
        }
        if (topics.length > 3) {
          throw new Error(`Translation for "${word}" must include at most 3 topics`);
        }
        if (new Set(topics).size !== topics.length) {
          throw new Error(`Translation for "${word}" must not contain duplicate topics`);
        }

        return {
          language_code: 'ru',
          value,
          context,
          example,
          example_translation: exampleTranslation,
          status: 'machine_unverified',
          topics,
        };
      }),
    });
  }

  for (const requestedWord of requestedWords) {
    if (!seenWords.has(requestedWord)) {
      throw new Error(`DeepSeek response is missing requested word "${requestedWord}"`);
    }
  }

  return normalizedEntries.sort((left, right) => left.word.localeCompare(right.word));
}

function validateTopicClassificationBatch(payload, batchEntries, topicIndex, translationIndex) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('DeepSeek classification payload must be an object');
  }

  if (!Array.isArray(payload.classifications)) {
    throw new Error('DeepSeek classification payload must include a classifications array');
  }

  const requestedWords = new Set(batchEntries.map(entry => entry.word));
  const seenWords = new Set();
  const normalizedClassifications = [];

  for (const classification of payload.classifications) {
    if (!classification || typeof classification !== 'object' || Array.isArray(classification)) {
      throw new Error('Each classification must be an object');
    }

    const word = String(classification.word || '').trim();
    if (!word) {
      throw new Error('Classification entry is missing word');
    }
    if (!requestedWords.has(word)) {
      throw new Error(`DeepSeek returned unexpected classification word "${word}"`);
    }
    if (seenWords.has(word)) {
      throw new Error(`DeepSeek returned duplicate classification for "${word}"`);
    }
    if (!translationIndex.has(word)) {
      throw new Error(`Classification word "${word}" does not exist in the translation pack`);
    }

    seenWords.add(word);
    normalizedClassifications.push({
      word,
      topics: normalizeTopics(classification.topics, topicIndex, `Classification for "${word}"`),
    });
  }

  for (const requestedWord of requestedWords) {
    if (!seenWords.has(requestedWord)) {
      throw new Error(`DeepSeek classification response is missing requested word "${requestedWord}"`);
    }
  }

  return normalizedClassifications.sort((left, right) => left.word.localeCompare(right.word));
}

async function generateBatchWithRetries({options, batchWords, topicIndex, apiKey}) {
  let lastError = null;

  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    try {
      const payload = await callDeepSeekGenerationBatch({
        apiKey,
        model: options.model,
        temperature: options.temperature,
        batchWords,
        topicIndex,
      });
      return validateGeneratedBatch(payload, batchWords, topicIndex);
    } catch (error) {
      lastError = error;
      if (error instanceof UnknownTopicsError) {
        throw error;
      }
      console.error(
        `Batch failed for [${batchWords.join(', ')}] on attempt ${attempt}/${options.maxRetries}: ${error.message}`,
      );
    }
  }

  throw new Error(
    `Failed to generate a valid batch after ${options.maxRetries} attempts for words: ${batchWords.join(', ')}. Last error: ${lastError ? lastError.message : 'unknown error'}`,
  );
}

async function suggestTopicsBatchWithRetries({options, batchWords, topicIndex, apiKey}) {
  let lastError = null;

  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    try {
      const payload = await callDeepSeekSuggestionBatch({
        apiKey,
        model: options.model,
        temperature: options.temperature,
        batchWords,
        topicIndex,
      });
      return validateSuggestionBatch(payload, batchWords);
    } catch (error) {
      lastError = error;
      console.error(
        `Suggestion batch failed for [${batchWords.join(', ')}] on attempt ${attempt}/${options.maxRetries}: ${error.message}`,
      );
    }
  }

  throw new Error(
    `Failed to suggest topics after ${options.maxRetries} attempts for words: ${batchWords.join(', ')}. Last error: ${lastError ? lastError.message : 'unknown error'}`,
  );
}

async function reclassifyBatchWithRetries({
  options,
  batchEntries,
  topicIndex,
  translationIndex,
  apiKey,
}) {
  let lastError = null;

  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    try {
      const payload = await callDeepSeekReclassificationBatch({
        apiKey,
        model: options.model,
        temperature: options.temperature,
        batchEntries,
        topicIndex,
      });
      return validateTopicClassificationBatch(payload, batchEntries, topicIndex, translationIndex);
    } catch (error) {
      lastError = error;
      console.error(
        `Classification batch failed for [${batchEntries.map(entry => entry.word).join(', ')}] on attempt ${attempt}/${options.maxRetries}: ${error.message}`,
      );
    }
  }

  throw new Error(
    `Failed to reclassify a valid batch after ${options.maxRetries} attempts for words: ${batchEntries.map(entry => entry.word).join(', ')}. Last error: ${lastError ? lastError.message : 'unknown error'}`,
  );
}

function createReclassificationPreview(entry, classification) {
  return {
    word: entry.word,
    translationCount: entry.translations.length,
    before: entry.translations.map(translation => ({
      value: String(translation?.value || '').trim(),
      topics: Array.isArray(translation?.topics) ? translation.topics : [],
    })),
    after: classification.topics,
  };
}

async function runDeepSeekGeneration({options, seedPayload, topicIndex, translationPack}) {
  if (!options.yes) {
    throw new Error('Real generation requires --provider deepseek --yes');
  }

  loadEnvFile(ENV_PATH);
  const apiKey = getRequiredEnv('DEEPSEEK_API_KEY');
  const progressState = createGenerationProgressState({
    seedPayload,
    translationPack,
    batchSize: options.batchSize,
    limit: options.limit,
    force: options.force,
    onlyWords: options.onlyWords,
  });

  if (progressState.pendingEntries.length === 0) {
    console.log(
      JSON.stringify(
        {
          mode: 'deepseek',
          operation: OPERATION_GENERATE,
          message: 'No words need generation for the current selection.',
          sourceSeedPath: SOURCE_SEED_PATH,
          topicSeedPath: TOPIC_SEED_PATH,
          translationPackPath: TRANSLATION_PACK_PATH,
          totalEntries: progressState.totalEntries,
          translatedEntries: translationPack.translations.length,
          eligibleEntries: progressState.eligibleEntries.length,
          pendingEntries: 0,
          completedBatches: 0,
          selection: buildSelectionSummary(options),
        },
        null,
        2,
      ),
    );
    return;
  }

  let currentPack = translationPack;
  let completedWordCount = 0;

  for (const batch of progressState.batches) {
    const generatedEntries = await generateBatchWithRetries({
      options,
      batchWords: batch.words,
      topicIndex,
      apiKey,
    });

    currentPack = mergeGeneratedEntries(currentPack, generatedEntries);
    saveTranslationPackAtomic(TRANSLATION_PACK_PATH, currentPack);
    completedWordCount += generatedEntries.length;

    console.log(
      JSON.stringify(
        {
          mode: 'deepseek',
          operation: OPERATION_GENERATE,
          batchNumber: batch.batchNumber,
          batchSize: batch.size,
          batchWords: batch.words,
          completedWords: completedWordCount,
          totalScheduledWords: progressState.pendingEntries.length,
          translationSeedEntries: currentPack.translations.length,
          savedTo: TRANSLATION_PACK_PATH,
        },
        null,
        2,
      ),
    );
  }

  console.log(
    JSON.stringify(
      {
        mode: 'deepseek',
        operation: OPERATION_GENERATE,
        message: 'Generation completed successfully.',
        sourceSeedPath: SOURCE_SEED_PATH,
        topicSeedPath: TOPIC_SEED_PATH,
        translationPackPath: TRANSLATION_PACK_PATH,
        generatedWords: completedWordCount,
        translationSeedEntries: currentPack.translations.length,
        nextStep: 'Run node scripts/audit-core-english-3000.js',
      },
      null,
      2,
    ),
  );
}

async function runDeepSeekTopicSuggestion({options, seedPayload, topicSeed, topicIndex, translationPack}) {
  if (!options.yes) {
    throw new Error('Topic suggestion requires --provider deepseek --suggest-topics --yes');
  }

  loadEnvFile(ENV_PATH);
  const apiKey = getRequiredEnv('DEEPSEEK_API_KEY');
  const progressState = createGenerationProgressState({
    seedPayload,
    translationPack,
    batchSize: options.batchSize,
    limit: options.limit,
    force: options.force,
    onlyWords: options.onlyWords,
  });

  if (progressState.pendingEntries.length === 0) {
    console.log(
      JSON.stringify(
        {
          mode: 'deepseek',
          operation: OPERATION_SUGGEST_TOPICS,
          message: 'No words matched the current suggestion selection.',
          sourceSeedPath: SOURCE_SEED_PATH,
          topicSeedPath: TOPIC_SEED_PATH,
          translationPackPath: TRANSLATION_PACK_PATH,
          eligibleEntries: progressState.eligibleEntries.length,
          pendingEntries: 0,
          selection: buildSelectionSummary(options),
        },
        null,
        2,
      ),
    );
    return;
  }

  const collectedUnknownTopics = new Map();
  let inspectedWords = 0;

  for (const batch of progressState.batches) {
    const generatedEntries = await suggestTopicsBatchWithRetries({
      options,
      batchWords: batch.words,
      topicIndex,
      apiKey,
    });
    const batchUnknownTopics = collectUnknownTopicsFromEntries(generatedEntries, topicIndex);

    for (const topic of batchUnknownTopics) {
      if (!collectedUnknownTopics.has(topic.id)) {
        collectedUnknownTopics.set(topic.id, new Set());
      }

      for (const word of topic.words) {
        collectedUnknownTopics.get(topic.id).add(word);
      }
    }

    inspectedWords += generatedEntries.length;

    console.log(
      JSON.stringify(
        {
          mode: 'deepseek',
          operation: OPERATION_SUGGEST_TOPICS,
          batchNumber: batch.batchNumber,
          batchSize: batch.size,
          batchWords: batch.words,
          inspectedWords,
          totalScheduledWords: progressState.pendingEntries.length,
          unknownTopicsInBatch: batchUnknownTopics.map(topic => topic.id),
          savedTo: null,
        },
        null,
        2,
      ),
    );
  }

  const unknownTopics = Array.from(collectedUnknownTopics.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([id, words]) => ({
      id,
      words: Array.from(words).sort((left, right) => left.localeCompare(right)),
    }));
  const suggestedTopics = buildSuggestedTopics(unknownTopics, topicIndex);

  let appendedTopics = [];
  let savedTo = null;
  if (options.appendSuggestedTopics && suggestedTopics.length > 0) {
    const appendResult = appendSuggestedTopicsToSeed(topicSeed, suggestedTopics);
    appendedTopics = appendResult.appendedTopics;
    if (appendedTopics.length > 0) {
      saveTopicSeedAtomic(TOPIC_SEED_PATH, appendResult.nextTopicSeed);
      savedTo = TOPIC_SEED_PATH;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: 'deepseek',
        operation: OPERATION_SUGGEST_TOPICS,
        message:
          suggestedTopics.length === 0
            ? 'No new topics were suggested for the current selection.'
            : options.appendSuggestedTopics
              ? 'Topic suggestion completed and new topics were appended when needed.'
              : 'Topic suggestion completed. Review suggested topics before rerunning generation.',
        sourceSeedPath: SOURCE_SEED_PATH,
        topicSeedPath: TOPIC_SEED_PATH,
        translationPackPath: TRANSLATION_PACK_PATH,
        inspectedWords,
        unknownTopics,
        suggestedTopics,
        appendedTopics,
        appendedTopicCount: appendedTopics.length,
        savedTo,
        atomicSave: {
          enabled: Boolean(savedTo),
          tempPathPattern: savedTo ? `${savedTo}.tmp` : null,
        },
        selection: buildSelectionSummary(options),
        nextStep:
          suggestedTopics.length === 0
            ? 'Rerun generation normally if you want translated entries.'
            : options.appendSuggestedTopics
              ? 'Rerun generation after auditing the updated topic seed.'
              : 'Rerun with --append-suggested-topics to save new topic definitions.',
      },
      null,
      2,
    ),
  );
}

async function runDeepSeekTopicReclassification({options, topicIndex, translationPack}) {
  if (!options.dryRun && !options.yes) {
    throw new Error('Real topic reclassification requires --provider deepseek --reclassify-topics --yes');
  }

  loadEnvFile(ENV_PATH);
  const apiKey = getRequiredEnv('DEEPSEEK_API_KEY');
  const translationIndex = createExistingTranslationIndex(translationPack);
  const progressState = createReclassificationProgressState({
    translationPack,
    batchSize: options.batchSize,
    limit: options.limit,
    options,
  });

  if (progressState.pendingEntries.length === 0) {
    console.log(
      JSON.stringify(
        {
          mode: options.dryRun ? 'dry-run' : 'deepseek',
          operation: OPERATION_RECLASSIFY_TOPICS,
          message: 'No translated words matched the current reclassification selection.',
          translationPackPath: TRANSLATION_PACK_PATH,
          topicSeedPath: TOPIC_SEED_PATH,
          translatedEntries: progressState.translatedEntries,
          eligibleEntries: progressState.eligibleEntries.length,
          pendingEntries: 0,
          selection: buildSelectionSummary(options),
        },
        null,
        2,
      ),
    );
    return;
  }

  let currentPack = translationPack;
  let completedWordCount = 0;
  const preview = [];

  for (const batch of progressState.batches) {
    const classifications = await reclassifyBatchWithRetries({
      options,
      batchEntries: batch.items,
      topicIndex,
      translationIndex,
      apiKey,
    });

    if (options.dryRun) {
      for (const classification of classifications) {
        const currentEntry = translationIndex.get(classification.word);
        preview.push(createReclassificationPreview(currentEntry, classification));
      }
    } else {
      currentPack = applyTopicClassifications(currentPack, classifications);
      saveTranslationPackAtomic(TRANSLATION_PACK_PATH, currentPack);
    }

    completedWordCount += classifications.length;

    console.log(
      JSON.stringify(
        {
          mode: options.dryRun ? 'dry-run' : 'deepseek',
          operation: OPERATION_RECLASSIFY_TOPICS,
          batchNumber: batch.batchNumber,
          batchSize: batch.size,
          batchWords: batch.words,
          completedWords: completedWordCount,
          totalScheduledWords: progressState.pendingEntries.length,
          savedTo: options.dryRun ? null : TRANSLATION_PACK_PATH,
        },
        null,
        2,
      ),
    );
  }

  console.log(
    JSON.stringify(
      {
        mode: options.dryRun ? 'dry-run' : 'deepseek',
        operation: OPERATION_RECLASSIFY_TOPICS,
        message: options.dryRun
          ? 'Topic reclassification preview completed.'
          : 'Topic reclassification completed successfully.',
        topicSeedPath: TOPIC_SEED_PATH,
        translationPackPath: TRANSLATION_PACK_PATH,
        reclassifiedWords: completedWordCount,
        dryRun: options.dryRun,
        atomicSave: {
          enabled: !options.dryRun,
          tempPathPattern: `${TRANSLATION_PACK_PATH}.tmp`,
        },
        selection: buildSelectionSummary(options),
        preview,
        nextStep: 'Run node scripts/audit-core-english-3000.js',
      },
      null,
      2,
    ),
  );
}

function createPrepareOnlyResponse({options, progressState}) {
  return {
    mode: options.dryRun ? 'dry-run' : 'prepare-only',
    operation: options.operation,
    message: `Provider workflow is not implemented for operation "${options.operation}" in this run. No files were modified.`,
    sourceSeedPath: SOURCE_SEED_PATH,
    topicSeedPath: TOPIC_SEED_PATH,
    translationPackPath: TRANSLATION_PACK_PATH,
    totalEntries: progressState.totalEntries,
    translatedEntries: progressState.translatedEntries,
    eligibleEntries: progressState.eligibleEntries.length,
    pendingEntries: progressState.pendingEntries.length,
    nextBatch: progressState.batches[0] || null,
    supportedProviders: ['deepseek'],
    selection: buildSelectionSummary(options),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const seedPayload = readJson(SOURCE_SEED_PATH);
  const topicSeed = readJson(TOPIC_SEED_PATH);
  const translationPack = readJson(TRANSLATION_PACK_PATH);

  assertSourceSeed(seedPayload);
  assertTopicSeed(topicSeed);
  assertTranslationPack(translationPack);

  const topicIndex = createTopicIndex(topicSeed);
  assertKnownSelectedTopic(topicIndex, options.onlyTopic);

  if (options.operation === OPERATION_SUGGEST_TOPICS) {
    if (options.provider === 'deepseek') {
      await runDeepSeekTopicSuggestion({
        options,
        seedPayload,
        topicSeed,
        topicIndex,
        translationPack,
      });
      return;
    }

    const progressState = createGenerationProgressState({
      seedPayload,
      translationPack,
      batchSize: options.batchSize,
      limit: options.limit,
      force: options.force,
      onlyWords: options.onlyWords,
    });

    console.log(JSON.stringify(createPrepareOnlyResponse({options, progressState}), null, 2));
    return;
  }

  if (options.operation === OPERATION_RECLASSIFY_TOPICS) {
    if (options.provider === 'deepseek') {
      await runDeepSeekTopicReclassification({
        options,
        topicIndex,
        translationPack,
      });
      return;
    }

    const progressState = createReclassificationProgressState({
      translationPack,
      batchSize: options.batchSize,
      limit: options.limit,
      options,
    });

    console.log(JSON.stringify(createPrepareOnlyResponse({options, progressState}), null, 2));
    return;
  }

  if (options.operation !== OPERATION_GENERATE) {
    const selectiveProgressState = {
      totalEntries: translationPack.translations.length,
      translatedEntries: translationPack.translations.length,
      eligibleEntries: [],
      pendingEntries: [],
      batches: [],
    };

    console.log(JSON.stringify(createPrepareOnlyResponse({options, progressState: selectiveProgressState}), null, 2));
    return;
  }

  const progressState = createGenerationProgressState({
    seedPayload,
    translationPack,
    batchSize: options.batchSize,
    limit: options.limit,
    force: options.force,
    onlyWords: options.onlyWords,
  });

  if (options.dryRun) {
    const previewEntries = selectEntriesForDryRun(progressState, options.limit || DEFAULT_DRY_RUN_LIMIT);
    const previewPayload = createGenerationDryRunPreview({
      entries: previewEntries,
      translationPack,
    });

    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          operation: OPERATION_GENERATE,
          provider: options.provider,
          sourceSeedPath: SOURCE_SEED_PATH,
          topicSeedPath: TOPIC_SEED_PATH,
          translationPackPath: TRANSLATION_PACK_PATH,
          totalEntries: progressState.totalEntries,
          translatedEntries: translationPack.translations.length,
          eligibleEntries: progressState.eligibleEntries.length,
          pendingEntries: progressState.pendingEntries.length,
          nextBatch: progressState.batches[0] || null,
          availableTopicIds: Array.from(topicIndex.keys()),
          selection: buildSelectionSummary(options),
          preview: previewPayload,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (options.provider === 'deepseek') {
    await runDeepSeekGeneration({
      options,
      seedPayload,
      topicIndex,
      translationPack,
    });
    return;
  }

  console.log(JSON.stringify(createPrepareOnlyResponse({options, progressState}), null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
