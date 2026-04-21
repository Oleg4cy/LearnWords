import IDB from './db.interface';
import SConfig from '../../config/config.service';
import IConfig from '../../config/config.interface';
import React from 'react-native';
import SQLite, { SQLiteDatabase, Location  } from 'react-native-sqlite-storage';

export default class SDB implements IDB {
  private static instance: SDB;
  private DBName: string;
  private DBLocation: Location;
  private connection: SQLiteDatabase | null = null;

  constructor() {
    const config: IConfig = SConfig.getInstance();
    this.DBName = config.get('databaseName');
    this.DBLocation = config.get('databaseLocation') as Location;

    this.init();
  }

  static async getInstance() {
    if (SDB.instance) return SDB.instance;
    return SDB.instance = new SDB();
  }

  async init() {
    this.connection = await this.getDBConnection();
  }

  async getDBConnection(): Promise<SQLiteDatabase | null> {
    if (this.connection) return this.connection;
    // SQLite.DEBUG(true);
    // SQLite.enablePromise(true);
    return SQLite.openDatabase({ name: this.DBName, location: this.DBLocation }, this.connectSuccess, this.connectError);
  }

  connectError(error: any) {
    console.log(error);
    throw new Error(error);
  }

  connectSuccess() {
    console.log('DB CONNECT SUCCCESS');
  }
}


