import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { formatDuration } from './index.js';
import { MUSIC_FILTERS } from './tiktok.js';

export function getVisualizer() {
    const frames = ["  ▂ ▃ ▅ ▆ ▇", "  ▂ ▃ ▅ ▆ ▆", "  ▂ ▃ ▅ ▅ ▅", "  ▂ ▃ ▃ ▃ ▃", "▇ ▆ ▅ ▃ ▂  ", "▆ ▆ ▅ ▃ ▂  "];
    return frames[Math.floor(Date.now() / 500) % frames.length];
}

export function createProgressBar(current, total, size = 18) {
    const progress = Math.round((size * current) / total);
    const emptyProgress = size - progress;
    const progressText = '▶️' + '🟦'.repeat(Math.max(0, progress)) + '⬜'.repeat(Math.max(0, emptyProgress));
    const percentage = Math.round((current / total) * 100);
    return `\`${formatDuration(current)}\` ${progressText} \`${formatDuration(total)}\` **[${percentage}%]**`;
}

export function buildPremiumEmbed(track, isTikTok, author, position = 0, botUser) {
    const viz = getVisualizer();
    return new EmbedBuilder()
        .setColor(isTikTok ? '#FE2C55' : '#1DB954')
        .setAuthor({ name: `NOW PLAYING | ${viz}`, iconURL: botUser.displayAvatarURL({ dynamic: true }) })
        .setTitle(`🎶 ${track.info.title}`)
        .setURL(track.info.uri)
        .setDescription(`
**Artist:** \`${track.info.author}\` | **Requested by:** ${author}

**${viz} SPECTRUM ANALYZER ${viz}**
${createProgressBar(position, track.info.length)}
        `)
        .addFields(
            { name: '🔊 Audio Engine', value: `\`DSP Mode V3.0\``, inline: true },
            { name: '✨ Quality', value: `\`Lossless FLAC\``, inline: true },
            { name: '📶 Latency', value: `\`Live Mode\``, inline: true }
        )
        .setImage(isTikTok ? track.info.artworkUrl : `https://i.ytimg.com/vi/${track.info.identifier}/maxresdefault.jpg`)
        .setFooter({ text: `DSP Processing Active • Source: ${isTikTok ? 'TikTok' : 'YouTube'}`, iconURL: author.displayAvatarURL() })
        .setTimestamp();
}

export function createPremiumButtons(url, autoplay = false) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pause_music').setEmoji('⏯️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('skip_music').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('shuffle_music').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('stop_music').setEmoji('🛑').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setLabel('Source').setURL(url).setStyle(ButtonStyle.Link)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vol_down').setEmoji('🔉').setLabel('-10').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vol_up').setEmoji('🔊').setLabel('+10').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('toggle_autoplay').setEmoji('📻').setLabel(`Autoplay: ${autoplay ? 'ON' : 'OFF'}`).setStyle(autoplay ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
    return [row1, row2];
}

export function createPremiumFilters() {
    // Mengambil tepat 10 filter premium
    const filterKeys = Object.keys(MUSIC_FILTERS).slice(0, 10);
    const options = filterKeys.map(n => ({
        label: n,
        value: n,
        description: `Aktifkan efek audio premium ${n}`,
        emoji: '💎'
    }));

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('filter_music')
            .setPlaceholder('💎 10 Premium Audio Filters Available...')
            .addOptions(options)
    );
}