import axios from 'axios';
import { withRetry } from './withRetry';

// MusicBrainz asks every client to identify itself and throttles or blocks
// requests that don't: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
const USER_AGENT = 'spotify-to-plex/1.0 ( https://github.com/jjdenhertog/spotify-to-plex )';

/**
 * GET from the MusicBrainz API. A 404 is rethrown as is (callers treat it as "not
 * in MusicBrainz"); anything else becomes an error saying MusicBrainz was unreachable
 */
export async function musicBrainzGet<T>(url: string) {
    try {
        return await withRetry(() => axios.get<T>(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } }));
    } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 404)
            throw error;

        const reason = axios.isAxiosError(error) ? (error.response?.status ?? error.code) : String(error);
        throw new Error(`MusicBrainz unavailable (${reason}), try again later`);
    }
}
