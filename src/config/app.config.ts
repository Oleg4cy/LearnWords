export type TAppConfig = {
	[key: string]: string,
	databaseName: string,
	databaseLocation: string,
	wordsTableName: string,
};

const AppConfig: TAppConfig = {
	// DATABASE
	databaseName: 'LWords.db',
	databaseLocation: 'default',
	wordsTableName: 'words',
}

export default AppConfig;
