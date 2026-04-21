import { SQLiteDatabase, ResultSet, Transaction } from 'react-native-sqlite-storage';
import ISwords from './words.service';
import SDB from '../db/db.service';

import { TWord, TTranslate, TGroup } from './words.types';

type TStructureTable = {
  [key: string]: string | string[],
  name: string,
  structure: string[],
};

type TStartDB = { data: TWord[], groups: number[] };

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
    console.log('groupID: ', groupID);
    console.log(typeof groupID);
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
    console.log(sql);

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
      const translation: TTranslate = {
        id: result.t_id,
        value: result.translate,
        context: JSON.parse(result.context),
      };
      wordTranslations.push(translation);
    }

    return wordTranslations;
  }

  static async getRandom(): Promise<TWord | null> {
    const sql = `
      SELECT words.*,
        word_translate.id as t_id,
        word_translate.translate,
        word_translate.context
      FROM words
      LEFT JOIN word_translate on words.id=word_translate.word_id
      ORDER BY RANDOM()
      LIMIT 1
    ;`

    try {
      const results: ResultSet = await SWords.execute(sql);
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

  static async getRandomAnswers(wordID: number): Promise<TTranslate[]> {
    const sql = `
      SELECT *
      FROM word_translate
      WHERE word_id <> (?)
      ORDER BY RANDOM() LIMIT 5
    `;
    const params = [wordID];

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
    let { context, value } = translate;
    context = context && context.filter(item => item !== '');
    const contextJson: string = JSON.stringify(context);
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
    const contextJson: string = JSON.stringify(translateData?.context?.filter(item => item !== ''));
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
      await SWords.execute('DELETE FROM words WHERE id = ?', [id]);
      console.log(`Word with ID ${id} has been deleted.`);
    } catch (error) {
      console.log(error);
      throw error;
    }
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
      console.log(`word ${wordID} added to ${groupID} group`);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private async dropTable(table: TStructureTable) {
    try {
      const dropTableQuery = `DROP TABLE IF EXISTS ${table.name};`;
      await this.db?.executeSql(dropTableQuery);
      console.log(`Таблица "${table.name}" успешно удалена`);
    } catch (error) {
      console.log('DROP ERR: ', error);
      throw error;
    }
  }

  private async checkTable(table: TStructureTable) {
    const query = `CREATE TABLE IF NOT EXISTS ${table.name} (${table.structure.join(', ')});`
    try {
      await this.db?.executeSql(query);
      console.log(table.name, ' table is ok.');
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
      for (const word of result.data) {
        word.groups = result.groups;
        await SWords.save(word);
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private async getFromJSON(): Promise<TStartDB> {
    try {
      const data: TWord[] = await require('../../assets/startDB/basic.json');
      const groupIDResult = await SWords.createGroup('Первая группа');
      let groupID: number = 0;
      if (typeof groupIDResult === 'number') groupID = groupIDResult;
      const result: TStartDB = { data: data, groups: [groupID] };
      return result;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}

