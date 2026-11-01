import { describe, expect, it } from 'vitest'
import { htmlToText, playlistSummary, spotifyUrl } from './playlistSummary'

describe('spotifyUrl', () => {
    it('links playlists, albums and liked songs', () => {
        expect(spotifyUrl('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')).toBe('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')
        expect(spotifyUrl('spotify:album:4aawyAB9vmqN3uQ7FjRGTy')).toBe('https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy')
        expect(spotifyUrl('spotify:liked:someuser')).toBe('https://open.spotify.com/collection/tracks')
        expect(spotifyUrl('not a uri')).toBeNull()
    })
})

describe('htmlToText', () => {
    it('drops tags and decodes entities', () => {
        expect(htmlToText('Rock &amp; roll by <a href="spotify:artist:1">Someone</a> &#x27;n&#39; more &#x1F3B5;'))
            .toBe('Rock & roll by Someone \'n\' more 🎵')
    })
})

describe('playlistSummary', () => {
    it('puts the link after the description', () => {
        expect(playlistSummary('华语 &amp; 独立', 'spotify:playlist:abc'))
            .toBe('华语 & 独立\n\nhttps://open.spotify.com/playlist/abc')
    })

    it('is just the link without a description', () => {
        expect(playlistSummary('', 'spotify:playlist:abc')).toBe('https://open.spotify.com/playlist/abc')
        expect(playlistSummary(undefined, 'spotify:album:abc')).toBe('https://open.spotify.com/album/abc')
    })
})
