import shuffle from './shuffleArray';

export default class ShuffledCycle<T> {
  private items: T[] = [];
  private index = 0;

  constructor(items: T[] = []) {
    this.setItems(items);
  }

  setItems(items: T[]): void {
    this.items = shuffle([...items]);
    this.index = 0;
  }

  next(): T | null {
    if (this.items.length === 0) {
      return null;
    }

    if (this.index >= this.items.length) {
      this.items = shuffle([...this.items]);
      this.index = 0;
    }

    const item = this.items[this.index];
    this.index += 1;
    return item ?? null;
  }

  clear(): void {
    this.items = [];
    this.index = 0;
  }
}
