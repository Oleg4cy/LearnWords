const fs = require('fs');
const path = require('path');

const dictionaryPath = path.join(__dirname, '..', 'src', 'assets', 'startDB', 'dictionary.json');
const dictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));

const errors = [];
const groups = new Map();
const words = new Set();

for (const group of dictionary.groups || []) {
  if (!group.name) errors.push('Group without name');
  if (!group.context) errors.push(`Group "${group.name}" without context`);
  if (groups.has(group.name)) errors.push(`Duplicate group "${group.name}"`);
  groups.set(group.name, group);
}

for (const word of dictionary.words || []) {
  if (!word.word) {
    errors.push('Word without value');
    continue;
  }

  const wordKey = word.word.toLowerCase();
  if (words.has(wordKey)) errors.push(`Duplicate word "${word.word}"`);
  words.add(wordKey);

  if (!Array.isArray(word.translate) || word.translate.length === 0) {
    errors.push(`Word "${word.word}" has no translations`);
    continue;
  }

  const translations = new Set();
  for (const translate of word.translate) {
    const value = String(translate.value || '').trim();
    if (!value) errors.push(`Word "${word.word}" has empty translation`);

    const context = Array.isArray(translate.context) ? translate.context : [];
    if (context.length === 0) errors.push(`Word "${word.word}" / "${value}" has no context`);
    for (const item of context) {
      if (!item.value) errors.push(`Word "${word.word}" / "${value}" has empty context`);
      if (!item.example) errors.push(`Word "${word.word}" / "${value}" has no example`);
    }

    const translationKey = `${value}:${JSON.stringify(context)}`;
    if (translations.has(translationKey)) {
      errors.push(`Word "${word.word}" has duplicate translation "${value}"`);
    }
    translations.add(translationKey);

    if (!Array.isArray(translate.groups) || translate.groups.length === 0) {
      errors.push(`Word "${word.word}" / "${value}" has no groups`);
    }

    for (const groupName of translate.groups || []) {
      if (!groups.has(groupName)) {
        errors.push(`Word "${word.word}" / "${value}" references unknown group "${groupName}"`);
      }
    }
  }
}

const stats = {
  groups: dictionary.groups.length,
  words: dictionary.words.length,
  translations: dictionary.words.reduce((sum, word) => sum + word.translate.length, 0),
  links: dictionary.words.reduce(
    (sum, word) => sum + word.translate.reduce((inner, item) => inner + item.groups.length, 0),
    0,
  ),
};

console.log(stats);

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
