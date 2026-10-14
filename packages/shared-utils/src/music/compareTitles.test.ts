import { describe, expect, it } from 'vitest';
import { compareTitles } from './compareTitles';
import { createSearchString } from './createSearchString';

describe('createSearchString', () => {

    it('still folds accents and strips punctuation from Latin titles', () => {
        expect(createSearchString('Café Del Mar!')).toBe('cafe del mar');
    });

    it('keeps letters of non-Latin scripts', () => {
        expect(createSearchString('带我去找夜生活')).toBe('带我去找夜生活');
        expect(createSearchString('夜に駆ける')).toBe('夜に駆ける');
        expect(createSearchString('Кино')).toBe('кино');
    });
});

describe('compareTitles', () => {

    it('does not match two different Chinese titles', () => {
        const result = compareTitles('带我去找夜生活', '在这座城市遗失了你', true);
        expect(result.match).toBe(false);
        expect(result.contains).toBe(false);
    });

    it('does not match two different Chinese artists', () => {
        expect(compareTitles('告五人', '草東沒有派對', true).match).toBe(false);
    });

    it('matches identical Chinese titles', () => {
        expect(compareTitles('但', '但').match).toBe(true);
        expect(compareTitles('爱人错过', '爱人错过', true).similarity).toBe(1);
    });

    it('does not match titles that normalise to nothing', () => {
        const result = compareTitles('!!!', '???', true);
        expect(result.match).toBe(false);
        expect(result.similarity).toBe(0);
    });

    it('still matches Latin titles as before', () => {
        expect(compareTitles('Café', 'Cafe').match).toBe(true);
    });
});
