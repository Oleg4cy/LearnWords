import {TGroup, TWord} from '../../storage/words/words.types';

export type TStartDBDictionary = {
  groups: TGroup[];
  words: TWord[];
};

export const startDBDictionary = require('./dictionary.json') as TStartDBDictionary;
