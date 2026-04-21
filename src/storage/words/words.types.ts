export type TGroup = {
	name: string,
	id?: number,
	description?: string,
	count?: number,
}

export type TContext = {
	value: string;
	example?: string;
};

export type TTranslate = {
	[key: string]: number | string | string[] | TContext[] | undefined | boolean;
	value: string;
	context?: TContext[];
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


