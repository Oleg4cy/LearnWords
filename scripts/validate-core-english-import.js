const importPlan = require('../src/assets/importPlans/core-english-3000.ru.import-plan.json');
const translationSeed = require('../src/assets/translations/core-english-3000.ru.seed.json');

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const groupsById = new Map();
const groupNameKeys = new Set();
let studyGroupCount = 0;

for (const group of importPlan.groups) {
  if (groupsById.has(group.id)) {
    fail(`Duplicate group id: ${group.id}`);
  }
  groupsById.set(group.id, group);

  const parentKey = group.parent_id === null ? 'root' : group.parent_id;
  const nameKey = `${parentKey}::${group.name}`;
  if (groupNameKeys.has(nameKey)) {
    fail(`Duplicate group name under same parent: ${nameKey}`);
  }
  groupNameKeys.add(nameKey);

  if (group.type === 'study') {
    studyGroupCount += 1;
  }
}

const translationsByWord = new Map();
for (const entry of translationSeed.translations) {
  if (translationsByWord.has(entry.word)) {
    fail(`Duplicate translation entry for word: ${entry.word}`);
  }
  translationsByWord.set(entry.word, entry);
}

const assignmentWords = new Set();
for (const assignment of importPlan.assignments) {
  if (assignmentWords.has(assignment.word)) {
    fail(`Duplicate assignment for word: ${assignment.word}`);
  }
  assignmentWords.add(assignment.word);

  const translationEntry = translationsByWord.get(assignment.word);
  if (!translationEntry) {
    fail(`Missing translation entry for assigned word: ${assignment.word}`);
    continue;
  }

  if (!Array.isArray(translationEntry.translations) || translationEntry.translations.length === 0) {
    fail(`Word has no translations: ${assignment.word}`);
  }

  let hasStudyGroup = false;
  for (const groupId of assignment.group_ids) {
    const group = groupsById.get(groupId);
    if (!group) {
      fail(`Assignment references missing group "${groupId}" for word "${assignment.word}"`);
      continue;
    }
    if (group.type === 'study') {
      hasStudyGroup = true;
    }
  }

  if (!hasStudyGroup) {
    fail(`Word is not linked to a study group: ${assignment.word}`);
  }
}

if (importPlan.summary.total_words !== importPlan.assignments.length) {
  fail(`Summary total_words mismatch: expected ${importPlan.summary.total_words}, got ${importPlan.assignments.length} assignments`);
}

if (importPlan.summary.total_words !== translationSeed.translations.length) {
  fail(`Summary total_words mismatch: expected ${importPlan.summary.total_words}, got ${translationSeed.translations.length} translation entries`);
}

if (importPlan.summary.total_study_groups !== studyGroupCount) {
  fail(`Summary total_study_groups mismatch: expected ${importPlan.summary.total_study_groups}, got ${studyGroupCount}`);
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}

console.log(`Imported words: ${translationSeed.translations.length}`);
console.log(`Groups: ${importPlan.groups.length}`);
console.log(`Study groups: ${studyGroupCount}`);
console.log('Duplicate groups: 0');
console.log('Duplicate words: 0');
console.log(`Words with at least one translation: ${translationSeed.translations.length}`);
console.log(`Words linked to a study group: ${assignmentWords.size}`);
