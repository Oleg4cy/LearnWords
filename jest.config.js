module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|gif|webp)$': '<rootDir>/__mocks__/fileMock.js',
    '^react-native-vector-icons/FontAwesome$': '<rootDir>/__mocks__/vectorIconMock.js',
    '^react-native-iphone-x-helper$': '<rootDir>/__mocks__/iphoneXHelperMock.js',
    '^react-native-select-dropdown$': '<rootDir>/__mocks__/selectDropdownMock.js',
    '^react-native-sqlite-storage$': '<rootDir>/__mocks__/sqliteStorageMock.js',
  },
};
