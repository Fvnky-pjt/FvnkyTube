/**
 * Logic Handler untuk YouTube Music menggunakan Lavalink
 */
export async function resolveYoutube(node, query) {
    try {
        const identifier = /^https?:\/\//.test(query) ? query : `ytsearch:${query}`;
        const result = await node.rest.resolve(identifier);

        if (!result || !result.data) {
            return null;
        }

        const loadType = result.loadType.toLowerCase();

        if (['track', 'track_loaded', 'short'].includes(loadType)) {
            return Array.isArray(result.data) ? result.data[0] : result.data;
        } else if (['search', 'search_result'].includes(loadType)) {
            return result.data[0] || null;
        } else if (['playlist', 'playlist_loaded'].includes(loadType)) {
            return result.data.tracks?.[0] || result.data[0];
        }
        return null;
    } catch (error) {
        console.error('YouTube Resolution Error:', error);
        return null;
    }
}