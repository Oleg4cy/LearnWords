import IConfig from './config.interface';
import AppConfig, { TAppConfig } from './app.config';

export default class SConfig implements IConfig {
	private static instance: IConfig;
	private config: TAppConfig;

	constructor() {
		this.config = AppConfig;
	}

	static getInstance() {
		if (SConfig.instance) return SConfig.instance;
		return SConfig.instance = new SConfig();
	}

	get(key: string): string {
		const res = this.config[key];
		if (!res) {
			throw new Error(`Key (${key}) undefined`);
		}
		return res;
	}
}


