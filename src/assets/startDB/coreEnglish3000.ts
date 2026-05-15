export type TCoreEnglish3000Translation = {
  language_code: string;
  value: string;
  status: string;
  context?: string;
  example?: string;
  example_translation?: string;
  topics?: string[];
};

export type TCoreEnglish3000Entry = {
  word: string;
  normalized: string;
  part_of_speech: string | null;
  level: string | null;
  rank: number | null;
  sources: string[];
  translations: TCoreEnglish3000Translation[];
};

export type TCoreEnglish3000TranslationSeedEntry = {
  word: string;
  translations: TCoreEnglish3000Translation[];
};

export type TCoreEnglish3000TranslationSeed = {
  meta: {
    language_code: string;
    source: string;
    version: number;
  };
  translations: TCoreEnglish3000TranslationSeedEntry[];
};

export type TCoreEnglish3000Topic = {
  id: string;
  name: string;
  description: string;
};

export type TCoreEnglish3000TopicSeed = {
  meta: {
    version: number;
  };
  topics: TCoreEnglish3000Topic[];
};

export type TCoreEnglish3000Seed = {
  meta: {
    id: string;
    name: string;
    version: number;
    base_language: string;
    description: string;
    sources: string[];
  };
  entries: TCoreEnglish3000Entry[];
};

export const rawCoreEnglish3000 = require('./core-english-3000.seed.json') as TCoreEnglish3000Seed;
