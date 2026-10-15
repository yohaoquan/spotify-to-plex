import type { LidarrAddAlbumRequest } from '@spotify-to-plex/shared-types/lidarr/LidarrAddAlbumRequest';
import type { LidarrLookupResult } from '@spotify-to-plex/shared-types/musicbrainz/LidarrLookupResult';

type AddAlbumOptions = {
    qualityProfileId: number;
    metadataProfileId: number;
    rootFolderPath: string;
};

/**
 * Build the request that adds one album (and its artist, if Lidarr doesn't have it yet)
 * so that only this album ends up monitored.
 *
 * Lidarr applies the new artist's `addOptions` after its first refresh: `monitor: "none"`
 * unmonitors the artist and every album, including the one being added. Listing the album
 * in `albumsToMonitor` monitors just that album and keeps the artist monitored, which is
 * what Lidarr's own "specific album" import lists do.
 */
export function createAddAlbumRequest(lidarrAlbum: LidarrLookupResult, options: AddAlbumOptions): LidarrAddAlbumRequest {
    return {
        foreignAlbumId: lidarrAlbum.foreignAlbumId,
        title: lidarrAlbum.title,
        artistId: 0,
        profileId: options.qualityProfileId,
        qualityProfileId: options.qualityProfileId,
        metadataProfileId: options.metadataProfileId,
        monitored: true,
        anyReleaseOk: true,
        rootFolderPath: options.rootFolderPath,
        addOptions: {
            searchForNewAlbum: true,
        },
        artist: {
            foreignArtistId: lidarrAlbum.artist.foreignArtistId,
            artistName: lidarrAlbum.artist.artistName,
            qualityProfileId: options.qualityProfileId,
            metadataProfileId: options.metadataProfileId,
            rootFolderPath: options.rootFolderPath,
            monitored: true,
            // Don't start monitoring the artist's future releases
            monitorNewItems: 'none',
            addOptions: {
                monitor: 'all',
                albumsToMonitor: [lidarrAlbum.foreignAlbumId],
                monitored: true,
                searchForMissingAlbums: false,
            },
        },
    };
}
