import { SQLiteDatabase, ResultSet, Transaction } from 'react-native-sqlite-storage';
import ISwords from './words.service';
import SDB from '../db/db.service';

import {TWord, TTranslate, TContext, TGroup} from './words.types';
import {startDBChunks, TStartDBChunk} from '../../assets/startDB';

type TStructureTable = {
  [key: string]: string | string[],
  name: string,
  structure: string[],
};

type TStartDB = {data: TWord[]; groups: number[]}[];

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
        'FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE',
      ]
    },
    {
      name: 'groups',
      structure: [
        'id INTEGER PRIMARY KEY AUTOINCREMENT',
        'name TEXT',
        'description TEXT NULL',
      ]
    },
    {
      name: 'word_group',
      structure: [
        'word_id INTEGER',
        'group_id  INTEGER',
        'translate TEXT',
        'context TEXT',
        'FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE',
        'FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE',
        'PRIMARY KEY (group_id, word_id)',
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
    this.checkInstalled();
    this.isInitialized = true;
  }

  static async getInstance() {
    if (!SWords.instance) {
      SWords.instance = new SWords();
      await SWords.instance.init();
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
      const results: ResultSet = await SWords.execute(`SELECT * FROM settings`);
      const result = results.rows.item(0);
      if (result && result.installed === 1) {
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
      sql += ` WHERE groups.id = ${groupID}`;
    }

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

    for (let i = 0; i < results.rows.length; i++) {
      const result = results.rows.item(i);
      const rawContext = JSON.parse(result.context || '[]');
      const context: TContext[] = rawContext.map((item: any) =>
        typeof item === 'string' ? { value: item } : item,
      );
      const translation: TTranslate = {
        id: result.t_id,
        value: result.translate,
        context,
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
        word_translate.context
      FROM words
      LEFT JOIN word_translate on words.id=word_translate.word_id
      ${groupID ? `
        LEFT JOIN word_group ON word_group.word_id = words.id
        LEFT JOIN groups ON groups.id = word_group.group_id
      ` : ''}
      ${groupID ? `WHERE groups.id = (?)` : ''}
      ORDER BY RANDOM()
      LIMIT 1
    ;`
    const params = groupID ? [groupID] : [];

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
        words.*,
        word_translate.id as t_id,
        word_translate.translate,
        word_translate.context
      FROM words
      LEFT JOIN word_translate ON words.id = word_translate.word_id
      ${groupID ? `
        LEFT JOIN word_group ON word_group.word_id = words.id
        LEFT JOIN groups ON groups.id = word_group.group_id
      ` : ''}
      WHERE
        ${groupID ? `groups.id = (?) AND` : ''}
        words.word COLLATE NOCASE ${order === 'next' ? '>' : '<'} (SELECT words.word FROM words WHERE id = ?)
      ORDER BY words.word COLLATE NOCASE ${order === 'next' ? 'ASC' : 'DESC'}
      LIMIT 1
    `;
    const params = groupID ? [groupID, wordID] : [wordID];

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

  static async getExtremeWordInGroup(groupID: number, extreme: 'first' | 'last'): Promise<TWord | null> {
    const sql = `
      SELECT
        words.*,
        word_translate.id as t_id,
        word_translate.translate,
        word_translate.context
      FROM words
      LEFT JOIN word_translate ON words.id = word_translate.word_id
      ${groupID ? `
        LEFT JOIN word_group ON word_group.word_id = words.id
        LEFT JOIN groups ON groups.id = word_group.group_id
        WHERE groups.id = (?)
      ` : ''}
      ORDER BY words.word ${extreme === 'first' ? 'ASC' : 'DESC'}
      LIMIT 1
    `;
    const params = groupID ? [groupID] : [];

    try {
      const results: ResultSet = await SWords.execute(sql, params);
      if (results.rows.length > 0) {
        const word: TWord = SWords.createWordData(results);
        return word;
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
        LEFT JOIN word_group ON word_group.word_id = word_translate.word_id
        LEFT JOIN groups ON groups.id = word_group.group_id
      ` : ''}
      WHERE word_translate.word_id <> (?)
      ${groupID ? `AND groups.id = (?)` : ''}
      ORDER BY RANDOM() LIMIT 5
    `;
    const params = groupID ? [wordID, groupID] : [wordID];

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

  static async getByID(id: number): Promise<TWord | null> {
    const sql = `
      SELECT
          words.*,
          word_translate.id as t_id,
          word_translate.translate,
          word_translate.context
      FROM words
      LEFT JOIN word_translate ON words.id = word_translate.word_id
      WHERE words.id = (?)
    `;
    const params = [id];

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

      if (word.groups) {
        const groupPromises = (word.groups as number[]).map(async (group: number) => {
          await SWords.insertGroup(group, insertedWordID);
        });
        await Promise.all(groupPromises);
      }

      if (word.translate && Array.isArray(word.translate)) {
        const translationPromises = word.translate.map(async (translateData: TTranslate) => {
          if (translateData.value > '') {
            await SWords.insertTranslation(translateData, insertedWordID);
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
    const sql = 'INSERT INTO word_translate (word_id, translate, context) VALUES (?, ?, ?)';
    const { context, value } = translate;
    const filtered = (context || []).filter((ctx: TContext) => ctx.value !== '');
    const contextJson: string = JSON.stringify(filtered);
    const params = [insertedWordId, value, contextJson];
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
    const sql = 'UPDATE word_translate SET translate = ?, context = ? WHERE id = ?';
    const filtered = (translateData.context || []).filter((ctx: TContext) => ctx.value !== '');
    const contextJson: string = JSON.stringify(filtered);
    const params = [translateData.value, contextJson, translateData.id];
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
            await SWords.insertTranslation(translateData, word.id);
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
    const insertGroupPromises = groups.map(async (groupID: number) => {
      await SWords.insertGroup(groupID, wordID);
    });
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

  static async getGroups(wordID: number | null = null): Promise<TGroup[]> {
    const sql = `
      SELECT
        groups.*,
        COUNT(words.id) AS count
      FROM groups
      LEFT JOIN word_group ON groups.id = word_group.group_id
      LEFT JOIN words ON word_group.word_id = words.id
      ${wordID ? 'WHERE words.id = (?)' : ''}
      GROUP BY groups.id
    ;`;
    const params = wordID ? [wordID] : [];

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

  static async createGroup(name: string, description?: string): Promise<string | number> {
    const selectQuery = 'SELECT COUNT(*) AS count FROM groups WHERE name = ?';
    const selectParams = [name];
    const insertQuery = 'INSERT INTO groups (name, description) VALUES (?, ?)';
    const insertParams = [name, description ?? null];

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

  private static async insertGroup(groupID: number, wordID: number) {
    const sql = 'INSERT INTO word_group (group_id, word_id) VALUES (?, ?)';
    const params = [groupID, wordID];
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

  private async reset() {
    try {
      for (const table of this.tables) {
        await this.dropTable(table);
        await this.checkTable(table);
      }
      const result: TStartDB = await this.getFromJSON();
      for (const chunk of result) {
        for (const word of chunk.data) {
          word.groups = chunk.groups;
          await SWords.insertWordAndTranslations(word);
        }
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private async getFromJSON(): Promise<TStartDB> {
    try {
      const result: TStartDB = [];
      let previousContextValue = '';
      let groupNumber = 0;

      for (const chunk of startDBChunks) {
        const contextValue = this.getChunkContextValue(chunk);
        if (contextValue === previousContextValue) {
          groupNumber++;
        } else {
          previousContextValue = contextValue;
          groupNumber = 1;
        }

        const groupIDResult = await SWords.createGroup(
          `${contextValue} ${groupNumber}`,
        );
        let groupID: number = 0;
        if (typeof groupIDResult === 'number') {
          groupID = groupIDResult;
        }
        result.push({data: chunk.data, groups: [groupID]});
      }

      return result;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private getChunkContextValue(chunk: TStartDBChunk): string {
    for (const word of chunk.data) {
      for (const translate of word.translate || []) {
        for (const context of translate.context || []) {
          if (context.value) {
            return context.value;
          }
        }
      }
    }

    throw new Error(`No context value found in ${chunk.file}`);
  }
}
