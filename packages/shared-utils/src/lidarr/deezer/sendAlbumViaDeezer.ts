import axios from 'axios';
import { toSimplified } from '../../music/chineseScript';
import { getLidarrAlbum } from '../getLidarrAlbum';
import { monitorAndSearchAlbum } from '../monitorAndSearchAlbum';
import { musicBrainzGet } from '../utils/musicBrainzGet';
import { withRetry } from '../utils/withRetry';
import { getDeezerAlbumByUpc } from './getDeezerAlbumByUpc';

/**
 * Fallback for albums MusicBrainz doesn't have. It needs Lidarr with the Tubifarry plugin
 * and its Deezer metadata source enabled (through MetaMix), which lists Deezer releases
 * under ids like `12345@deezer`:
 *
 * 1. find the Deezer album by the Spotify album's barcode,
 * 2. find the artist in Lidarr, or add it (by MusicBrainz id when MusicBrainz knows the
 *    artist, otherwise by Deezer id),
 * 3. refresh the artist so its Deezer releases are listed, then monitor the album and search.
 */

export type DeezerFallbackInput = {
    upc?: string;
    spotifyArtistId?: string;
    spotifyArtistName?: string;
};

export type DeezerFallbackOptions = {
    lidarrUrl: string;
    apiKey: string;
    qualityProfileId: number;
    metadataProfileId: number;
    rootFolderPath: string;
    /** How long to wait for an artist refresh; Lidarr refreshes one artist at a time. */
    refreshTimeoutMs?: number;
    pollIntervalMs?: number;
};

export type DeezerFallbackResult = {
    status: 'success' | 'not_found' | 'error';
    message: string;
    deezerAlbumId?: number;
    foreignAlbumId?: string;
};

type LidarrArtist = {
    id: number;
    artistName: string;
    foreignArtistId: string;
    links?: { url: string; name?: string }[];
    [key: string]: unknown;
};

type MusicBrainzUrlArtistResponse = {
    relations?: { 'target-type': string; artist?: { id: string } }[];
};

const MUSICBRAINZ_ID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function normalizeArtistName(name: string) {
    return toSimplified(name).toLowerCase()
        .replace(/\s+/g, '');
}

/**
 * The Lidarr artist for this album: by a Spotify or Deezer link on the artist, by Deezer id,
 * and last by name (Simplified/Traditional folded), so an artist already in Lidarr is never
 * added a second time.
 */
export function findLidarrArtist(artists: LidarrArtist[], spotifyArtistId: string | undefined, deezerArtistId: number, names: string[]) {
    const hasLink = (artist: LidarrArtist, pattern: RegExp) => (artist.links ?? []).some(link => pattern.test(link.url));

    if (spotifyArtistId) {
        const spotifyLink = new RegExp(`open\\.spotify\\.com/artist/${spotifyArtistId}\\b`);
        const bySpotify = artists.find(artist => hasLink(artist, spotifyLink));
        if (bySpotify)
            return bySpotify;
    }

    const deezerLink = new RegExp(`deezer\\.com/(?:[a-z]{2}/)?artist/${deezerArtistId}\\b`);
    const byDeezer = artists.find(artist => artist.foreignArtistId === `${deezerArtistId}@deezer` || hasLink(artist, deezerLink));
    if (byDeezer)
        return byDeezer;

    const wanted = new Set(names.filter(Boolean).map(normalizeArtistName));

    return artists.find(artist => wanted.has(normalizeArtistName(artist.artistName)));
}

function trimUrl(url: string) {
    return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function findMusicBrainzArtistId(spotifyArtistId: string) {
    try {
        const url = `https://musicbrainz.org/ws/2/url?resource=https://open.spotify.com/artist/${spotifyArtistId}&fmt=json&inc=artist-rels`;
        const { data } = await musicBrainzGet<MusicBrainzUrlArtistResponse>(url);

        return data.relations?.find(relation => relation['target-type'] === 'artist' && relation.artist)?.artist?.id ?? null;
    } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 404)
            return null;

        throw error;
    }
}

async function waitForCommand(baseUrl: string, headers: Record<string, string>, commandId: number, options: DeezerFallbackOptions) {
    const timeout = options.refreshTimeoutMs ?? 300_000;
    const interval = options.pollIntervalMs ?? 3000;
    const started = Date.now();

    while (Date.now() - started < timeout) {
        const { data } = await withRetry(() => axios.get<{ status: string }>(`${baseUrl}/api/v1/command/${commandId}`, { headers }));
        if (data.status === 'completed')
            return true;

        if (data.status === 'failed' || data.status === 'aborted' || data.status === 'cancelled')
            return false;

        await new Promise(resolve => { setTimeout(resolve, interval) });
    }

    return false;
}

/**
 * Add the artist with nothing monitored. Uses the MusicBrainz artist when MusicBrainz knows it
 * (so it keeps its MusicBrainz releases too), otherwise the Deezer artist.
 */
async function addArtist(baseUrl: string, headers: Record<string, string>, spotifyArtistId: string | undefined, deezerArtistId: number, options: DeezerFallbackOptions) {
    const musicBrainzArtistId = spotifyArtistId ? await findMusicBrainzArtistId(spotifyArtistId) : null;
    let candidate: LidarrArtist | undefined;
    if (musicBrainzArtistId) {
        const { data } = await withRetry(() => axios.get<LidarrArtist[]>(`${baseUrl}/api/v1/artist/lookup?term=lidarr:${musicBrainzArtistId}`, { headers }));
        [candidate] = data;
    } else {
        const { data } = await withRetry(() => axios.get<{ artist?: LidarrArtist }[]>(`${baseUrl}/api/v1/search?term=${encodeURIComponent(`deezer:${deezerArtistId}`)}`, { headers }));
        candidate = data.map(item => item.artist).find(item => item?.foreignArtistId === `${deezerArtistId}@deezer`);
    }

    if (!candidate)
        return null;

    const { data: created } = await withRetry(() => axios.post<LidarrArtist>(`${baseUrl}/api/v1/artist`, {
        ...candidate,
        qualityProfileId: options.qualityProfileId,
        metadataProfileId: options.metadataProfileId,
        rootFolderPath: options.rootFolderPath,
        monitored: true,
        monitorNewItems: 'none',
        addOptions: { monitor: 'none', searchForMissingAlbums: false },
    }, { headers }));

    return created;
}

export async function sendAlbumViaDeezer(input: DeezerFallbackInput, options: DeezerFallbackOptions): Promise<DeezerFallbackResult> {
    if (!input.upc)
        return { status: 'not_found', message: 'No MusicBrainz mapping found, and Spotify has no barcode for a Deezer lookup' };

    const deezerAlbum = await getDeezerAlbumByUpc(input.upc);
    if (!deezerAlbum)
        return { status: 'not_found', message: `Not in MusicBrainz or Deezer (barcode ${input.upc})` };

    const foreignAlbumId = `${deezerAlbum.id}@deezer`;
    const result = { deezerAlbumId: deezerAlbum.id, foreignAlbumId };
    const baseUrl = trimUrl(options.lidarrUrl);
    const headers = { 'X-Api-Key': options.apiKey, 'Content-Type': 'application/json' };

    // Already listed in Lidarr: just monitor and search
    if (await getLidarrAlbum(foreignAlbumId, baseUrl, options.apiKey)) {
        const monitored = await monitorAndSearchAlbum(foreignAlbumId, baseUrl, options.apiKey);

        return { ...result, status: monitored.success ? 'success' : 'error', message: `Deezer: ${monitored.message}` };
    }

    const { data: artists } = await withRetry(() => axios.get<LidarrArtist[]>(`${baseUrl}/api/v1/artist`, { headers }));
    const existing = findLidarrArtist(artists, input.spotifyArtistId, deezerAlbum.artistId, [input.spotifyArtistName ?? '', deezerAlbum.artistName]);
    const artist = existing ?? await addArtist(baseUrl, headers, input.spotifyArtistId, deezerAlbum.artistId, options);
    if (!artist)
        return { ...result, status: 'not_found', message: `Deezer album ${deezerAlbum.id} found, but Lidarr couldn't look up its artist "${deezerAlbum.artistName}"` };

    const added = !existing;

    // Refresh, so MetaMix merges the artist's Deezer releases. For a new artist this also
    // waits out the first refresh, which applies `monitor: none` to everything.
    const { data: command } = await withRetry(() => axios.post<{ id: number }>(`${baseUrl}/api/v1/command`, { name: 'RefreshArtist', artistId: artist.id }, { headers }));
    if (!await waitForCommand(baseUrl, headers, command.id, options))
        return { ...result, status: 'error', message: `Refreshing ${artist.artistName} in Lidarr didn't finish` };

    if (!await getLidarrAlbum(foreignAlbumId, baseUrl, options.apiKey)) {
        const onMusicBrainz = MUSICBRAINZ_ID.test(artist.foreignArtistId);

        return {
            ...result,
            status: 'not_found',
            message: onMusicBrainz
                ? `Deezer album ${deezerAlbum.id} not listed under ${artist.artistName}: add https://www.deezer.com/artist/${deezerAlbum.artistId} to https://musicbrainz.org/artist/${artist.foreignArtistId} (or a release with a similar title is already listed)`
                : `Deezer album ${deezerAlbum.id} not listed under ${artist.artistName} after a refresh`,
        };
    }

    const monitored = await monitorAndSearchAlbum(foreignAlbumId, baseUrl, options.apiKey);

    return {
        ...result,
        status: monitored.success ? 'success' : 'error',
        message: `Deezer${added ? `, artist added (${artist.foreignArtistId})` : ''}: ${monitored.message}`,
    };
}
