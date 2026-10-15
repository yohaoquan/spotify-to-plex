import { Converter } from 'opencc-js';

// Taiwan and Hong Kong forms both fold to mainland Simplified, so 裡/裏 and 里 compare equal
const fromHongKong = Converter({ from: 'hk', to: 'cn' });
const fromTaiwan = Converter({ from: 'tw', to: 'cn' });
const toTaiwan = Converter({ from: 'cn', to: 'tw' });

const HAN = /\p{Script=Han}/u;

export function toSimplified(input: string) {
    return HAN.test(input) ? fromTaiwan(fromHongKong(input)) : input;
}

/**
 * The input plus its Simplified and Traditional spellings, for searches: Plex's
 * search index does not fold 愛 to 爱, so each spelling needs its own query
 */
export function chineseVariants(input: string) {
    if (!HAN.test(input))
        return [input];

    return [...new Set([input, toSimplified(input), toTaiwan(input)])];
}
