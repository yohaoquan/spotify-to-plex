import axios, { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { musicBrainzGet } from './musicBrainzGet';

function httpError(status: number) {
    const headers = new AxiosHeaders();

    return new AxiosError(`Request failed with status code ${status}`, String(status), undefined, undefined,
        { status, statusText: '', headers, config: { headers }, data: {} });
}

describe('musicBrainzGet', () => {

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('identifies itself with a User-Agent', async () => {
        const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: {} });
        await musicBrainzGet('https://musicbrainz.org/ws/2/url');
        expect(get.mock.calls[0]?.[1]?.headers?.['User-Agent']).toMatch(/^spotify-to-plex\/\S+ \( https:\/\/github\.com\//);
    });

    it('retries 503s until one succeeds', async () => {
        vi.useFakeTimers();
        const get = vi.spyOn(axios, 'get')
            .mockRejectedValueOnce(httpError(503))
            .mockRejectedValueOnce(httpError(503))
            .mockResolvedValue({ data: { ok: true } });
        const result = musicBrainzGet<{ ok: boolean }>('https://musicbrainz.org/ws/2/url');
        await vi.runAllTimersAsync();
        const { data } = await result;
        expect(data.ok).toBe(true);
        expect(get).toHaveBeenCalledTimes(3);
    });

    it('reports MusicBrainz as unavailable when retries run out', async () => {
        vi.useFakeTimers();
        vi.spyOn(axios, 'get').mockRejectedValue(httpError(503));
        const result = musicBrainzGet('https://musicbrainz.org/ws/2/url');
        const assertion = expect(result).rejects.toThrow('MusicBrainz unavailable (503)');
        await vi.runAllTimersAsync();
        await assertion;
    });

    it('passes a 404 through without retrying', async () => {
        const get = vi.spyOn(axios, 'get').mockRejectedValue(httpError(404));
        await expect(musicBrainzGet('https://musicbrainz.org/ws/2/url')).rejects.toMatchObject({ response: { status: 404 } });
        expect(get).toHaveBeenCalledTimes(1);
    });
});
