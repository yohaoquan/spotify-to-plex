import axios from 'axios';
import { withRetry } from '../utils/withRetry';

export type DeezerAlbum = {
    id: number;
    title: string;
    artistId: number;
    artistName: string;
};

type DeezerAlbumResponse = {
    id?: number;
    title?: string;
    artist?: { id: number; name: string };
    error?: { type: string; message: string; code: number };
};

// Deezer answers HTTP 200 with an error object. Code 4 is its rate limit (50 requests per 5 s).
const QUOTA_EXCEEDED = 4;
const QUOTA_WAIT = 5000;

/**
 * Spotify and Deezer don't always write the same barcode: one may be the 12-digit UPC and
 * the other the 13-digit EAN with a leading zero.
 */
export function upcVariants(upc: string) {
    const digits = upc.trim();
    const variants = [digits, digits.replace(/^0+/, '')];
    if (digits.length === 12)
        variants.push(`0${digits}`);

    return [...new Set(variants.filter(Boolean))];
}

/**
 * Find a Deezer album by barcode. Deezer's public API needs no account or key.
 * Returns null when Deezer has no album with that barcode.
 */
export async function getDeezerAlbumByUpc(upc: string): Promise<DeezerAlbum | null> {
    for (const variant of upcVariants(upc)) {
        for (let attempt = 0; ; attempt++) {
            const { data } = await withRetry(() => axios.get<DeezerAlbumResponse>(`https://api.deezer.com/album/upc:${variant}`));

            if (data.error?.code === QUOTA_EXCEEDED && attempt < 3) {
                await new Promise(resolve => { setTimeout(resolve, QUOTA_WAIT) });
                continue;
            }

            if (data.id && data.artist)
                return { id: data.id, title: data.title ?? '', artistId: data.artist.id, artistName: data.artist.name };

            break;
        }
    }

    return null;
}
