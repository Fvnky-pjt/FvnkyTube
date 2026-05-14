// ======================================================
// FVNKY ULTRA MAX V2 - TIKTOK RESOLVER
// ======================================================

import { formatDuration } from "./index.js";
import {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
} from "discord.js";

// ======================================================
// ULTRA FILTERS (Optimized for Lavalink)
// ======================================================

export const MUSIC_FILTERS = {
    "Reset / Normal": {
        equalizer: Array.from({ length: 15 }, (_, i) => ({ band: i, gain: 0 })),
        timescale: { speed: 1, pitch: 1, rate: 1 },
        tremolo: null,
        rotation: null,
        distortion: null
    },
    "Bass Boost (Extreme)": {
        equalizer: [
            { band: 0, gain: 0.60 }, { band: 1, gain: 0.50 },
            { band: 2, gain: 0.35 }, { band: 3, gain: 0.15 }
        ]
    },
    "Nightcore": {
        timescale: { speed: 1.28, pitch: 1.25, rate: 1.0 }
    },
    "Vaporwave / Slowed": {
        timescale: { speed: 0.85, pitch: 0.80, rate: 1.0 },
        tremolo: { frequency: 3.0, depth: 0.2 }
    },
    "8D Audio (Spatial)": {
        rotation: { rotationHz: 0.2 }
    },
    "Lofi Mode": {
        equalizer: [
            { band: 0, gain: 0.2 }, { band: 1, gain: 0.15 },
            { band: 13, gain: -0.25 }, { band: 14, gain: -0.4 }
        ]
    },
    "Electronic": {
        equalizer: [
            { band: 0, gain: 0.375 }, { band: 1, gain: 0.350 }, { band: 2, gain: 0.125 },
            { band: 5, gain: -0.125 }, { band: 6, gain: -0.125 }, { band: 8, gain: 0.25 },
            { band: 9, gain: 0.125 }, { band: 10, gain: 0.15 }, { band: 11, gain: 0.2 },
            { band: 12, gain: 0.25 }, { band: 13, gain: 0.35 }, { band: 14, gain: 0.4 }
        ]
    },
    "Radio": {
        equalizer: [
            { band: 0, gain: -0.25 }, { band: 1, gain: -0.25 }, { band: 2, gain: -0.25 },
            { band: 3, gain: -0.25 }, { band: 4, gain: -0.25 }, { band: 5, gain: -0.25 },
            { band: 6, gain: -0.25 }, { band: 7, gain: -0.25 }, { band: 8, gain: -0.25 },
            { band: 9, gain: -0.25 }, { band: 10, gain: 0.5 }, { band: 11, gain: 0.5 },
            { band: 12, gain: 0.5 }, { band: 13, gain: 0.5 }, { band: 14, gain: 0.5 }
        ]
    },
    "Treble Boost": {
        equalizer: [
            { band: 10, gain: 0.3 }, { band: 11, gain: 0.3 }, { band: 12, gain: 0.4 },
            { band: 13, gain: 0.4 }, { band: 14, gain: 0.5 }
        ]
    },
    "Pop": {
        equalizer: [
            { band: 0, gain: -0.125 }, { band: 1, gain: -0.125 }, { band: 2, gain: 0 },
            { band: 3, gain: 0.125 }, { band: 4, gain: 0.25 }, { band: 5, gain: 0.375 },
            { band: 6, gain: 0.25 }, { band: 7, gain: 0.125 }, { band: 8, gain: 0 },
            { band: 9, gain: -0.125 }, { band: 10, gain: -0.125 }
        ]
    },
    "Soft": {
        equalizer: [
            { band: 0, gain: 0 }, { band: 1, gain: 0 }, { band: 2, gain: 0 },
            { band: 3, gain: 0 }, { band: 4, gain: 0 }, { band: 5, gain: 0 },
            { band: 6, gain: 0 }, { band: 7, gain: 0 }, { band: 8, gain: -0.25 },
            { band: 9, gain: -0.25 }, { band: 10, gain: -0.25 }, { band: 11, gain: -0.25 },
            { band: 12, gain: -0.25 }, { band: 13, gain: -0.25 }, { band: 14, gain: -0.25 }
        ]
    }
};

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json"
};

// ======================================================
// HELPER: SAFE FETCH
// ======================================================

async function safeFetch(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(url, { headers: DEFAULT_HEADERS, signal: controller.signal });
        return response.ok ? await response.json() : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

// ======================================================
// CORE: RESOLVE TIKTOK
// ======================================================

export async function resolveTikTok(node, ttUrl) {
    try {
        console.log(`[FVNKY] Resolving TikTok: ${ttUrl}`);
        
        // Menggunakan API TikWM sebagai primary source
        const data = await safeFetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(ttUrl)}`);
        
        if (!data || !data.data) {
            console.log("[TikWM] Gagal mendapatkan data.");
            return null;
        }

        const audioUrl = data.data.music || data.data.music_info?.play;
        if (!audioUrl) return null;

        // Resolve ke Lavalink
        const result = await node.rest.resolve(audioUrl);
        if (!result || !result.data) return null;

        const track = Array.isArray(result.data) ? result.data[0] : result.data;

        // Inject Metadata TikTok ke info track
        track.info.title = data.data.title || "TikTok Audio";
        track.info.author = `@${data.data.author?.unique_id || "tiktok_user"}`;
        track.info.artworkUrl = data.data.cover || data.data.origin_cover;
        track.info.uri = ttUrl;
        
        // Simpan statistik tambahan (opsional)
        track.stats = {
            likes: data.data.digg_count,
            plays: data.data.play_count
        };

        return track;
    } catch (err) {
        console.error("[TIKTOK RESOLVER ERROR]", err.message);
        return null;
    }
}

// ======================================================
// INTERFACE: HANDLE COMMAND
// ======================================================

export async function handleTikTokCommand(interaction, ttUrl, player) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
    
    await interaction.editReply({ content: "🚀 **FVNKY Engine** sedang memproses TikTok..." });

    const track = await resolveTikTok(player.node, ttUrl);

    if (!track) {
        return interaction.editReply({ content: "❌ Gagal mengekstrak audio. Pastikan link TikTok valid dan tidak diprivat." });
    }

    // Tambahkan ke queue
    if (!player.queue) {
        player.queue = {
            tracks: [],
            add(t) { this.tracks.push(t); }
        };
    }
    player.queue.add(track);
    if (!player.playing && !player.paused) await player.play();

    // Logika DM Otomatis
    const notifyTime = track.info.length - 15000;
    if (notifyTime > 5000) {
        setTimeout(async () => {
            try {
                await interaction.user.send(`👋 **Hello ${interaction.user.username}**, Sebentar Lagi Music TikTok Akan Berhenti.`);
            } catch (e) {
                console.log("[DM ERROR] Gagal mengirim pesan ke user.");
            }
        }, notifyTime);
    }

    const visualizer = " ▃ ▄ ▅ ▆ ▇ █ ▇ ▆ ▅ ▄ "; // Visualizer sederhana untuk estetika embed

    // Tampilan UI
    const embed = new EmbedBuilder()
        .setColor("#FE2C55") // Warna khas TikTok
        .setAuthor({ 
            name: `TIKTOK PLAYBACK | ${visualizer}`, 
            iconURL: "https://cdn-icons-png.flaticon.com/512/3048/3048443.png" 
        })
        .setTitle(`🎥 ${track.info.title.substring(0, 256)}`)
        .setURL(ttUrl)
        .setImage(track.info.artworkUrl)
        .setDescription(`
> **👻 Creator:** \`${track.info.author}\`
> **⌚ Duration:** \`${formatDuration(track.info.length)}\`
> **🎭 Requested by:** ${interaction.user}

**📊 STATS:** ❤️ \`${track.stats?.likes || 0}\` | 👁️ \`${track.stats?.plays || 0}\`
        `)
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();

    // Menu Filter
    const filterMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("filter_music")
            .setPlaceholder("✨ Terapkan Efek Audio...")
            .addOptions(Object.keys(MUSIC_FILTERS).map(name => ({
                label: name,
                value: name,
                description: `Aktifkan mode ${name}`
            })))
    );

    // Tombol Kontrol
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("pause_music").setEmoji("⏯️").setLabel("Pause/Resume").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("skip_music").setEmoji("⏭️").setLabel("Skip").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("stop_music").setEmoji("🛑").setLabel("Stop").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setLabel("Original Link").setURL(ttUrl).setStyle(ButtonStyle.Link)
    );

    return interaction.editReply({
        content: null,
        embeds: [embed],
        components: [filterMenu, buttons]
    });
}