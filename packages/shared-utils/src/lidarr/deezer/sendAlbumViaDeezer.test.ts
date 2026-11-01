import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDeezerAlbumByUpc, upcVariants } from './getDeezerAlbumByUpc';
import { findLidarrArtist, sendAlbumViaDeezer } from './sendAlbumViaDeezer';

const options = {
    lidarrUrl: 'http://lidarr:8686/',
    apiKey: 'key',
    qualityProfileId: 1,
    metadataProfileId: 1,
    rootFolderPath: '/music/Music/',
    pollIntervalMs: 0,
};

const deezerAlbum = { id: 555, title: '万物生长', artist: { id: 11_327_094, name: '宋冬野' } };
const lidarrAlbum = { id: 9, foreignAlbumId: '555@deezer', title: '万物生长', monitored: false, artistId: 4 };

type Route = [RegExp, unknown];

/** Answer axios.get by URL; each route is used in order, the last one repeats. */
function mockGet(routes: Route[]) {
    const remaining = [...routes];

    return vi.spyOn(axios, 'get').mockImplementation(async (url: string) => {
        const index = remaining.findIndex(([pattern]) => pattern.test(url));
        if (index === -1)
            throw new Error(`unexpected GET ${url}`);

        const [route] = remaining.splice(index, 1);
        if (!remaining.some(([pattern]) => pattern.test(url)))
            remaining.push(route!);

        return { data: route![1] };
    });
}

describe('upcVariants', () => {
    it('tries the 13-digit EAN form of a 12-digit UPC', () => {
        expect(upcVariants('886447740668')).toEqual(['886447740668', '0886447740668']);
        expect(upcVariants('0886447740668')).toEqual(['0886447740668', '886447740668']);
    });
});

describe('getDeezerAlbumByUpc', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns null when no barcode variant is on Deezer', async () => {
        mockGet([[/album\/upc:/, { error: { type: 'DataException', message: 'no data', code: 800 } }]]);

        expect(await getDeezerAlbumByUpc('886447740668')).toBeNull();
    });

    it('maps the album and its artist', async () => {
        mockGet([[/album\/upc:9555150782074/, deezerAlbum]]);

        expect(await getDeezerAlbumByUpc('9555150782074')).toEqual({ id: 555, title: '万物生长', artistId: 11_327_094, artistName: '宋冬野' });
    });
});

describe('findLidarrArtist', () => {
    const artists = [
        { id: 1, artistName: 'Someone', foreignArtistId: 'mb-1', links: [{ url: 'https://open.spotify.com/artist/abc' }] },
        { id: 2, artistName: '宋冬野', foreignArtistId: '08c7741c-1285-4f84-86fe-7afde5cdb82a', links: [] },
        { id: 3, artistName: 'Other', foreignArtistId: 'mb-3', links: [{ url: 'https://www.deezer.com/fr/artist/77' }] }
    ];

    it('matches by Spotify link, then Deezer link, then name across scripts', () => {
        expect(findLidarrArtist(artists, 'abc', 1, [])?.id).toBe(1);
        expect(findLidarrArtist(artists, 'zzz', 77, [])?.id).toBe(3);
        expect(findLidarrArtist(artists, undefined, 1, ['宋 冬野'])?.id).toBe(2);
        expect(findLidarrArtist(artists, undefined, 1, ['Nobody'])).toBeUndefined();
    });
});

describe('sendAlbumViaDeezer', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('reports not_found without a barcode', async () => {
        const result = await sendAlbumViaDeezer({}, options);

        expect(result.status).toBe('not_found');
    });

    it('monitors and searches a Deezer album Lidarr already lists', async () => {
        mockGet([
            [/api\.deezer\.com/, deezerAlbum],
            [/api\/v1\/album\?foreignAlbumId=555@deezer/, [lidarrAlbum]],
            [/api\/v1\/artist\/4/, { id: 4, monitored: true }]
        ]);
        vi.spyOn(axios, 'put').mockResolvedValue({ data: {} });
        const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });

        const result = await sendAlbumViaDeezer({ upc: '9555150782074' }, options);

        expect(result).toMatchObject({ status: 'success', foreignAlbumId: '555@deezer' });
        expect(post).toHaveBeenCalledWith('http://lidarr:8686/api/v1/command', { name: 'AlbumSearch', albumIds: [9] }, expect.anything());
    });

    it('asks for a Deezer link when the MusicBrainz artist has none', async () => {
        mockGet([
            [/api\.deezer\.com/, deezerAlbum],
            [/api\/v1\/album\?foreignAlbumId=/, []],
            [/api\/v1\/artist$/, [{ id: 4, artistName: '宋冬野', foreignArtistId: '08c7741c-1285-4f84-86fe-7afde5cdb82a', links: [] }]],
            [/api\/v1\/command\/\d+/, { status: 'completed' }]
        ]);
        const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { id: 31 } });

        const result = await sendAlbumViaDeezer({ upc: '9555150782074', spotifyArtistName: '宋冬野' }, options);

        expect(post).toHaveBeenCalledWith('http://lidarr:8686/api/v1/command', { name: 'RefreshArtist', artistId: 4 }, expect.anything());
        expect(result.status).toBe('not_found');
        expect(result.message).toContain('https://www.deezer.com/artist/11327094');
        expect(result.message).toContain('https://musicbrainz.org/artist/08c7741c-1285-4f84-86fe-7afde5cdb82a');
    });

    it('adds a Deezer-only artist unmonitored for new items, refreshes, then monitors the album', async () => {
        let albumListed = false;
        const get = vi.spyOn(axios, 'get').mockImplementation(async (url: string) => {
            if (url.includes('api.deezer.com'))
                return { data: deezerAlbum };

            if (url.includes('foreignAlbumId='))
                return { data: albumListed ? [lidarrAlbum] : [] };

            if (url.endsWith('/api/v1/artist'))
                return { data: [] };

            if (url.includes('musicbrainz.org'))
                throw Object.assign(new axios.AxiosError('not found'), { response: { status: 404 } });

            if (url.includes('/api/v1/search?term=deezer%3A11327094'))
                return { data: [{ artist: { artistName: '宋冬野', foreignArtistId: '11327094@deezer' } }] };

            if (/\/api\/v1\/command\/\d+/.test(url)) {
                albumListed = true;

                return { data: { status: 'completed' } };
            }

            if (url.endsWith('/api/v1/artist/4'))
                return { data: { id: 4, monitored: false } };

            throw new Error(`unexpected GET ${url}`);
        });
        const post = vi.spyOn(axios, 'post').mockImplementation(async (url: string) => (
            url.endsWith('/api/v1/artist') ? { data: { id: 4, artistName: '宋冬野', foreignArtistId: '11327094@deezer' } } : { data: { id: 31 } }
        ));
        const put = vi.spyOn(axios, 'put').mockResolvedValue({ data: {} });

        const result = await sendAlbumViaDeezer({ upc: '9555150782074', spotifyArtistId: 'sp1' }, options);

        expect(get).toHaveBeenCalled();
        expect(post).toHaveBeenCalledWith('http://lidarr:8686/api/v1/artist', expect.objectContaining({
            foreignArtistId: '11327094@deezer',
            monitorNewItems: 'none',
            addOptions: { monitor: 'none', searchForMissingAlbums: false },
        }), expect.anything());
        expect(put).toHaveBeenCalledWith('http://lidarr:8686/api/v1/album/9', expect.objectContaining({ monitored: true }), expect.anything());
        expect(result).toMatchObject({ status: 'success', foreignAlbumId: '555@deezer' });
        expect(result.message).toContain('artist added (11327094@deezer)');
    });
});
