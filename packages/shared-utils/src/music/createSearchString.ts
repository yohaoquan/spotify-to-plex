/* eslint-disable unicorn/prefer-string-replace-all */
import { toSimplified } from './chineseScript';

export function createSearchString(input: string) {
    // Simplified and Traditional Chinese spellings of the same title compare equal
    const result = toSimplified(input)
        .toLowerCase()
        .replace(new RegExp(/[àáâãäå]/g), "a")
        .replace(new RegExp(/æ/g), "ae")
        .replace(new RegExp(/ç/g), "c")
        .replace(new RegExp(/[èéêë]/g), "e")
        .replace(new RegExp(/[ìíîï]/g), "i")
        .replace(new RegExp(/ñ/g), "n")
        .replace(new RegExp(/[òóôõö]/g), "o")
        .replace(new RegExp(/œ/g), "oe")
        .replace(new RegExp(/[ùúûü]/g), "u")
        .replace(new RegExp(/[ýÿ]/g), "y")
        // Keep letters and digits of every script: an ASCII-only class reduced
        // CJK, Cyrillic, Greek, etc. titles to an empty string
        .replace(/[^\p{L}\p{N} ]/gu, "")
        .trim();

    return result;
}
