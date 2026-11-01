const URI = /^spotify:([a-z]+):([\dA-Za-z]+)$/

/**
 * The open.spotify.com link for a synced item's uri (playlist, album or a user's liked songs).
 */
export function spotifyUrl(uri: string): string | null {
    const value = uri.trim()
    if (value.startsWith('spotify:liked:'))
        return 'https://open.spotify.com/collection/tracks'

    const match = URI.exec(value)

    return match ? `https://open.spotify.com/${match[1]}/${match[2]}` : null
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/**
 * Spotify playlist descriptions are HTML: entities are escaped and links are <a> tags.
 */
export function htmlToText(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
            if (code.startsWith('#')) {
                const point = code[1] === 'x' || code[1] === 'X' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))

                return Number.isFinite(point) ? String.fromCodePoint(point) : entity
            }

            return ENTITIES[code.toLowerCase()] ?? entity
        })
        .trim()
}

/**
 * The Plex playlist summary: Spotify's description, then the Spotify link on its own line.
 */
export function playlistSummary(description: string | undefined, uri: string): string {
    return [htmlToText(description ?? ''), spotifyUrl(uri)]
        .filter(part => !!part)
        .join('\n\n')
}
