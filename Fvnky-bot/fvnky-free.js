import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { formatDuration } from './index.js';

export function buildFreeEmbed(track, author, botUser) {
    return new EmbedBuilder()
        .setColor('#808080')
        .setAuthor({ name: '🎶 NOW PLAYING', iconURL: botUser.displayAvatarURL() })
        .setTitle(track.info.title)
        .setURL(track.info.uri)
        .setThumbnail(track.info.artworkUrl || `https://i.ytimg.com/vi/${track.info.identifier}/hqdefault.jpg`)
        .setDescription(`
**Artist:** \`${track.info.author}\`
**Duration:** \`${formatDuration(track.info.length)}\`
**Requested by:** ${author}
        `);
}

export function createFreeButtons() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pause_music').setEmoji('⏯️').setLabel('Pause').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('stop_music').setEmoji('🛑').setLabel('Stop').setStyle(ButtonStyle.Danger)
    )];
}