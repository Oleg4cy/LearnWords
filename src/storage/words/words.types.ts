export type TGroup = {
	name: string,
	id?: number,
	description?: string,
	context?: string,
	count?: number,
}

export type TContext = {
	value: string;
	example?: string;
};

export type TTranslate = {
	[key: string]: number | string | string[] | number[] | TContext[] | undefined | boolean;
	id?: number,
	value: string;
	context?: TContext[];
	groups?: string[] | number[];
	word_id?: number,
	removed?: boolean,
	new?: boolean,
};

export type TWord = {
	[key: string]: any;
	word: string,
	translate: TTranslate[],
	id?: number,
	groups?: number[] | TGroup[],
};
