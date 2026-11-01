export type LidarrSyncLog = {
    id: string;
    artist_name: string;
    album_name: string;
    start: number;
    end?: number;
    status: 'success' | 'error' | 'not_found';
    error?: string;
    musicbrainz_album_id?: string;
    musicbrainz_artist_id?: string;
    /** Where the album was found: MusicBrainz, or Deezer through Lidarr's Tubifarry plugin */
    source?: 'musicbrainz' | 'deezer';
    deezer_album_id?: number;
    /** Outcome detail for a successful Deezer hand-off */
    message?: string;
};
