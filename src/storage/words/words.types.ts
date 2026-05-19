export type TGroup = {
	name: string,
	id?: number,
	external_id?: string,
	parent_id?: number | null,
	child_count?: number,
	kind?: string,
	description?: string,
	context?: string,
	count?: number,
}

export type TContext = {
	value: string;
	example?: string;
	example_translation?: string;
};

export type TTranslate = {
	[key: string]: number | string | string[] | number[] | TContext[] | undefined | boolean;
	id?: number,
	value: string;
	context?: TContext[];
	groups?: string[] | number[];
	language_code?: string,
	status?: string,
	source?: string,
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
