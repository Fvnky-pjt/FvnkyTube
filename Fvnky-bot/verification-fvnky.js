import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} from 'discord.js';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 menit

function isExpired(createdAt) {
    if (!createdAt) return true;
    return Date.now() - createdAt > CODE_TTL_MS;
}

async function assignRoleBatched(guild, roleId, options = {}) {
    const {
        batchSize = 20,
        delayMs = 800,
        shouldSkip = () => false
    } = options;

    const members = await guild.members.fetch();
    const list = [...members.values()].filter(m => !m.user.bot);

    for (let i = 0; i < list.length; i += batchSize) {
        const chunk = list.slice(i, i + batchSize);
        await Promise.all(
            chunk.map(async (member) => {
                try {
                    if (shouldSkip(member)) return;
                    await member.roles.add(roleId);
                } catch (e) {
                    // Rate limit/permission error: skip per-member agar proses lanjut
                }
            })
        );
        if (i + batchSize < list.length) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
}


/**
 * Handler utama untuk interaksi verifikasi (Slash Commands, Buttons, Modals)
 */
export async function handleVerificationInteraction(interaction, client, logger) {
    // 1. Slash Command Handler: Setup Verification
    if (interaction.isChatInputCommand() && interaction.commandName === 'fvnky-verification') {
        if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: '❌ Hanya Administrator yang bisa melakukan setup!', flags: [MessageFlags.Ephemeral] });

        const channel = interaction.options.getChannel('channel');
        const unverifiedRole = interaction.options.getRole('unverified_role');
        const verifiedRole = interaction.options.getRole('verified_role');
        const minAgeRaw = interaction.options.getString('min_age');
        const logChannel = interaction.options.getChannel('log_channel');

        const normalizedMinAge = (minAgeRaw === 'ALL' || minAgeRaw === '0')
            ? minAgeRaw
            : Number(minAgeRaw);

        client.verificationSettings.set(interaction.guildId, {
            channelId: channel.id,
            unverifiedRoleId: unverifiedRole.id,
            verifiedRoleId: verifiedRole.id,
            minAge: normalizedMinAge,
            logChannelId: logChannel.id
        });

        await interaction.reply({ content: `⏳ Sedang memproses setup verifikasi... Memberikan role ${unverifiedRole} ke semua orang.`, flags: [MessageFlags.Ephemeral] });

        // Berikan role unverified ke semua member (batched agar tidak kena rate limit)
        try {
            await assignRoleBatched(interaction.guild, unverifiedRole.id, {
                shouldSkip: (member) => member.roles.cache.has(unverifiedRole.id) || member.user.bot
            });
        } catch (e) {
            logger?.error?.('[verification] gagal assign unverified role', e);
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL({ dynamic: true }) })
            .setTitle(`🛡️ Verification System - ${interaction.guild.name}`)
            .setDescription(`Selamat Datang Di **${interaction.guild.name}** Semoga Anda Menikmati Bahagia Di Server Ini`)
            .setFooter({ text: 'Klik tombol di bawah untuk memulai proses verifikasi' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_fvnky_verify').setLabel('Verifikasi').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('fvnky_tutorial').setLabel('Tutorials').setStyle(ButtonStyle.Secondary).setEmoji('📖')
        );

        await channel.send({ embeds: [embed], components: [row] });
        return interaction.followUp({ content: '✅ Setup selesai dan pesan verifikasi telah dikirim!', flags: [MessageFlags.Ephemeral] });
    }

    // 2. Button Handler: Start Process
    if (interaction.isButton()) {
        if (interaction.customId === 'fvnky_tutorial') {
            return interaction.reply({ 
                content: `📖 **Cara Verifikasi:**\n1. Klik tombol **Verifikasi**.\n2. Isi form data diri anda.\n3. Klik tombol **Kirim Kode** untuk menerima kode di email.\n4. Masukkan kode 5-digit dan nama anda.\n5. Selesai!`, 
                flags: [MessageFlags.Ephemeral]
            });
        }

        if (interaction.customId === 'start_fvnky_verify') {
            const modal = new ModalBuilder()
                .setCustomId('fvnky_verify_modal')
                .setTitle('Form Verifikasi Member');

            const emailInput = new TextInputBuilder().setCustomId('email').setLabel('Email Anda').setStyle(TextInputStyle.Short).setPlaceholder('contoh@gmail.com').setRequired(true);
            const ageInput = new TextInputBuilder().setCustomId('age').setLabel('Umur Anda').setStyle(TextInputStyle.Short).setPlaceholder('Contoh: 18').setRequired(true);
            const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Alasan Anda Mau Masuk').setStyle(TextInputStyle.Paragraph).setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(emailInput), new ActionRowBuilder().addComponents(ageInput), new ActionRowBuilder().addComponents(reasonInput));
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'send_verify_code') {
            await interaction.reply({ content: '⏳ Sedang memproses verifikasi...', flags: [MessageFlags.Ephemeral] });
            
            const userData = client.verifications.get(interaction.user.id);
            const settings = client.verificationSettings.get(interaction.guildId);
            if (!userData || !settings) return interaction.editReply({ content: '❌ Data sesi tidak ditemukan. Silahkan isi form ulang.' });
            if (userData.guildId !== interaction.guildId) {
                return interaction.editReply({ content: '❌ Sesi verifikasi tidak sesuai dengan server ini.' });
            }

            // Buat/mewujudkan kode + timestamp
            const code = Math.floor(10000 + Math.random() * 90000).toString();
            userData.code = code;
            userData.codeCreatedAt = Date.now();
            client.verifications.set(interaction.user.id, userData);


            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });

            // Membaca template HTML
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            let htmlTemplate = fs.readFileSync(path.join(__dirname, 'verifi.html'), 'utf8');
            
            // Mengganti placeholder dengan data asli
            htmlTemplate = htmlTemplate
                .replace('{{CODE}}', code)
                .replace('{{USER_NAME}}', interaction.user.username)
                .replace('{{SERVER_NAME}}', interaction.guild.name);

            try {
                await transporter.sendMail({
                    from: `"Fvnky Security" <${process.env.EMAIL_USER}>`,
                    to: userData.email,
                    subject: 'Kode Verifikasi Anda',
                    html: htmlTemplate
                });

                const embed = new EmbedBuilder()
                    .setColor('#00FFFF')
                    .setDescription('✅ **Ok Saya Sudah Kirim Kode Ke Email Anda**');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('start_confirm_modal').setLabel('Mulai').setStyle(ButtonStyle.Primary)
                );

                return interaction.editReply({ content: null, embeds: [embed], components: [row] });
            } catch (err) {
                return interaction.editReply({ content: '❌ Gagal mengirim email. Periksa kembali alamat email anda.' });
            }
        }

        if (interaction.customId === 'start_confirm_modal') {
            const modal = new ModalBuilder().setCustomId('fvnky_confirm_modal').setTitle('Konfirmasi Kode');
            const nameInput = new TextInputBuilder().setCustomId('real_name').setLabel('Nama Anda').setStyle(TextInputStyle.Short).setRequired(true);
            const codeInput = new TextInputBuilder().setCustomId('input_code').setLabel('Kode').setStyle(TextInputStyle.Short).setMaxLength(5).setRequired(true);
            
            modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(codeInput));
            return interaction.showModal(modal);
        }
    }

    // 3. Modal Submit Handler
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'fvnky_verify_modal') {
            await interaction.reply({ content: '⏳ Memproses data...', flags: [MessageFlags.Ephemeral] });
            
            const email = interaction.fields.getTextInputValue('email');
            const age = interaction.fields.getTextInputValue('age');
            const reason = interaction.fields.getTextInputValue('reason');

            // Session per-user (per guild). Simpan TTL code saat nanti request "send_verify_code".
            client.verifications.set(interaction.user.id, {
                email,
                age,
                reason,
                guildId: interaction.guildId,
                code: null,
                codeCreatedAt: null
            });

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`Halo **${interaction.user.username}** Kamu Mau Verifikasi ya! Ok Klik Tombol Verifi di bawah ini`);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('send_verify_code').setLabel('Verifikasi').setStyle(ButtonStyle.Success)
            );

            return interaction.editReply({ content: null, embeds: [embed], components: [row] });
        }

        if (interaction.customId === 'fvnky_confirm_modal') {
            await interaction.reply({ content: '⏳ Memverifikasi kode...', flags: [MessageFlags.Ephemeral] });
            
            const realName = interaction.fields.getTextInputValue('real_name');
            const inputCode = interaction.fields.getTextInputValue('input_code');
            const userData = client.verifications.get(interaction.user.id);
            const settings = client.verificationSettings.get(interaction.guildId);

            if (!userData || !settings) return interaction.editReply({ content: '❌ Terjadi kesalahan sesi.' });
            if (!userData.code || !userData.codeCreatedAt) {
                return interaction.editReply({ content: '❌ Kode verifikasi belum dibuat/terhapus. Silahkan klik Verifikasi lagi.' });
            }

            // Standardisasi umur: simpan & bandingkan sebagai number
            const ageNum = Number(userData.age);
            const minAgeNum = settings.minAge === 'ALL' || settings.minAge === '0' ? null : Number(settings.minAge);
            if (Number.isNaN(ageNum)) {
                return interaction.editReply({ content: '❌ Umur yang anda masukkan tidak valid.' });
            }
            userData.age = ageNum;

            if (userData.guildId !== interaction.guildId) {
                return interaction.editReply({ content: '❌ Sesi verifikasi tidak sesuai dengan server ini.' });
            }

            if (inputCode !== userData.code) return interaction.editReply({ content: '❌ Kode yang anda masukkan salah!' });

            if (isExpired(userData.codeCreatedAt)) {
                client.verifications.delete(interaction.user.id);
                return interaction.editReply({ content: '❌ Kode verifikasi sudah kedaluwarsa. Silahkan klik Verifikasi lagi.' });
            }

            if (minAgeNum !== null) {
                if (ageNum < minAgeNum) {
                    return interaction.editReply({ content: `❌ Maaf, umur anda (${ageNum}) belum mencukupi syarat minimal (${minAgeNum}).` });
                }
            }

            const member = await interaction.guild.members.fetch(interaction.user.id);
            await member.roles.add(settings.verifiedRoleId).catch(() => {});
            await member.roles.remove(settings.unverifiedRoleId).catch(() => {});

            client.verifications.delete(interaction.user.id);
            const successEmbed = new EmbedBuilder().setColor('#00FF00').setTitle('✅ Berhasil Terverifikasi').setDescription(`Selamat **${realName}**, anda sekarang telah resmi terverifikasi di server ini!`);
            await interaction.editReply({ embeds: [successEmbed] });

            const logChannel = interaction.guild.channels.cache.get(settings.logChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#00eeff')
                    .setAuthor({ name: 'Verification System', iconURL: client.user.displayAvatarURL() })
                    .setTitle('📄 New Verification Log')
                    .addFields(
                        { name: 'User Tag', value: `${interaction.user.tag}`, inline: true },
                        { name: 'Nama Real', value: `${realName}`, inline: true },
                        { name: 'Umur', value: `${userData.age}`, inline: true },
                        { name: 'Alasan', value: `${userData.reason}` }
                    ).setDescription(`Ada yg Verification Bernama : **${realName}**`).setTimestamp();
                logChannel.send({ embeds: [logEmbed] });
            }
        }
    }
}