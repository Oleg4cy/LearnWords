const resultSet = {
  insertId: 1,
  rows: {
    length: 1,
    item: () => ({ installed: 1, count: 0 }),
  },
};

const database = {
  executeSql: (_sql, _params, success) => {
    if (success) {
      success(resultSet);
    }
    return Promise.resolve(resultSet);
  },
  transaction: callback => {
    callback({
      executeSql: (_sql, _params, success) => {
        if (success) {
          success(null, resultSet);
        }
      },
    });
  },
};

module.exports = {
  openDatabase: (_options, success) => {
    if (success) {
      success();
    }
    return database;
  },
};
