import { describe, expect, it } from 'vitest';
import type { LidarrLookupResult } from '@spotify-to-plex/shared-types/musicbrainz/LidarrLookupResult';
import { createAddAlbumRequest } from './createAddAlbumRequest';

const lookup = {
    foreignAlbumId: 'rg-1',
    title: 'Dive',
    artist: { foreignArtistId: 'ar-1', artistName: 'Holly Humberstone' },
} as LidarrLookupResult;

const options = { qualityProfileId: 1, metadataProfileId: 2, rootFolderPath: '/music/' };

describe('createAddAlbumRequest', () => {

    it('monitors the album being added', () => {
        const request = createAddAlbumRequest(lookup, options);
        expect(request.monitored).toBe(true);
        expect(request.addOptions.searchForNewAlbum).toBe(true);
    });

    it('adds a new artist monitored for this album only', () => {
        const { artist } = createAddAlbumRequest(lookup, options);
        expect(artist.monitored).toBe(true);
        expect(artist.monitorNewItems).toBe('none');
        // monitor "none" would make Lidarr unmonitor the artist and this album after the refresh
        expect(artist.addOptions?.monitor).not.toBe('none');
        expect(artist.addOptions?.albumsToMonitor).toEqual(['rg-1']);
        expect(artist.addOptions?.searchForMissingAlbums).toBe(false);
    });

    it('uses the configured profiles and root folder', () => {
        const request = createAddAlbumRequest(lookup, options);
        expect(request).toMatchObject({ qualityProfileId: 1, metadataProfileId: 2, rootFolderPath: '/music/' });
        expect(request.artist).toMatchObject({ qualityProfileId: 1, metadataProfileId: 2, rootFolderPath: '/music/' });
    });
});
