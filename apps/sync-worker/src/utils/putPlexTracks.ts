import { addItemsToPlaylist } from "@spotify-to-plex/plex-helpers/playlist/addItemsToPlaylist";
import { putPlaylistPoster } from "@spotify-to-plex/plex-helpers/playlist/putPlaylistPoster";
import { removeItemsFromPlaylist } from "@spotify-to-plex/plex-helpers/playlist/removeItemsFromPlaylist";
import { storePlaylist } from "@spotify-to-plex/plex-helpers/playlist/storePlaylist";
import { updatePlaylist } from "@spotify-to-plex/plex-helpers/playlist/updatePlaylist";
import { PlaylistUpdateData } from "@spotify-to-plex/plex-helpers/PlaylistUpdateData";
import { getPlexUri } from "@spotify-to-plex/plex-helpers/utils/getPlexUri";
import { Playlist } from "@spotify-to-plex/shared-types/plex/Playlist";
import { SearchResponse } from "@spotify-to-plex/plex-music-search/types/SearchResponse";
import { getSettings } from "@spotify-to-plex/plex-config/functions/getSettings";
import { addPlaylist } from "@spotify-to-plex/plex-config/functions/addPlaylist";

export async function putPlexPlaylist(id: string, plexPlaylist: Playlist | undefined | null, result: SearchResponse[], title: string, thumb: string, summary?: string) {
    const plexTracks = result.map(item => {
        if (item.result.length == 0)
            return null;

        const [firstResult] = item.result;
        if (!firstResult) return null;

        return {
            key: firstResult.id,
            source: firstResult.source
        };
    }).filter(item => !!item);

    if (plexTracks.length > 0) {
        // Not shift(): an existing playlist is cleared and refilled with every track, the first included
        const [firstItem] = plexTracks;
        if (!firstItem)
            return;

        // Get settings once at the start
        const rawSettings = await getSettings();
        if (!rawSettings.uri || !rawSettings.token || !rawSettings.id) {
            throw new Error('Plex settings not configured properly');
        }

        // Cast to required type since we've verified all required fields exist
        const settings = rawSettings as Required<typeof rawSettings>;

        if (plexPlaylist) {
            console.log(`Update existing playlist`);
            // Clear items from playlist
            await removeItemsFromPlaylist(settings, plexPlaylist.ratingKey, []);

            // Add all items
            await addItemsToPlaylist(settings, plexPlaylist.ratingKey, plexTracks);

            const changes: PlaylistUpdateData = {};
            if (plexPlaylist.title != title && title)
                changes.title = title;

            if (summary !== undefined && plexPlaylist.summary != summary)
                changes.summary = summary;

            if (Object.keys(changes).length > 0)
                await updatePlaylist(settings, plexPlaylist.ratingKey, changes);

            try {
                await putPlaylistPoster(plexPlaylist.ratingKey, thumb)
            } catch (_e) {
                console.log(`* Could not update poster image`)
            }
        } else {
            console.log(`Create new playlist`);
            const uri = getPlexUri(settings, firstItem.key, firstItem.source);
            const playlistId = await storePlaylist(settings, title, uri);
            await addItemsToPlaylist(settings, playlistId, plexTracks.slice(1));
            if (summary)
                await updatePlaylist(settings, playlistId, { summary });

            try {
                await putPlaylistPoster(playlistId, thumb)
            } catch (_e) {
                console.log(`** Could not update poster image`)
            }
            // Store new playlist
            await addPlaylist({ type: 'playlist', id, plex: playlistId });
        }
    }
}
