import type { SpotifyApi } from '@spotify/web-api-ts-sdk';

export type SpotifyAlbumIdentifiers = {
    upc?: string;
    artistId?: string;
    artistName?: string;
};

/**
 * The album's barcode and main artist, used to find the same release outside MusicBrainz.
 */
export async function getSpotifyAlbumIdentifiers(api: SpotifyApi, spotifyAlbumId: string): Promise<SpotifyAlbumIdentifiers> {
    const album = await api.albums.get(spotifyAlbumId);
    const [artist] = album.artists;

    return {
        upc: album.external_ids?.upc,
        artistId: artist?.id,
        artistName: artist?.name,
    };
}
