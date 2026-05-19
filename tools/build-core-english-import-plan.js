#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_GROUP_SIZE = 20;
const MAX_GROUP_SIZE = 20;
const DEFAULT_OUTPUT_PATH = path.join(
  ROOT_DIR,
  'src',
  'assets',
  'importPlans',
  'core-english-3000.ru.import-plan.json',
);
const SOURCE_SEED_PATH = path.join(
  ROOT_DIR,
  'src',
  'assets',
  'startDB',
  'core-english-3000.seed.json',
);
const TRANSLATION_PACK_PATH = path.join(
  ROOT_DIR,
  'src',
  'assets',
  'translations',
  'core-english-3000.ru.seed.json',
);
const TOPIC_SEED_PATH = path.join(
  ROOT_DIR,
  'src',
  'assets',
  'topics',
  'core-english-3000.topics.seed.json',
);

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(formatHelp());
      return;
    }

    const sourceSeed = readJsonFile(SOURCE_SEED_PATH, 'Base seed');
    const translationPack = readJsonFile(TRANSLATION_PACK_PATH, 'Translation pack');
    const topicSeed = readJsonFile(TOPIC_SEED_PATH, 'Topic seed');

    const plan = buildImportPlan({
      sourceSeed,
      translationPack,
      topicSeed,
      groupSize: options.groupSize,
      outputPath: options.outputPath,
    });

    if (options.dryRun) {
      printSummary(plan, options.outputPath, true);
      printPreview(plan);
      return;
    }

    writeJsonAtomically(options.outputPath, plan);
    printSummary(plan, options.outputPath, false);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = {
    help: argv.includes('--help') || argv.includes('-h'),
    dryRun: argv.includes('--dry-run'),
    groupSize: readNumberFlag(argv, '--group-size', DEFAULT_GROUP_SIZE),
    outputPath: path.resolve(readStringFlag(argv, '--output', DEFAULT_OUTPUT_PATH)),
  };

  validateNoUnknownFlags(argv, new Set(['--help', '-h', '--dry-run', '--group-size', '--output']));
  validateGroupSize(options.groupSize);
  return options;
}

function formatHelp() {
  return [
    'Usage: node tools/build-core-english-import-plan.js [options]',
    '',
    'Options:',
    '  --group-size <n>   Study group size, from 1 to 20 (default: 20)',
    '  --dry-run          Print summary and preview without writing the file',
    '  --output <path>    Override output path',
    '  --help, -h         Show this help',
  ].join('\n');
}

function validateNoUnknownFlags(argv, knownFlags) {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--') && value !== '-h') {
      continue;
    }

    if (!knownFlags.has(value)) {
      throw new Error(`Unknown option: ${value}`);
    }

    if (value === '--group-size' || value === '--output') {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Option ${value} requires a value`);
      }
    }
  }
}

function readStringFlag(argv, flag, fallbackValue) {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return fallbackValue;
  }

  const nextValue = argv[index + 1];
  if (!nextValue || nextValue.startsWith('--')) {
    throw new Error(`Option ${flag} requires a value`);
  }

  return nextValue;
}

function readNumberFlag(argv, flag, fallbackValue) {
  const rawValue = readStringFlag(argv, flag, null);
  if (rawValue === null) {
    return fallbackValue;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value)) {
    throw new Error(`Option ${flag} must be an integer`);
  }

  return value;
}

function validateGroupSize(groupSize) {
  if (!Number.isInteger(groupSize) || groupSize < 1 || groupSize > MAX_GROUP_SIZE) {
    throw new Error(`Group size is invalid: expected an integer from 1 to ${MAX_GROUP_SIZE}, got ${groupSize}`);
  }
}

function readJsonFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} is missing: ${path.relative(ROOT_DIR, filePath)}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${path.relative(ROOT_DIR, filePath)} (${error.message})`);
  }
}

function buildImportPlan({sourceSeed, translationPack, topicSeed, groupSize}) {
  const baseEntries = extractBaseEntries(sourceSeed);
  const topicMap = buildTopicMap(topicSeed);
  const translationMap = buildTranslationMap(translationPack, topicMap);

  validateBaseEntries(baseEntries);
  validateTranslationCoverage(baseEntries, translationMap);

  const languageGroup = {
    id: 'english',
    name: 'English',
    type: 'language',
    parent_id: null,
    word_count: baseEntries.length,
  };

  const groups = [languageGroup];
  const topicBuckets = new Map();
  const assignments = [];
  const assignmentWords = new Set();

  for (const entry of baseEntries) {
    const word = normalizeWord(entry.word);
    if (assignmentWords.has(word)) {
      throw new Error(`Duplicate word assignments exist: ${word}`);
    }

    const translationEntry = translationMap.get(word);
    const allTopicIds = collectAllTopicIds(translationEntry, topicMap, word);
    const primaryTopic = resolvePrimaryTopic(translationEntry, topicMap, word);

    if (!topicBuckets.has(primaryTopic)) {
      topicBuckets.set(primaryTopic, []);
    }
    topicBuckets.get(primaryTopic).push(word);
    assignmentWords.add(word);

    assignments.push({
      word,
      primary_topic: primaryTopic,
      topic_ids: allTopicIds,
    });
  }

  const topicGroupDescriptors = [];
  const studyGroupLookup = new Map();

  for (const [topicId, words] of [...topicBuckets.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const topic = topicMap.get(topicId);
    if (!topic) {
      throw new Error(`Primary topic is unknown: ${topicId}`);
    }

    const sortedWords = [...words].sort((left, right) => left.localeCompare(right));
    const topicGroupId = `topic-${topicId}`;
    const topicGroup = {
      id: topicGroupId,
      name: topic.name,
      type: 'topic',
      parent_id: languageGroup.id,
      word_count: sortedWords.length,
    };

    topicGroupDescriptors.push(topicGroup);
    groups.push(topicGroup);

    const studyGroups = [];
    for (let index = 0; index < sortedWords.length; index += groupSize) {
      const chunk = sortedWords.slice(index, index + groupSize);
      const chunkNumber = String(studyGroups.length + 1).padStart(3, '0');
      const studyGroupId = `${topicGroupId}-${chunkNumber}`;
      const studyGroup = {
        id: studyGroupId,
        name: `${topic.name} ${chunkNumber}`,
        type: 'study',
        parent_id: topicGroupId,
        word_count: chunk.length,
      };

      if (chunk.length < 1 || chunk.length > groupSize) {
        throw new Error(`Study group ${studyGroupId} has invalid size: ${chunk.length}`);
      }

      studyGroups.push({id: studyGroupId, words: chunk});
      groups.push(studyGroup);
    }

    if (studyGroups.length === 0) {
      throw new Error(`Topic group ${topicGroupId} has no study groups`);
    }

    for (const studyGroup of studyGroups) {
      for (const word of studyGroup.words) {
        studyGroupLookup.set(word, {
          topicGroupId,
          studyGroupId: studyGroup.id,
        });
      }
    }
  }

  for (const assignment of assignments) {
    const studyPlacement = studyGroupLookup.get(assignment.word);
    if (!studyPlacement) {
      throw new Error(`Word is not assigned to a study group: ${assignment.word}`);
    }

    assignment.group_ids = [
      languageGroup.id,
      studyPlacement.topicGroupId,
      studyPlacement.studyGroupId,
    ];
  }

  validateDuplicateGroupIds(groups);
  validateAssignments(baseEntries, assignments);

  const summary = {
    total_words: baseEntries.length,
    total_topics: topicGroupDescriptors.length,
    total_topic_groups: topicGroupDescriptors.length,
    total_study_groups: groups.filter(group => group.type === 'study').length,
    unassigned_words: baseEntries.length - assignments.length,
  };

  return {
    meta: {
      dictionary_id: 'core-english-3000',
      language: 'en',
      translation_language: 'ru',
      group_size: groupSize,
      source_seed: toRepoRelativePath(SOURCE_SEED_PATH),
      translation_pack: toRepoRelativePath(TRANSLATION_PACK_PATH),
      topic_seed: toRepoRelativePath(TOPIC_SEED_PATH),
      version: 1,
    },
    summary,
    groups,
    assignments,
  };
}

function extractBaseEntries(sourceSeed) {
  if (!sourceSeed || !Array.isArray(sourceSeed.entries)) {
    throw new Error('Base seed must contain an entries array');
  }

  return sourceSeed.entries;
}

function buildTopicMap(topicSeed) {
  if (!topicSeed || !Array.isArray(topicSeed.topics)) {
    throw new Error('Topic seed must contain a topics array');
  }

  const topicMap = new Map();
  for (const topic of topicSeed.topics) {
    if (!topic || typeof topic.id !== 'string' || typeof topic.name !== 'string') {
      throw new Error('Topic seed contains an invalid topic entry');
    }
    if (topicMap.has(topic.id)) {
      throw new Error(`Topic seed contains a duplicate topic id: ${topic.id}`);
    }
    topicMap.set(topic.id, topic);
  }

  return topicMap;
}

function buildTranslationMap(translationPack, topicMap) {
  if (!translationPack || !Array.isArray(translationPack.translations)) {
    throw new Error('Translation pack must contain a translations array');
  }

  const translationMap = new Map();

  for (const entry of translationPack.translations) {
    if (!entry || typeof entry.word !== 'string') {
      throw new Error('Translation pack contains an entry without a valid word');
    }

    const word = normalizeWord(entry.word);
    if (translationMap.has(word)) {
      throw new Error(`Translation pack contains a duplicate word entry: ${word}`);
    }

    if (!Array.isArray(entry.translations) || entry.translations.length === 0) {
      throw new Error(`Word has no translations: ${word}`);
    }

    for (const translation of entry.translations) {
      if (!Array.isArray(translation.topics) || translation.topics.length === 0) {
        throw new Error(`Translation has no topics: ${word}`);
      }

      for (const topicId of translation.topics) {
        if (typeof topicId !== 'string' || topicId.length === 0) {
          throw new Error(`Translation has an invalid topic id: ${word}`);
        }
        if (!topicMap.has(topicId)) {
          throw new Error(`Unknown topic id "${topicId}" for word "${word}"`);
        }
      }
    }

    translationMap.set(word, entry);
  }

  return translationMap;
}

function validateBaseEntries(baseEntries) {
  const seenWords = new Set();

  for (const entry of baseEntries) {
    if (!entry || typeof entry.word !== 'string' || entry.word.trim().length === 0) {
      throw new Error('Base seed contains an entry without a valid word');
    }

    const word = normalizeWord(entry.word);
    if (seenWords.has(word)) {
      throw new Error(`Base seed contains a duplicate word: ${word}`);
    }
    seenWords.add(word);
  }
}

function validateTranslationCoverage(baseEntries, translationMap) {
  const missingWords = [];

  for (const entry of baseEntries) {
    const word = normalizeWord(entry.word);
    if (!translationMap.has(word)) {
      missingWords.push(word);
    }
  }

  if (missingWords.length > 0) {
    const preview = missingWords.slice(0, 10).join(', ');
    throw new Error(
      `Translation pack does not contain all base seed words. Missing ${missingWords.length} word(s): ${preview}`,
    );
  }
}

function collectAllTopicIds(translationEntry, topicMap, word) {
  const topicIds = [];
  const seenTopicIds = new Set();

  for (const translation of translationEntry.translations) {
    for (const topicId of translation.topics) {
      if (!topicMap.has(topicId)) {
        throw new Error(`Unknown topic id "${topicId}" for word "${word}"`);
      }
      if (!seenTopicIds.has(topicId)) {
        seenTopicIds.add(topicId);
        topicIds.push(topicId);
      }
    }
  }

  return topicIds;
}

function resolvePrimaryTopic(translationEntry, topicMap, word) {
  const firstTranslation = translationEntry.translations[0];
  const firstTopicId = firstTranslation && Array.isArray(firstTranslation.topics)
    ? firstTranslation.topics[0]
    : null;
  const primaryTopic = firstTopicId || 'uncategorized';

  if (primaryTopic !== 'uncategorized' && !topicMap.has(primaryTopic)) {
    throw new Error(`Unknown primary topic id "${primaryTopic}" for word "${word}"`);
  }

  if (primaryTopic === 'uncategorized') {
    throw new Error(`Word resolved to uncategorized primary topic: ${word}`);
  }

  return primaryTopic;
}

function validateDuplicateGroupIds(groups) {
  const seenIds = new Set();
  for (const group of groups) {
    if (seenIds.has(group.id)) {
      throw new Error(`Duplicate group ids exist: ${group.id}`);
    }
    seenIds.add(group.id);
  }
}

function validateAssignments(baseEntries, assignments) {
  if (assignments.length !== baseEntries.length) {
    throw new Error(
      `Total assignments does not match total base seed entries: ${assignments.length} !== ${baseEntries.length}`,
    );
  }

  const seenWords = new Set();
  for (const assignment of assignments) {
    if (seenWords.has(assignment.word)) {
      throw new Error(`Duplicate word assignments exist: ${assignment.word}`);
    }
    seenWords.add(assignment.word);
  }
}

function writeJsonAtomically(outputPath, data) {
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, {recursive: true});

  const tempPath = path.join(
    outputDir,
    `.${path.basename(outputPath)}.${process.pid}.${Date.now()}.tmp`,
  );
  const json = JSON.stringify(data, null, 2) + '\n';

  fs.writeFileSync(tempPath, json, 'utf8');
  fs.renameSync(tempPath, outputPath);
}

function printSummary(plan, outputPath, isDryRun) {
  const modeLabel = isDryRun ? 'dry-run' : 'saved';
  console.log(`Mode: ${modeLabel}`);
  console.log(`Total words: ${plan.summary.total_words}`);
  console.log(`Total topics used: ${plan.summary.total_topics}`);
  console.log(`Total study groups: ${plan.summary.total_study_groups}`);
  console.log(`Unassigned words: ${plan.summary.unassigned_words}`);
  console.log(`Saved path: ${toRepoRelativePath(outputPath)}`);
}

function printPreview(plan) {
  const preview = {
    groups: plan.groups.slice(0, 6),
    assignments: plan.assignments.slice(0, 3),
  };

  console.log('Preview:');
  console.log(JSON.stringify(preview, null, 2));
}

function normalizeWord(word) {
  return word.trim();
}

function toRepoRelativePath(targetPath) {
  return path.relative(ROOT_DIR, targetPath) || '.';
}

main();
