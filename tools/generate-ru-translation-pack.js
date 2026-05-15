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

/**
 * @typedef {{
 *   word: string;
 *   normalized: string;
 *   part_of_speech: string | null;
 *   level: string | null;
 *   rank: number | null;
 *   sources: string[];
 *   translations: Array<unknown>;
 * }} VocabularyEntry
 */

/**
 * @typedef {{
 *   language_code: string;
 *   value: string;
 *   context: string;
 *   example: string;
 *   example_translation: string;
 *   status: string;
 *   topics: string[];
 * }} TranslationRecord
 */

/**
 * @typedef {{
 *   word: string;
 *   translations: TranslationRecord[];
 * }} TranslationPackEntry
 */

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');

  return {
    provider: readStringFlag(argv, '--provider', null),
    dryRun,
    yes: argv.includes('--yes'),
    force: argv.includes('--force'),
    batchSize: readNumberFlag(argv, '--batch-size', DEFAULT_BATCH_SIZE),
    limit: readOptionalNumberFlag(argv, '--limit', dryRun ? DEFAULT_DRY_RUN_LIMIT : null),
    model: readStringFlag(argv, '--model', DEFAULT_DEEPSEEK_MODEL),
    maxRetries: readNumberFlag(argv, '--max-retries', DEFAULT_MAX_RETRIES),
    temperature: readFloatFlag(argv, '--temperature', DEFAULT_TEMPERATURE),
  };
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

function createTopicIndex(topicSeed) {
  if (!topicSeed || typeof topicSeed !== 'object' || Array.isArray(topicSeed)) {
    throw new Error('Topic seed must be an object');
  }

  if (!Array.isArray(topicSeed.topics)) {
    throw new Error('Topic seed topics must be an array');
  }

  return new Map(
    topicSeed.topics
      .filter(topic => topic && typeof topic.id === 'string' && topic.id.trim())
      .map(topic => [topic.id, topic]),
  );
}

function createExistingTranslationIndex(translationPack) {
  return new Map(translationPack.translations.map(entry => [entry.word, entry]));
}

function createProgressState({seedPayload, translationPack, batchSize, limit, force}) {
  const existingTranslationIndex = createExistingTranslationIndex(translationPack);
  const eligibleEntries = seedPayload.entries.filter(entry => {
    const word = String(entry.word || '').trim();
    if (!word) {
      return false;
    }

    if (force) {
      return true;
    }

    return !existingTranslationIndex.has(word);
  });
  const pendingEntries =
    limit === null ? eligibleEntries : eligibleEntries.slice(0, Math.max(0, Number(limit) || 0));
  const batches = [];

  for (let index = 0; index < pendingEntries.length; index += batchSize) {
    batches.push({
      batchNumber: batches.length + 1,
      startIndex: index,
      endIndex: Math.min(index + batchSize, pendingEntries.length),
      size: Math.min(batchSize, pendingEntries.length - index),
      words: pendingEntries.slice(index, index + batchSize).map(entry => entry.word),
    });
  }

  return {
    totalEntries: seedPayload.entries.length,
    translatedEntries: translationPack.translations.length,
    eligibleEntries,
    pendingEntries,
    batches,
    existingTranslationIndex,
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

function createDryRunPreview({entries, topicIndex, translationPack}) {
  return {
    meta: translationPack.meta,
    translations: entries.map(entry => createDryRunTranslation(entry, Array.from(topicIndex.keys()))),
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
    .map(topic => `- ${topic.id}: ${topic.name}`)
    .join('\n');
}

function buildDeepSeekPrompt({batchWords, topicIndex}) {
  const allowedTopics = Array.from(topicIndex.keys());
  const topicPromptSection = createTopicPromptSection(topicIndex);
  const systemPrompt = [
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
    '- Use only allowed topic ids from this list:',
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

async function callDeepSeekBatch({apiKey, model, temperature, batchWords, topicIndex}) {
  const {systemPrompt, userPrompt} = buildDeepSeekPrompt({batchWords, topicIndex});
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
      max_tokens: calculateMaxTokens(batchWords),
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

function normalizeTranslationRecord(translation, topicIndex, wordLabel) {
  if (!translation || typeof translation !== 'object' || Array.isArray(translation)) {
    throw new Error(`Translation for "${wordLabel}" must be an object`);
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
  if (!topics || topics.length === 0) {
    throw new Error(`Translation for "${wordLabel}" must include at least one topic`);
  }
  if (topics.length > 3) {
    throw new Error(`Translation for "${wordLabel}" must include at most 3 topics`);
  }

  for (const topicId of topics) {
    if (!topicIndex.has(topicId)) {
      throw new Error(`Translation for "${wordLabel}" references unknown topic "${topicId}"`);
    }
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
        normalizeTranslationRecord(translation, topicIndex, word),
      ),
    });
  }

  for (const requestedWord of requestedWords) {
    if (!seenWords.has(requestedWord)) {
      throw new Error(`DeepSeek response is missing requested word "${requestedWord}"`);
    }
  }

  return normalizedEntries.sort((left, right) => left.word.localeCompare(right.word));
}

async function generateBatchWithRetries({options, batchWords, topicIndex, apiKey}) {
  let lastError = null;

  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    try {
      const payload = await callDeepSeekBatch({
        apiKey,
        model: options.model,
        temperature: options.temperature,
        batchWords,
        topicIndex,
      });
      return validateGeneratedBatch(payload, batchWords, topicIndex);
    } catch (error) {
      lastError = error;
      console.error(
        `Batch failed for [${batchWords.join(', ')}] on attempt ${attempt}/${options.maxRetries}: ${error.message}`,
      );
    }
  }

  throw new Error(
    `Failed to generate a valid batch after ${options.maxRetries} attempts for words: ${batchWords.join(', ')}. Last error: ${lastError ? lastError.message : 'unknown error'}`,
  );
}

async function runDeepSeekGeneration({options, seedPayload, topicIndex, translationPack}) {
  if (!options.yes) {
    throw new Error('Real generation requires --provider deepseek --yes');
  }

  loadEnvFile(ENV_PATH);
  const apiKey = getRequiredEnv('DEEPSEEK_API_KEY');
  const progressState = createProgressState({
    seedPayload,
    translationPack,
    batchSize: options.batchSize,
    limit: options.limit,
    force: options.force,
  });

  if (progressState.pendingEntries.length === 0) {
    console.log(
      JSON.stringify(
        {
          mode: 'deepseek',
          message: 'No words need generation for the current selection.',
          sourceSeedPath: SOURCE_SEED_PATH,
          topicSeedPath: TOPIC_SEED_PATH,
          translationPackPath: TRANSLATION_PACK_PATH,
          totalEntries: progressState.totalEntries,
          translatedEntries: translationPack.translations.length,
          eligibleEntries: progressState.eligibleEntries.length,
          pendingEntries: 0,
          completedBatches: 0,
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const seedPayload = readJson(SOURCE_SEED_PATH);
  const topicSeed = readJson(TOPIC_SEED_PATH);
  const translationPack = readJson(TRANSLATION_PACK_PATH);

  assertTranslationPack(translationPack);

  const topicIndex = createTopicIndex(topicSeed);
  const progressState = createProgressState({
    seedPayload,
    translationPack,
    batchSize: options.batchSize,
    limit: options.limit,
    force: options.force,
  });

  if (options.dryRun) {
    const previewEntries = selectEntriesForDryRun(progressState, options.limit || DEFAULT_DRY_RUN_LIMIT);
    const previewPayload = createDryRunPreview({
      entries: previewEntries,
      topicIndex,
      translationPack,
    });

    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
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

  const nextBatch = progressState.batches[0] || null;
  const unchangedPack = mergeGeneratedEntries(translationPack, []);

  if (JSON.stringify(unchangedPack) !== JSON.stringify(translationPack)) {
    saveTranslationPackAtomic(TRANSLATION_PACK_PATH, unchangedPack);
  }

  console.log(
    JSON.stringify(
      {
        mode: 'prepare-only',
        message:
          'Translation generation provider is not implemented for this run. No translation entries were generated.',
        sourceSeedPath: SOURCE_SEED_PATH,
        topicSeedPath: TOPIC_SEED_PATH,
        translationPackPath: TRANSLATION_PACK_PATH,
        totalEntries: progressState.totalEntries,
        translatedEntries: translationPack.translations.length,
        eligibleEntries: progressState.eligibleEntries.length,
        pendingEntries: progressState.pendingEntries.length,
        nextBatch,
        supportedProviders: ['deepseek'],
      },
      null,
      2,
    ),
  );
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
