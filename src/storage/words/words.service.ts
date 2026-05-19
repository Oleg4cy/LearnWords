import { SQLiteDatabase, ResultSet, Transaction } from 'react-native-sqlite-storage';
import ISwords from './words.service';
import SDB from '../db/db.service';

import {TWord, TTranslate, TContext, TGroup} from './words.types';
import {startDBDictionary, TStartDBDictionary} from '../../assets/startDB';

type TStructureTable = {
  [key: string]: string | string[],
  name: string,
  structure: string[],
};

type TStartDB = {
  groups: (TGroup & {id: number})[];
  words: TWord[];
};

type TGetGroupsOptions = {
  wordID?: number | null;
  parentID?: number | null;
};

type TImportPlanGroup = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  word_count: number;
};

type TImportPlanAssignment = {
  word: string;
  primary_topic: string;
  topic_ids: string[];
  group_ids: string[];
};

type TImportPlan = {
  meta: {
    dictionary_id: string;
    language: string;
    translation_language: string;
    group_size: number;
    source_seed: string;
    translation_pack: string;
    topic_seed: string;
    version: number;
  };
  summary: {
    total_words: number;
    total_topics: number;
    total_topic_groups: number;
    total_study_groups: number;
    unassigned_words: number;
  };
  groups: TImportPlanGroup[];
  assignments: TImportPlanAssignment[];
};

type TImportTranslationSeedEntry = {
  word: string;
  translations: Array<{
    language_code: string;
    value: string;
    status: string;
    context?: string;
    example?: string;
    example_translation?: string;
    topics?: string[];
  }>;
};

type TImportTranslationSeed = {
  meta: {
    language_code: string;
    source: string;
    version: number;
  };
  translations: TImportTranslationSeedEntry[];
};

type TImportTopicSeed = {
  meta: {
    version: number;
  };
  topics: Array<{
    id: string;
    name: string;
    description: string;
  }>;
};

const coreEnglish3000ImportPlan = require('../../assets/importPlans/core-english-3000.ru.import-plan.json') as TImportPlan;
const coreEnglish3000TranslationSeed = require('../../assets/translations/core-english-3000.ru.seed.json') as TImportTranslationSeed;
const coreEnglish3000TopicSeed = require('../../assets/topics/core-english-3000.topics.seed.json') as TImportTopicSeed;

const CORE_ENGLISH_IMPORT_SOURCE = 'core-english-3000.ru.import-plan';

const SYSTEM_GROUPS: Array<Pick<TGroup, 'name' | 'kind'>> = [
  {name: 'Sources', kind: 'system'},
  {name: 'Levels', kind: 'system'},
  {name: 'Topics', kind: 'system'},
  {name: 'System', kind: 'system'},
];

export default class SWords implements ISwords {
  private isInitialized = false;
  private static instance: ISwords;
  private db: SQLiteDatabase | null = null;

  private tables: TStructureTable[] = [
    {
      name: 'words',
      structure: [
        'id INTEGER PRIMARY KEY AUTOINCREMENT',
        'word TEXT',
        'correct INTEGER DEFAULT 0',
        'incorrect INTEGER DEFAULT 0',
      ],
    },
    {
      name: 'word_translate',
      structure: [
        'id INTEGER PRIMARY KEY AUTOINCREMENT',
        'word_id  INTEGER',
        'translate TEXT',
        'context TEXT',
        'language_code TEXT NOT NULL DEFAULT \'ru\'',
        'status TEXT NOT NULL DEFAULT \'seed\'',
        'source TEXT NULL',
        'FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE',
      ]
    },
    {
      name: 'groups',
      structure: [
        'id INTEGER PRIMARY KEY AUTOINCREMENT',
        'name TEXT',
        'context TEXT',
        'description TEXT NULL',
        'external_id TEXT NULL',
        'parent_id INTEGER NULL',
        'kind TEXT NOT NULL DEFAULT \'custom\'',
        'FOREIGN KEY (parent_id) REFERENCES groups(id) ON DELETE CASCADE',
      ]
    },
    {
      name: 'word_group',
      structure: [
        'word_id INTEGER',
        'group_id  INTEGER',
        'translate_id INTEGER',
        'translate TEXT',
        'context TEXT',
        'FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE',
        'FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE',
        'FOREIGN KEY (translate_id) REFERENCES word_translate(id) ON DELETE CASCADE',
        'PRIMARY KEY (group_id, word_id, translate_id)',
      ]
    },
    {
      name: 'settings',
      structure: [
        'installed TINYINT DEFAULT 0',
      ]
    },
  ]

  constructor() { }

  private async init() {
    const instanceDB = await SDB.getInstance();
    this.db = await instanceDB.getDBConnection();
    await this.checkInstalled();
    this.isInitialized = true;
  }

  static async getInstance() {
    if (!SWords.instance) {
      SWords.instance = new SWords();
      await SWords.instance.init();
    }
    if ((SWords.instance as SWords).db) {
      return SWords.instance;
    }
    let timeout = 0;
    while (!SWords.instance.isInitialized && timeout < 100) {
      await new Promise(resolve => setTimeout(resolve as unknown as () => void, 100));
      timeout++;
    }
    return SWords.instance;
  }

  private async checkInstalled(): Promise<number> {
    try {
      for (const table of this.tables) {
        await this.checkTable(table);
      }
      await this.migrateSchema();
      if (!(await this.isSchemaActual())) {
        await this.reset();
        await SWords.execute(`INSERT INTO settings (installed) VALUES (1);`);
        await this.ensureCoreEnglishImport();
        return 1;
      }
      const results: ResultSet = await SWords.execute(`SELECT * FROM settings`);
      const result = results.rows.item(0);
      if (result && result.installed === 1) {
        await this.ensureCoreEnglishImport();
        return 1;
      } else {
        await this.reset();
        await SWords.execute(`INSERT INTO settings (installed) VALUES (1);`);
        await this.checkInstalled();
        return 1;
      }
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  }

  private async isSchemaActual(): Promise<boolean> {
    const wordGroupColumns = await this.getTableColumns('word_group');
    const groupColumns = await this.getTableColumns('groups');
    const translationColumns = await this.getTableColumns('word_translate');

    return (
      wordGroupColumns.includes('translate_id') &&
      groupColumns.includes('context') &&
      groupColumns.includes('external_id') &&
      groupColumns.includes('parent_id') &&
      groupColumns.includes('kind') &&
      translationColumns.includes('language_code') &&
      translationColumns.includes('status') &&
      translationColumns.includes('source')
    );
  }

  private async migrateSchema(): Promise<void> {
    const groupColumns = await this.getTableColumns('groups');
    const translationColumns = await this.getTableColumns('word_translate');

    if (!groupColumns.includes('parent_id')) {
      await this.db?.executeSql(
        `ALTER TABLE groups ADD COLUMN parent_id INTEGER NULL;`,
      );
    }

    if (!groupColumns.includes('kind')) {
      await this.db?.executeSql(
        `ALTER TABLE groups ADD COLUMN kind TEXT NOT NULL DEFAULT 'custom';`,
      );
    }

    if (!groupColumns.includes('external_id')) {
      await this.db?.executeSql(
        `ALTER TABLE groups ADD COLUMN external_id TEXT NULL;`,
      );
    }

    if (!translationColumns.includes('language_code')) {
      await this.db?.executeSql(
        `ALTER TABLE word_translate ADD COLUMN language_code TEXT NOT NULL DEFAULT 'ru';`,
      );
    }

    if (!translationColumns.includes('status')) {
      await this.db?.executeSql(
        `ALTER TABLE word_translate ADD COLUMN status TEXT NOT NULL DEFAULT 'seed';`,
      );
    }

    if (!translationColumns.includes('source')) {
      await this.db?.executeSql(
        `ALTER TABLE word_translate ADD COLUMN source TEXT NULL;`,
      );
    }

    await SWords.execute(
      `UPDATE groups
       SET kind = COALESCE(NULLIF(kind, ''), 'custom')
      `,
    );

    await SWords.execute(
      `UPDATE word_translate
       SET language_code = COALESCE(NULLIF(language_code, ''), 'ru'),
           status = COALESCE(NULLIF(status, ''), 'seed')
      `,
    );
  }

  private async getTableColumns(tableName: string): Promise<string[]> {
    const results = await this.db?.executeSql(`PRAGMA table_info(${tableName});`);
    const columns: string[] = [];
    const rows = results?.[0]?.rows;

    if (!rows) {
      return columns;
    }

    for (let i = 0; i < rows.length; i++) {
      columns.push(rows.item(i).name);
    }

    return columns;
  }

  private static async execute(sql: string, params: Array<any> = []): Promise<ResultSet> {
    const instance = await SWords.getInstance();
    return new Promise((resolve, reject) => {
      try {
        instance.db?.transaction((tx: Transaction) => {
          tx.executeSql(sql, params,
            (tx: Transaction, results: ResultSet) => {
              resolve(results)
            },
            (error: any) => {
              reject(error);
              console.error(error);
            }
          );
        });
      } catch (error) {
        throw error;
      }
    });
  }

  static async getDictionaryCount(): Promise<number> {
    try {
      const results: ResultSet = await SWords.execute(`SELECT COUNT(id) as count FROM words`);
      const result = results.rows.item(0);
      if (result) {
        return result.count;
      }
      throw new Error("No count result");
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  }

  static async getWithoutGroupsCount(): Promise<number> {
    const sql = `
        SELECT COUNT(words.id) as count
        FROM words
        LEFT JOIN word_group ON word_group.word_id = words.id
        WHERE word_group.word_id IS NULL
    `;

    try {
      const results: ResultSet = await SWords.execute(sql);
      const result = results.rows.item(0);
      if (result) {
        return result.count;
      } else {
        throw new Error("Result is null");
      }
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  }

  // static async getWordsList(groupID?: number | null | 'null'): Promise<TWord[]> {
  static async getWordsList(groupID?: number | null): Promise<TWord[]> {
    let sql = `
      SELECT
        words.*,
        groups.name as group_name,
        groups.id as group_id,
        groups.description as group_description
      FROM words
      LEFT JOIN word_group ON word_group.word_id = words.id
      LEFT JOIN groups ON groups.id = word_group.group_id
    `;

    // if (groupID == 'null' || groupID === null) {
    if (groupID === null) {
      sql += ` WHERE word_group.word_id IS NULL`;
    } else if (groupID !== 0) {
      sql += ` WHERE word_group.group_id = ${groupID}`;
    }
    sql += ` GROUP BY words.id`;

    try {
      const results: ResultSet = await SWords.execute(sql);
      const len = results.rows.length;
      const words: TWord[] = [];

      for (let i = 0; i < len; i++) {
        const row = results.rows.item(i);
        words.push(row);
      }
      return words;
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  }

  private static createWordData(results: ResultSet): TWord {
    const wordTranslations: TTranslate[] = SWords.createTranslationsData(results);
    const word: TWord = {
      id: results.rows.item(0).id,
      word: results.rows.item(0).word,
      translate: wordTranslations,
    };

    return word;
  }

  private static createTranslationsData(results: ResultSet): TTranslate[] {
    const wordTranslations: TTranslate[] = [];
    const usedTranslationIDs = new Set<number>();

    for (let i = 0; i < results.rows.length; i++) {
      const result = results.rows.item(i);
      if (result.t_id && usedTranslationIDs.has(result.t_id)) {
        continue;
      }
      if (result.t_id) {
        usedTranslationIDs.add(result.t_id);
      }
      const rawContext = JSON.parse(result.context || '[]');
      const context: TContext[] = rawContext.map((item: any) =>
        typeof item === 'string' ? { value: item } : item,
      );
      const translation: TTranslate = {
        id: result.t_id ?? result.id,
        value: result.translate,
        context,
        language_code: result.language_code ?? 'ru',
        status: result.status ?? 'seed',
        source: result.source ?? undefined,
      };
      wordTranslations.push(translation);
    }

    return wordTranslations;
  }

  static async getRandom(groupID: number = 0): Promise<TWord | null> {
    const sql = `
      SELECT words.*,
        word_translate.id as t_id,
        word_translate.translate,
        word_translate.context,
        word_translate.language_code,
        word_translate.status,
        word_translate.source
      FROM words
      LEFT JOIN word_translate ON words.id = word_translate.word_id
      ${groupID ? `
        INNER JOIN word_group AS active_word_group
          ON active_word_group.translate_id = word_translate.id
          AND active_word_group.group_id = (?)
      ` : ''}
      WHERE words.id = (
        SELECT words.id
        FROM words
        ${groupID ? `
          INNER JOIN word_group ON word_group.word_id = words.id
        ` : ''}
        ${groupID ? `WHERE word_group.group_id = (?)` : ''}
        GROUP BY words.id
        ORDER BY RANDOM()
        LIMIT 1
      )
    ;`
    const params = groupID ? [groupID, groupID] : [];

    try {
      const results: ResultSet = await SWords.execute(sql, params);
      if (results.rows.length === 0) {
        return null;
      }
      const word: TWord = SWords.createWordData(results);
      return word;
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  }

  static async getNextWordInGroup(wordID: number, groupID: number, order: 'next' | 'prev'): Promise<TWord | null> {
    const sql = `
      SELECT
        words.id
      FROM words
      ${groupID ? `
        INNER JOIN word_group
          ON word_group.word_id = words.id
          AND word_group.group_id = (?)
      ` : ''}
      WHERE
        words.word COLLATE NOCASE ${order === 'next' ? '>' : '<'} (SELECT words.word FROM words WHERE id = ?)
      GROUP BY words.id
      ORDER BY words.word COLLATE NOCASE ${order === 'next' ? 'ASC' : 'DESC'}
      LIMIT 1
    `;
    const params = groupID ? [groupID, wordID] : [wordID];

    try {
      const results: ResultSet = await SWords.execute(sql, params);
      if (results.rows.length > 0) {
        const nextWordID = results.rows.item(0).id;
        return SWords.getByID(nextWordID, groupID);
      }
      return null;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  static async getExtremeWordInGroup(groupID: number, extreme: 'first' | 'last'): Promise<TWord | null> {
    const sql = `
      SELECT
        words.id
      FROM words
      ${groupID ? `
        INNER JOIN word_group
          ON word_group.word_id = words.id
          AND word_group.group_id = (?)
      ` : ''}
      GROUP BY words.id
      ORDER BY words.word ${extreme === 'first' ? 'ASC' : 'DESC'}
      LIMIT 1
    `;
    const params = groupID ? [groupID] : [];

    try {
      const results: ResultSet = await SWords.execute(sql, params);
      if (results.rows.length > 0) {
        const wordID = results.rows.item(0).id;
        return SWords.getByID(wordID, groupID);
      }
      return null;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  static async getRandomAnswers(wordID: number, groupID: number = 0): Promise<TTranslate[]> {
    const sql = `
      SELECT word_translate.*
      FROM word_translate
      ${groupID ? `
        INNER JOIN word_group
          ON word_group.translate_id = word_translate.id
          AND word_group.group_id = (?)
      ` : ''}
      WHERE word_translate.word_id <> (?)
      ORDER BY RANDOM() LIMIT 5
    `;
    const params = groupID ? [groupID, wordID] : [wordID];

    try {
      const results: ResultSet = await SWords.execute(sql, params);
      if (results.rows.length > 0) {
        const wordTranslations: TTranslate[] = SWords.createTranslationsData(results);
        return wordTranslations;
      }
      return [];
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  static async getByID(id: number, groupID: number = 0): Promise<TWord | null> {
    const sql = `
      SELECT
          words.*,
          word_translate.id as t_id,
          word_translate.translate,
          word_translate.context,
          word_translate.language_code,
          word_translate.status,
          word_translate.source,
          CASE WHEN active_word_group.group_id IS NULL THEN 1 ELSE 0 END AS group_priority
      FROM words
      LEFT JOIN word_translate ON words.id = word_translate.word_id
      LEFT JOIN word_group AS active_word_group
        ON active_word_group.translate_id = word_translate.id
        AND active_word_group.group_id = (?)
      WHERE words.id = (?)
      ORDER BY group_priority ASC, word_translate.id ASC
    `;
    const params = [groupID, id];

    try {
      const results: ResultSet = await SWords.execute(sql, params);
      if (results.rows.length > 0) {
        const word: TWord = SWords.createWordData(results);
        return word;
      }
      return null;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  static async save(word: TWord): Promise<string> {
    const sql = `SELECT id FROM words WHERE word=(?)`;
    const params = [word.word];

    try {
      const results: ResultSet = await SWords.execute(sql, params);
      if (results.rows.length === 0) {
        try {
          await SWords.insertWordAndTranslations(word);
          return 'ok';
        } catch (error: any) {
          console.log(error);
          return 'error';
        }
      } else {
        return 'duplicate';
      }
    } catch (error: any) {
      console.log(error);
      throw error;
    }
  }

  private static async insertWordAndTranslations(word: TWord): Promise<boolean> {
    const sql = 'INSERT INTO words (word) VALUES (?)';
    const params = [word.word];

    try {
      const results: ResultSet = await SWords.execute(sql, params);
      const insertedWordID: number = results.insertId;

      if (word.translate && Array.isArray(word.translate)) {
        const translationPromises = word.translate.map(async (translateData: TTranslate) => {
          if (translateData.value > '') {
            const results = await SWords.insertTranslation(translateData, insertedWordID);
            if (word.groups && results.insertId) {
              const groupPromises = (word.groups as number[]).map(async (group: number) => {
                await SWords.insertGroup(group, insertedWordID, results.insertId);
              });
              await Promise.all(groupPromises);
            }
          }
        });
        await Promise.all(translationPromises);
      }

      return true;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private static async insertTranslation(translate: TTranslate, insertedWordId: number) {
    const sql = `
      INSERT INTO word_translate (word_id, translate, context, language_code, status, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const { context, value } = translate;
    const filtered = (context || []).filter(
      (ctx: TContext) => ctx.value !== '' || !!ctx.example || !!ctx.example_translation,
    );
    const contextJson: string = JSON.stringify(filtered);
    const params = [
      insertedWordId,
      value,
      contextJson,
      translate.language_code ?? 'ru',
      translate.status ?? 'approved',
      translate.source ?? 'manual',
    ];
    try {
      const results: ResultSet = await SWords.execute(sql, params);
      return results;
    } catch (error) {
      throw error;
    }
  }

  private static async updateWord(word: TWord): Promise<ResultSet> {
    const sql = 'UPDATE words SET word = ? WHERE id = ?';
    const params = [word.word, word.id];
    return SWords.execute(sql, params);
  }

  private static async updateTranslation(translateData: TTranslate): Promise<ResultSet> {
    const sql = `
      UPDATE word_translate
      SET translate = ?, context = ?, language_code = ?, status = ?, source = ?
      WHERE id = ?
    `;
    const filtered = (translateData.context || []).filter(
      (ctx: TContext) => ctx.value !== '' || !!ctx.example || !!ctx.example_translation,
    );
    const contextJson: string = JSON.stringify(filtered);
    const params = [
      translateData.value,
      contextJson,
      translateData.language_code ?? 'ru',
      translateData.status ?? 'approved',
      translateData.source ?? 'manual',
      translateData.id,
    ];
    return SWords.execute(sql, params);
  }

  private static async deleteTranslation(translateData: TTranslate): Promise<ResultSet> {
    const sql = 'DELETE FROM word_translate WHERE id = ?';
    return SWords.execute(sql, [translateData.id]);
  }

  static async update(word: TWord): Promise<boolean> {
    if (word.word === '') return false;

    try {
      await SWords.updateWord(word);
      if (word.id && word.groups) {
        await SWords.updateWordGroups(word.id, word.groups as number[]);
      }

      if (word.translate && Array.isArray(word.translate)) {
        const promises = word.translate.map(async (translateData: TTranslate) => {
          if (translateData.new && word.id) {
            const results = await SWords.insertTranslation(translateData, word.id);
            if (word.groups && results.insertId) {
              await Promise.all((word.groups as number[]).map((groupID: number) =>
                SWords.insertGroup(groupID, word.id as number, results.insertId),
              ));
            }
          } else if (translateData.removed) {
            await SWords.deleteTranslation(translateData);
          } else {
            await SWords.updateTranslation(translateData);
          }
        });

        await Promise.all(promises);
        return true;
      }
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  private static async updateWordGroups(wordID: number, groups: number[]): Promise<void> {
    await SWords.execute('DELETE FROM word_group WHERE word_id = ?', [wordID]);
    const translationResults = await SWords.execute(
      'SELECT id FROM word_translate WHERE word_id = ?',
      [wordID],
    );
    const translationIDs: number[] = [];
    for (let i = 0; i < translationResults.rows.length; i++) {
      translationIDs.push(translationResults.rows.item(i).id);
    }
    const insertGroupPromises = groups.flatMap((groupID: number) =>
      translationIDs.map(async (translateID: number) => {
        await SWords.insertGroup(groupID, wordID, translateID);
      }),
    );
    await Promise.all(insertGroupPromises);
  }

  static async removeByID(id: number) {
    try {
      await SWords.execute('DELETE FROM word_translate WHERE word_id = ?', [id]);
      await SWords.execute('DELETE FROM word_group WHERE word_id = ?', [id]);
      await SWords.execute('DELETE FROM words WHERE id = ?', [id]);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  static async removeGroups(groupIDs: number[], deleteWords: boolean = false): Promise<void> {
    if (groupIDs.length === 0) return;

    const groupPlaceholders = SWords.createPlaceholders(groupIDs.length);

    try {
      let wordIDs: number[] = [];

      if (deleteWords) {
        const wordsResult = await SWords.execute(
          `SELECT DISTINCT word_id FROM word_group WHERE group_id IN (${groupPlaceholders})`,
          groupIDs,
        );

        for (let i = 0; i < wordsResult.rows.length; i++) {
          const row = wordsResult.rows.item(i);
          if (row.word_id) {
            wordIDs.push(row.word_id);
          }
        }
      }

      await SWords.execute(
        `DELETE FROM word_group WHERE group_id IN (${groupPlaceholders})`,
        groupIDs,
      );
      await SWords.execute(
        `DELETE FROM groups WHERE id IN (${groupPlaceholders})`,
        groupIDs,
      );

      if (deleteWords && wordIDs.length > 0) {
        const wordPlaceholders = SWords.createPlaceholders(wordIDs.length);
        await SWords.execute(
          `DELETE FROM word_translate WHERE word_id IN (${wordPlaceholders})`,
          wordIDs,
        );
        await SWords.execute(
          `DELETE FROM word_group WHERE word_id IN (${wordPlaceholders})`,
          wordIDs,
        );
        await SWords.execute(
          `DELETE FROM words WHERE id IN (${wordPlaceholders})`,
          wordIDs,
        );
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private static createPlaceholders(count: number): string {
    return Array.from({ length: count }, () => '?').join(', ');
  }

  static async getGroups(options: TGetGroupsOptions = {}): Promise<TGroup[]> {
    const {wordID, parentID} = options;
    const whereClauses: string[] = [];
    const params: Array<number> = [];

    if (typeof wordID === 'number') {
      whereClauses.push('words.id = ?');
      params.push(wordID);
    }

    if (parentID === null) {
      whereClauses.push('groups.parent_id IS NULL');
    } else if (typeof parentID === 'number') {
      whereClauses.push('groups.parent_id = ?');
      params.push(parentID);
    }

    const whereSql = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const sql = `
      SELECT
        groups.*,
        COUNT(DISTINCT words.id) AS count,
        COUNT(DISTINCT child_groups.id) AS child_count
      FROM groups
      LEFT JOIN word_group ON groups.id = word_group.group_id
      LEFT JOIN words ON word_group.word_id = words.id
      LEFT JOIN groups AS child_groups ON child_groups.parent_id = groups.id
      ${whereSql}
      GROUP BY groups.id
      ORDER BY groups.name COLLATE NOCASE ASC
    ;`;

    try {
      const results: ResultSet = await SWords.execute(sql, params);

      if (!results || !results.rows) {
        console.log('No results or rows found.');
        return [];
      }

      const groups: TGroup[] = [];

      for (let i = 0; i < results.rows.length; i++) {
        const result = results.rows.item(i) as TGroup;
        groups.push(result);
      }

      return groups;
    } catch (error) {
      console.log('Error fetching groups:', error);
      throw error;
    }
  }

  static async createGroup(
    name: string,
    description?: string,
    context?: string,
    parentID?: number | null,
    kind: string = 'custom',
  ): Promise<string | number> {
    const hasParent = typeof parentID === 'number';
    const selectQuery = hasParent
      ? 'SELECT COUNT(*) AS count FROM groups WHERE name = ? AND parent_id = ?'
      : 'SELECT COUNT(*) AS count FROM groups WHERE name = ? AND parent_id IS NULL';
    const selectParams = hasParent ? [name, parentID] : [name];
    const insertQuery = 'INSERT INTO groups (name, description, context, parent_id, kind) VALUES (?, ?, ?, ?, ?)';
    const insertParams = [name, description ?? null, context ?? null, parentID ?? null, kind];

    try {
      const resultsSelect: ResultSet = await SWords.execute(selectQuery, selectParams);
      const count = resultsSelect.rows.item(0).count;

      if (count > 0) {
        return 'duplicate';
      }

      const resultsInsert: ResultSet = await SWords.execute(insertQuery, insertParams);
      return resultsInsert.insertId;

    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private static async insertGroup(groupID: number, wordID: number, translateID?: number) {
    const sql = 'INSERT INTO word_group (group_id, word_id, translate_id) VALUES (?, ?, ?)';
    const params = [groupID, wordID, translateID ?? null];
    try {
      await SWords.execute(sql, params);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private async dropTable(table: TStructureTable) {
    try {
      const dropTableQuery = `DROP TABLE IF EXISTS ${table.name};`;
      await this.db?.executeSql(dropTableQuery);
    } catch (error) {
      throw error;
    }
  }

  private async checkTable(table: TStructureTable) {
    const query = `CREATE TABLE IF NOT EXISTS ${table.name} (${table.structure.join(', ')});`
    try {
      await this.db?.executeSql(query);
    } catch (error) {
      console.log('Ошибка при создании таблицы:', error);
      throw error;
    }
  }

  private async reset(options: {seedLegacyData?: boolean} = {}) {
    try {
      for (const table of this.tables) {
        await this.dropTable(table);
        await this.checkTable(table);
      }
      if (options.seedLegacyData !== false) {
        const result: TStartDB = await this.getFromJSON();
        await this.seedStartDB(result);
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private async seedStartDB(dictionary: TStartDB): Promise<void> {
    if (!this.db) {
      throw new Error('Database connection is not initialized');
    }

    const groupIDs = new Map<string, number>();
    const translations = new Set<string>();

    return new Promise((resolve, reject) => {
      try {
        this.db?.transaction(
          (tx: Transaction) => {
            for (const group of dictionary.groups) {
              groupIDs.set(group.name, group.id);
            }

            let translationID = 1;
            dictionary.words.forEach((word: TWord, wordIndex: number) => {
              const wordID = wordIndex + 1;
              tx.executeSql(
                'INSERT INTO words (id, word) VALUES (?, ?)',
                [wordID, word.word],
              );

              for (const translate of word.translate || []) {
                if (translate.value <= '') {
                  continue;
                }

                const filtered = (translate.context || []).filter(
                  (ctx: TContext) => ctx.value !== '' || !!ctx.example || !!ctx.example_translation,
                );
                const contextJson = JSON.stringify(filtered);
                const translationKey = `${wordID}:${translate.value}:${contextJson}`;
                if (translations.has(translationKey)) {
                  continue;
                }

                const currentTranslationID = translationID;
                translationID++;
                translations.add(translationKey);
                tx.executeSql(
                  `
                    INSERT INTO word_translate
                    (id, word_id, translate, context, language_code, status, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                  `,
                  [currentTranslationID, wordID, translate.value, contextJson, 'ru', 'seed', 'seed'],
                );

                const translateGroups = (translate.groups || [])
                  .map((group) => typeof group === 'number' ? group : groupIDs.get(group))
                  .filter((groupID): groupID is number => typeof groupID === 'number' && groupID > 0);
                const uniqueTranslateGroups = [...new Set(translateGroups)];

                for (const groupID of uniqueTranslateGroups) {
                  tx.executeSql(
                    'INSERT OR IGNORE INTO word_group (group_id, word_id, translate_id, translate, context) VALUES (?, ?, ?, ?, ?)',
                    [groupID, wordID, currentTranslationID, translate.value, contextJson],
                  );
                }
              }
            });
          },
          (error: any) => reject(error),
          () => resolve(),
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  private async getFromJSON(): Promise<TStartDB> {
    try {
      await this.ensureSystemGroups();

      const groups: (TGroup & {id: number})[] = [];
      for (const group of startDBDictionary.groups) {
        const groupIDResult = await SWords.createGroup(
          group.name,
          group.description,
          group.context,
          null,
          'legacy',
        );
        if (typeof groupIDResult === 'number') {
          groups.push({...group, id: groupIDResult, parent_id: null, kind: 'legacy'});
        }
      }

      return {
        groups,
        words: startDBDictionary.words,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private async ensureSystemGroups(): Promise<void> {
    for (const group of SYSTEM_GROUPS) {
      const result = await SWords.createGroup(
        group.name,
        undefined,
        undefined,
        null,
        group.kind ?? 'system',
      );

      if (result !== 'duplicate' && typeof result !== 'number') {
        throw new Error(`Failed to create system group "${group.name}"`);
      }
    }
  }

  private async ensureCoreEnglishImport(): Promise<void> {
    const assignmentByWord = new Map<string, TImportPlanAssignment>();
    for (const assignment of coreEnglish3000ImportPlan.assignments) {
      assignmentByWord.set(assignment.word, assignment);
    }

    const translationByWord = new Map<string, TImportTranslationSeedEntry>();
    for (const entry of coreEnglish3000TranslationSeed.translations) {
      translationByWord.set(entry.word, entry);
    }

    if (assignmentByWord.size !== coreEnglish3000ImportPlan.summary.total_words) {
      throw new Error('Core English import plan assignments count does not match summary');
    }

    if (translationByWord.size !== coreEnglish3000ImportPlan.summary.total_words) {
      throw new Error('Core English translation seed count does not match import plan summary');
    }

    const groupIDByExternalID = await this.ensureImportedGroups();
    const wordsByValue = await this.getWordIDByValue();
    const translationsByKey = await this.getTranslationRowByKey();

    for (const [wordValue, assignment] of assignmentByWord.entries()) {
      const translationEntry = translationByWord.get(wordValue);
      if (!translationEntry) {
        throw new Error(`Missing translation seed entry for "${wordValue}"`);
      }

      const wordID = await this.ensureImportedWord(wordValue, wordsByValue);
      for (const translation of translationEntry.translations) {
        if (!translation.value) {
          continue;
        }

        const languageCode = translation.language_code || coreEnglish3000TranslationSeed.meta.language_code;
        const context = this.createImportContext(translation);
        const contextJson = JSON.stringify(context);
        const translationKey = this.createTranslationKey(
          wordID,
          languageCode,
          translation.value,
          contextJson,
        );

        let translationRow = translationsByKey.get(translationKey);
        if (!translationRow) {
          const insertResult = await SWords.execute(
            `
              INSERT INTO word_translate
              (word_id, translate, context, language_code, status, source)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
              wordID,
              translation.value,
              contextJson,
              languageCode,
              translation.status || 'seed',
              CORE_ENGLISH_IMPORT_SOURCE,
            ],
          );

          translationRow = {
            id: insertResult.insertId,
            source: CORE_ENGLISH_IMPORT_SOURCE,
          };
          translationsByKey.set(translationKey, translationRow);
        } else if (translationRow.source === CORE_ENGLISH_IMPORT_SOURCE || translationRow.source === 'seed' || !translationRow.source) {
          await SWords.execute(
            `
              UPDATE word_translate
              SET status = ?, source = ?
              WHERE id = ?
            `,
            [
              translation.status || 'seed',
              CORE_ENGLISH_IMPORT_SOURCE,
              translationRow.id,
            ],
          );
          translationRow.source = CORE_ENGLISH_IMPORT_SOURCE;
        }

        for (const groupExternalID of assignment.group_ids) {
          const groupID = groupIDByExternalID.get(groupExternalID);
          if (!groupID) {
            throw new Error(`Missing DB group for import group "${groupExternalID}"`);
          }

          await SWords.execute(
            `
              INSERT OR IGNORE INTO word_group (group_id, word_id, translate_id, translate, context)
              VALUES (?, ?, ?, ?, ?)
            `,
            [groupID, wordID, translationRow.id, translation.value, contextJson],
          );
        }
      }
    }
  }

  private async ensureImportedGroups(): Promise<Map<string, number>> {
    const existingGroups = await SWords.execute(
      `
        SELECT id, name, context, description, parent_id, kind, external_id
        FROM groups
      `,
    );
    const groupsByExternalID = new Map<string, TGroup & {id: number}>();

    for (let i = 0; i < existingGroups.rows.length; i++) {
      const group = existingGroups.rows.item(i) as TGroup & {id: number};
      if (group.external_id) {
        groupsByExternalID.set(group.external_id, group);
      }
    }

    const topicDescriptionByGroupExternalID = new Map<string, string>();
    for (const topic of coreEnglish3000TopicSeed.topics) {
      topicDescriptionByGroupExternalID.set(`topic-${topic.id}`, topic.description);
    }

    const groupIDByExternalID = new Map<string, number>();
    const groupNameByExternalID = new Map<string, string>();

    for (const group of coreEnglish3000ImportPlan.groups) {
      let parentID: number | null = null;
      if (group.parent_id) {
        parentID = groupIDByExternalID.get(group.parent_id) ?? null;
        if (!parentID) {
          throw new Error(`Parent group "${group.parent_id}" was not created before "${group.id}"`);
        }
      }

      const description = group.type === 'topic'
        ? topicDescriptionByGroupExternalID.get(group.id) ?? null
        : null;
      const context = group.type === 'study' && group.parent_id
        ? groupNameByExternalID.get(group.parent_id) ?? null
        : null;
      let currentGroup = groupsByExternalID.get(group.id);

      if (!currentGroup) {
        const insertResult = await SWords.execute(
          `
            INSERT INTO groups (name, description, context, external_id, parent_id, kind)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [group.name, description, context, group.id, parentID, group.type],
        );
        currentGroup = {
          id: insertResult.insertId,
          name: group.name,
          description: description ?? undefined,
          context: context ?? undefined,
          external_id: group.id,
          parent_id: parentID,
          kind: group.type,
        };
      } else {
        await SWords.execute(
          `
            UPDATE groups
            SET name = ?, description = ?, context = ?, external_id = ?, parent_id = ?, kind = ?
            WHERE id = ?
          `,
          [group.name, description, context, group.id, parentID, group.type, currentGroup.id],
        );
        currentGroup = {
          ...currentGroup,
          name: group.name,
          description: description ?? undefined,
          context: context ?? undefined,
          external_id: group.id,
          parent_id: parentID,
          kind: group.type,
        };
      }

      groupsByExternalID.set(group.id, currentGroup);
      groupIDByExternalID.set(group.id, currentGroup.id);
      groupNameByExternalID.set(group.id, group.name);
    }

    const validImportedGroupIDs = new Set(
      coreEnglish3000ImportPlan.groups.map((group) => group.id),
    );
    const staleImportedGroupIDs: number[] = [];

    for (const [externalID, group] of groupsByExternalID.entries()) {
      const isCoreEnglishImportedGroup = externalID === 'english'
        || externalID === coreEnglish3000ImportPlan.meta.dictionary_id
        || externalID.startsWith('topic-');

      if (isCoreEnglishImportedGroup && !validImportedGroupIDs.has(externalID)) {
        staleImportedGroupIDs.push(group.id);
      }
    }

    if (staleImportedGroupIDs.length > 0) {
      const placeholders = SWords.createPlaceholders(staleImportedGroupIDs.length);
      await SWords.execute(
        `DELETE FROM word_group WHERE group_id IN (${placeholders})`,
        staleImportedGroupIDs,
      );
      await SWords.execute(
        `DELETE FROM groups WHERE id IN (${placeholders})`,
        staleImportedGroupIDs,
      );
    }

    return groupIDByExternalID;
  }

  private async getWordIDByValue(): Promise<Map<string, number>> {
    const results = await SWords.execute(`SELECT id, word FROM words`);
    const wordsByValue = new Map<string, number>();

    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i) as {id: number; word: string};
      wordsByValue.set(row.word, row.id);
    }

    return wordsByValue;
  }

  private async ensureImportedWord(wordValue: string, wordsByValue: Map<string, number>): Promise<number> {
    const existingWordID = wordsByValue.get(wordValue);
    if (existingWordID) {
      return existingWordID;
    }

    const insertResult = await SWords.execute(
      `INSERT INTO words (word) VALUES (?)`,
      [wordValue],
    );
    wordsByValue.set(wordValue, insertResult.insertId);
    return insertResult.insertId;
  }

  private async getTranslationRowByKey(): Promise<Map<string, {id: number; source?: string}>> {
    const results = await SWords.execute(
      `
        SELECT id, word_id, translate, context, language_code, source
        FROM word_translate
      `,
    );
    const translationsByKey = new Map<string, {id: number; source?: string}>();

    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i) as {
        id: number;
        word_id: number;
        translate: string;
        context: string | null;
        language_code: string;
        source?: string;
      };
      const contextJson = row.context ?? '[]';
      translationsByKey.set(
        this.createTranslationKey(row.word_id, row.language_code, row.translate, contextJson),
        {id: row.id, source: row.source},
      );
    }

    return translationsByKey;
  }

  private createImportContext(translation: TImportTranslationSeedEntry['translations'][number]): TContext[] {
    if (!translation.context && !translation.example && !translation.example_translation) {
      return [];
    }

    return [{
      value: translation.context ?? '',
      example: translation.example,
      example_translation: translation.example_translation,
    }];
  }

  private createTranslationKey(
    wordID: number,
    languageCode: string,
    translateValue: string,
    contextJson: string,
  ): string {
    return [wordID, languageCode, translateValue, contextJson].join('::');
  }

  static async resetForDevelopment(confirmation: string): Promise<void> {
    if (!__DEV__) {
      throw new Error('Development DB reset is available only in development builds');
    }

    if (confirmation !== 'RESET_LEARNWORDS_DEV_DB') {
      throw new Error('Development DB reset requires the exact confirmation token');
    }

    const instance = await SWords.getInstance() as SWords;
    await instance.reset({seedLegacyData: false});
    await SWords.execute(`INSERT INTO settings (installed) VALUES (1);`);
    await instance.ensureCoreEnglishImport();
  }
}
