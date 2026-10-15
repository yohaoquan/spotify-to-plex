import axios, { AxiosError, AxiosHeaders } from 'axios';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMusicBrainzIds } from './getMusicBrainzIds';

function httpError(status: number) {
    const headers = new AxiosHeaders();

    return new AxiosError(`Request failed with status code ${status}`, String(status), undefined, undefined,
        { status, statusText: '', headers, config: { headers }, data: {} });
}

describe('getMusicBrainzIds', () => {
    let dir = '';

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'mb-links-'));
        vi.stubEnv('STORAGE_DIR', dir);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        vi.unstubAllEnvs();
        rmSync(dir, { recursive: true, force: true });
    });

    it('falls back to a name search when MusicBrainz has no link to the Spotify album', async () => {
        const get = vi.spyOn(axios, 'get')
            .mockRejectedValueOnce(httpError(404))
            .mockResolvedValueOnce({ data: { 'release-groups': [{ id: 'rg-1', title: 'Dive', 'artist-credit': [{ artist: { id: 'ar-1', name: 'Holly Humberstone' } }] }] } });
        const result = getMusicBrainzIds('spotify-album', 'Holly Humberstone', 'Dive');
        await vi.runAllTimersAsync();
        expect(await result).toEqual({ releaseGroupId: 'rg-1', artistId: 'ar-1' });
        expect(get.mock.calls[1]?.[0]).toContain('/release-group/?query=');
    });

    it('returns null when neither the link nor the names find anything', async () => {
        vi.spyOn(axios, 'get')
            .mockRejectedValueOnce(httpError(404))
            .mockResolvedValueOnce({ data: { 'release-groups': [] } });
        const result = getMusicBrainzIds('spotify-album', 'Nobody', 'Nothing');
        await vi.runAllTimersAsync();
        expect(await result).toBeNull();
    });

    it('throws instead of reporting "not found" when MusicBrainz is unavailable', async () => {
        vi.spyOn(axios, 'get').mockRejectedValue(httpError(503));
        const result = getMusicBrainzIds('spotify-album', 'Billie Eilish', 'HIT ME HARD AND SOFT');
        const assertion = expect(result).rejects.toThrow('MusicBrainz unavailable');
        await vi.runAllTimersAsync();
        await assertion;
    });
});
