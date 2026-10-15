import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { monitorAndSearchAlbum } from './monitorAndSearchAlbum';

const album = { id: 7, foreignAlbumId: 'rg-1', title: 'Dive', monitored: false, artistId: 3 };

describe('monitorAndSearchAlbum', () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('monitors an unmonitored artist without monitoring its new releases', async () => {
        vi.spyOn(axios, 'get')
            .mockResolvedValueOnce({ data: [album] })
            .mockResolvedValueOnce({ data: { id: 3, monitored: false, monitorNewItems: 'all' } });
        const put = vi.spyOn(axios, 'put').mockResolvedValue({ data: {} });
        const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });

        const result = await monitorAndSearchAlbum('rg-1', 'http://lidarr:8686/', 'key');

        expect(result.success).toBe(true);
        expect(put).toHaveBeenCalledWith('http://lidarr:8686/api/v1/album/7', expect.objectContaining({ monitored: true }), expect.anything());
        expect(put).toHaveBeenCalledWith('http://lidarr:8686/api/v1/artist/3', expect.objectContaining({ monitored: true, monitorNewItems: 'none' }), expect.anything());
        expect(post).toHaveBeenCalledWith('http://lidarr:8686/api/v1/command', { name: 'AlbumSearch', albumIds: [7] }, expect.anything());
    });

    it('leaves a monitored artist alone', async () => {
        vi.spyOn(axios, 'get')
            .mockResolvedValueOnce({ data: [{ ...album, monitored: true }] })
            .mockResolvedValueOnce({ data: { id: 3, monitored: true, monitorNewItems: 'all' } });
        const put = vi.spyOn(axios, 'put').mockResolvedValue({ data: {} });
        vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });

        const result = await monitorAndSearchAlbum('rg-1', 'http://lidarr:8686', 'key');

        expect(result).toEqual({ success: true, message: 'Album already monitored, search triggered' });
        expect(put).not.toHaveBeenCalled();
    });
});
