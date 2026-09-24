const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');
require('dotenv').config();

// ============================================================
// PERSISTENT DATA (untuk simpan channel logs, dll.)
// ============================================================
const DATA_PATH = path.join(__dirname, 'data.json');

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (_) {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

let botData = loadData();

// Web Server Ringan (Keep-Alive untuk Hosting Gratis)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`Bot ${config.memberRoleName} is Online 24/7!`);
});
server.listen(PORT, () => console.log(`Web Server aktif di port ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent
  ]
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isReadOnlyTarget(name) {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const cat of config.readOnlyCategories) {
    if (n.includes(cat.toLowerCase().replace(/[^a-z0-9]/g, ''))) return true;
  }
  for (const ch of config.readOnlyChannels) {
    if (n.includes(ch.toLowerCase().replace(/[^a-z0-9]/g, ''))) return true;
  }
  return false;
}

function isStatsVoice(channel) {
  const name = channel.name.toLowerCase();
  const pName = channel.parent ? channel.parent.name.toLowerCase() : '';
  return (
    (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) &&
    (pName.includes('stats') || name.includes('members') || name.includes('bots') || name.includes('all members'))
  );
}

async function getOrCreateMemberRole(guild) {
  let r = guild.roles.cache.find(r => r.name.toLowerCase() === config.memberRoleName.toLowerCase());
  if (!r) r = await guild.roles.create({ name: config.memberRoleName, color: 0x3498db, reason: 'Auto-created by Bot' });
  return r;
}

async function getOrCreatePhisinkRole(guild) {
  let r = guild.roles.cache.find(r => r.name.toLowerCase() === config.phisinkRoleName.toLowerCase());
  if (!r) r = await guild.roles.create({ name: config.phisinkRoleName, color: 0xf1c40f, mentionable: true, reason: 'Auto-created by Bot' });
  return r;
}

// =======================================================
// FITUR 1: AUTO-UPDATE SERVER STATS
// =======================================================
async function updateServerStats(guild) {
  try {
    const members = await guild.members.fetch();
    const totalAll = members.size;
    const totalBots = members.filter(m => m.user.bot).size;
    const totalMembers = totalAll - totalBots;

    const voiceChannels = guild.channels.cache.filter(
      c => c.type === ChannelType.GuildVoice && c.parent && c.parent.name.toLowerCase().includes('stats')
    );

    for (const [, ch] of voiceChannels) {
      const n = ch.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      let newName = null;

      if (n.includes('all') && n.includes('member')) {
        newName = `All Members: ${totalAll}`;
      } else if (n.includes('member') && !n.includes('all')) {
        newName = `Members: ${totalMembers}`;
      } else if (n.includes('bot')) {
        newName = `Bots: ${totalBots}`;
      }

      if (newName && ch.name !== newName) {
        await ch.setName(newName).catch(() => {});
        await sleep(1500);
      }
    }
  } catch (e) {
    console.error('[STATS] Error:', e.message);
  }
}

// =======================================================
// FITUR 5: HELPER KIRIM LOG
// =======================================================
async function sendLog(guild, embed) {
  try {
    let logsChannel = null;

    // Prioritas 1: Gunakan channel ID yang sudah disimpan via !setlogs
    const savedId = botData[`logsChannel_${guild.id}`];
    if (savedId) {
      logsChannel = guild.channels.cache.get(savedId);
    }

    // Prioritas 2: Fallback ke nama channel dari config (.env)
    if (!logsChannel) {
      logsChannel = guild.channels.cache.find(
        c => c.name.toLowerCase().includes(config.logsChannelName.toLowerCase()) && c.type === ChannelType.GuildText
      );
    }

    if (logsChannel) await logsChannel.send({ embeds: [embed] });
  } catch (e) {
    console.error('[LOGS] Error:', e.message);
  }
}

// =======================================================
// READY
// =======================================================
client.once('ready', () => {
  console.log('===========================================');
  console.log(`Bot Online: ${client.user.tag}`);
  console.log(`Prefix: ${config.prefix}`);
  console.log(`Role Member: ${config.memberRoleName}`);
  console.log(`Role Phisink: ${config.phisinkRoleName}`);
  console.log(`Logs Channel: #${config.logsChannelName}`);
  console.log('Commands: setup verify allmember phisink clear timeout kick ban help');
  console.log('===========================================');
  client.guilds.cache.forEach(g => updateServerStats(g));
});

// =======================================================
// FITUR 1: UPDATE STATS SAAT MEMBER JOIN/LEAVE
// =======================================================
client.on('guildMemberAdd', async (member) => {
  await updateServerStats(member.guild);

  // FITUR 5: Log join
  const embed = new EmbedBuilder()
    .setTitle('📥 Member Baru Join!')
    .setDescription(`<@${member.id}> bergabung ke server!`)
    .addFields(
      { name: '👤 Username', value: member.user.tag, inline: true },
      { name: '🆔 User ID', value: member.id, inline: true },
      { name: '📅 Akun Dibuat', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: '👥 Total Member', value: `${member.guild.memberCount}`, inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setColor(0x00FF88)
    .setFooter({ text: `${member.guild.name} • Member Logs` })
    .setTimestamp();
  await sendLog(member.guild, embed);
});

client.on('guildMemberRemove', async (member) => {
  await updateServerStats(member.guild);

  // FITUR 5: Log leave
  const embed = new EmbedBuilder()
    .setTitle('📤 Member Keluar')
    .setDescription(`**${member.user.tag}** meninggalkan server.`)
    .addFields(
      { name: '👤 Username', value: member.user.tag, inline: true },
      { name: '🆔 User ID', value: member.id, inline: true },
      { name: '👥 Total Member', value: `${member.guild.memberCount}`, inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setColor(0xFF4444)
    .setFooter({ text: `${member.guild.name} • Member Logs` })
    .setTimestamp();
  await sendLog(member.guild, embed);
});

// =======================================================
// FITUR 5: LOG PESAN DIHAPUS
// =======================================================
client.on('messageDelete', async (message) => {
  if (!message.guild || message.author?.bot) return;
  if (!message.content && message.attachments.size === 0) return;

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Pesan Dihapus')
    .setDescription(`Pesan di <#${message.channelId}> dihapus.`)
    .addFields(
      { name: '👤 Penulis', value: message.author ? `${message.author.tag} (<@${message.author.id}>)` : 'Tidak diketahui', inline: true },
      { name: '📌 Channel', value: `<#${message.channelId}>`, inline: true },
      {
        name: '💬 Isi Pesan',
        value: message.content
          ? (message.content.length > 1000 ? message.content.slice(0, 1000) + '...' : message.content)
          : '*[Tidak ada teks / hanya media]*'
      }
    )
    .setColor(0xFF6B35)
    .setFooter({ text: `${message.guild.name} • Message Logs` })
    .setTimestamp();

  if (message.attachments.size > 0) {
    embed.addFields({ name: '📎 Attachment', value: `${message.attachments.size} file`, inline: true });
  }

  await sendLog(message.guild, embed);
});

// =======================================================
// FITUR 5: LOG PESAN DIEDIT
// =======================================================
client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (!newMsg.guild || newMsg.author?.bot) return;
  if (!oldMsg.content || oldMsg.content === newMsg.content) return;

  const embed = new EmbedBuilder()
    .setTitle('✏️ Pesan Diedit')
    .setDescription(`Pesan di <#${newMsg.channelId}> diedit. [Lihat](${newMsg.url})`)
    .addFields(
      { name: '👤 Penulis', value: `${newMsg.author.tag} (<@${newMsg.author.id}>)`, inline: true },
      { name: '📌 Channel', value: `<#${newMsg.channelId}>`, inline: true },
      { name: '📝 Sebelum', value: oldMsg.content.length > 500 ? oldMsg.content.slice(0, 500) + '...' : oldMsg.content },
      { name: '✅ Sesudah', value: newMsg.content.length > 500 ? newMsg.content.slice(0, 500) + '...' : newMsg.content }
    )
    .setColor(0xFFA500)
    .setFooter({ text: `${newMsg.guild.name} • Message Logs` })
    .setTimestamp();
  await sendLog(newMsg.guild, embed);
});

// =======================================================
// FITUR 5: LOG PERUBAHAN ROLE
// =======================================================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
  if (added.size === 0 && removed.size === 0) return;

  const embed = new EmbedBuilder()
    .setTitle('🎭 Perubahan Role')
    .setDescription(`Role <@${newMember.id}> berubah.`)
    .addFields({ name: '👤 Member', value: `${newMember.user.tag}`, inline: true })
    .setColor(0x9B59B6)
    .setFooter({ text: `${newMember.guild.name} • Role Logs` })
    .setTimestamp();

  if (added.size > 0) embed.addFields({ name: '✅ Ditambahkan', value: added.map(r => `<@&${r.id}>`).join(', ') });
  if (removed.size > 0) embed.addFields({ name: '❌ Dihapus', value: removed.map(r => `<@&${r.id}>`).join(', ') });

  await sendLog(newMember.guild, embed);
});

// =======================================================
// BUTTON INTERACTION (Tombol Verify)
// =======================================================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== 'btn_verify_member') return;

  try {
    const { member, guild } = interaction;
    const memberRole = await getOrCreateMemberRole(guild);
    const botMember = guild.members.me;

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: '❌ Bot tidak punya izin Manage Roles!', ephemeral: true });
    }
    if (botMember.roles.highest.position <= memberRole.position) {
      return interaction.reply({ content: `❌ Role Bot harus DI ATAS role **${memberRole.name}** di Server Settings!`, ephemeral: true });
    }
    if (member.roles.cache.has(memberRole.id)) {
      return interaction.reply({ content: `ℹ️ Kamu sudah punya role **${memberRole.name}**!`, ephemeral: true });
    }

    await member.roles.add(memberRole);
    return interaction.reply({
      content: `🎉 **Verifikasi Berhasil!** Kamu mendapat role **${memberRole.name}** dan semua channel sekarang terbuka! 🚀`,
      ephemeral: true
    });
  } catch (e) {
    return interaction.reply({ content: `❌ Error: ${e.message}`, ephemeral: true });
  }
});

// =======================================================
// MESSAGE COMMANDS
// =======================================================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- !verify ---
  if (command === 'verify') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator) &&
        !message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply('❌ Butuh izin Administrator.');
    }
    try {
      try { await message.delete(); } catch (_) {}
      const embed = new EmbedBuilder()
        .setTitle('🛡️ VERIFIKASI MEMBER SERVER')
        .setDescription(
          `Selamat datang di **${message.guild.name}**! 👋\n\n` +
          `Tekan tombol hijau di bawah untuk mendapatkan akses penuh ke semua channel.\n\n` +
          `✨ **Setelah Verifikasi:**\n` +
          `• Role **${config.memberRoleName}**\n` +
          `• Akses chat & voice di semua channel\n` +
          `• Akses melihat server stats & pengumuman\n\n` +
          `👇 *Klik tombol di bawah:*`
        )
        .setColor(0x00FFA2)
        .setFooter({ text: `${message.guild.name} • Verification System`, iconURL: message.guild.iconURL() || undefined })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_verify_member').setLabel('✅ Verify / Verifikasi Disini').setStyle(ButtonStyle.Success)
      );

      await message.channel.send({ embeds: [embed], components: [row] });
    } catch (e) {
      message.channel.send(`❌ Error: ${e.message}`);
    }
  }

  // --- !setup ---
  else if (command === 'setup') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ Butuh izin Administrator.');
    }
    const botMember = message.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('❌ Bot butuh izin Manage Roles dan Manage Channels!');
    }

    const statusMsg = await message.reply('⏳ **Setup permission server sedang diproses...** Mohon tunggu.');

    try {
      const guild = message.guild;
      const memberRole = await getOrCreateMemberRole(guild);
      const everyoneRole = guild.roles.everyone;

      let verifyChannel = guild.channels.cache.find(
        c => c.name.toLowerCase().includes('get-roles-member')
      ) || message.channel;

      let cats = 0, chs = 0;
      const channels = await guild.channels.fetch();

      for (const [, ch] of channels) {
        if (!ch) continue;
        const isVerify = ch.id === verifyChannel.id;
        const pName = ch.parent ? ch.parent.name : '';
        const isRO = isReadOnlyTarget(ch.name) || (ch.parent && isReadOnlyTarget(pName));
        const isVStats = isStatsVoice(ch);

        if (isVerify) {
          await ch.permissionOverwrites.edit(everyoneRole, { ViewChannel: true, SendMessages: false, SendMessagesInThreads: false, CreatePublicThreads: false, CreatePrivateThreads: false, AddReactions: false, ReadMessageHistory: true });
          await ch.permissionOverwrites.edit(memberRole, { ViewChannel: true, SendMessages: false, AddReactions: false, ReadMessageHistory: true });
          chs++; continue;
        }

        if (ch.type === ChannelType.GuildCategory) {
          if (isReadOnlyTarget(ch.name)) {
            await ch.permissionOverwrites.edit(everyoneRole, { ViewChannel: false });
            await ch.permissionOverwrites.edit(memberRole, { ViewChannel: true, SendMessages: false, SendMessagesInThreads: false, CreatePublicThreads: false, AddReactions: false, Connect: false, Speak: false, ReadMessageHistory: true });
          } else {
            await ch.permissionOverwrites.edit(everyoneRole, { ViewChannel: false });
            await ch.permissionOverwrites.edit(memberRole, { ViewChannel: true, SendMessages: true, SendMessagesInThreads: true, CreatePublicThreads: true, AddReactions: true, AttachFiles: true, EmbedLinks: true, UseExternalEmojis: true, Connect: true, Speak: true, Stream: true, ReadMessageHistory: true });
          }
          cats++; await sleep(150); continue;
        }

        if (isVStats) {
          await ch.permissionOverwrites.edit(everyoneRole, { ViewChannel: false });
          await ch.permissionOverwrites.edit(memberRole, { ViewChannel: true, Connect: false, Speak: false });
          chs++; await sleep(150); continue;
        }

        if (isRO) {
          await ch.permissionOverwrites.edit(everyoneRole, { ViewChannel: false });
          await ch.permissionOverwrites.edit(memberRole, { ViewChannel: true, SendMessages: false, SendMessagesInThreads: false, CreatePublicThreads: false, AddReactions: false, Connect: false, Speak: false, ReadMessageHistory: true });
        } else {
          await ch.permissionOverwrites.edit(everyoneRole, { ViewChannel: false });
          await ch.permissionOverwrites.edit(memberRole, { ViewChannel: true, SendMessages: true, SendMessagesInThreads: true, CreatePublicThreads: true, AddReactions: true, AttachFiles: true, EmbedLinks: true, UseExternalEmojis: true, Connect: true, Speak: true, Stream: true, ReadMessageHistory: true });
        }
        chs++; await sleep(150);
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Setup Permission Selesai!')
        .setDescription(
          `🔒 **@everyone:** Hanya bisa lihat <#${verifyChannel.id}>\n\n` +
          `👥 **Role ${memberRole.name}:**\n` +
          `• Stats/Gate/Info → Read-Only\n` +
          `• Chat/Lounge/Voice → Akses penuh\n\n` +
          `📊 Kategori: **${cats}** | Channel: **${chs}**\n\n` +
          `💡 Ketik \`!verify\` di <#${verifyChannel.id}> untuk pasang tombol verifikasi!`
        )
        .setColor(0x00FF88).setFooter({ text: `${message.guild.name} • Setup` }).setTimestamp();

      await statusMsg.edit({ content: null, embeds: [embed] });
    } catch (e) {
      await statusMsg.edit(`❌ Error: ${e.message}`);
    }
  }

  // --- !allmember ---
  else if (command === 'allmember') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ Butuh izin Administrator.');
    }
    const statusMsg = await message.reply('⏳ Mengambil data member...');
    try {
      const guild = message.guild;
      const memberRole = await getOrCreateMemberRole(guild);
      const botMember = guild.members.me;
      if (botMember.roles.highest.position <= memberRole.position) {
        return statusMsg.edit(`❌ Role Bot harus DI ATAS role **${memberRole.name}**!`);
      }

      const all = await guild.members.fetch();
      const targets = all.filter(m => !m.user.bot && !m.roles.cache.has(memberRole.id));
      if (targets.size === 0) return statusMsg.edit(`ℹ️ Semua member sudah punya role **${memberRole.name}**!`);

      await statusMsg.edit(`⏳ Memberikan role ke **${targets.size}** member...`);
      let success = 0, fail = 0;
      for (const [, m] of targets) {
        try { await m.roles.add(memberRole); success++; } catch (_) { fail++; }
        await sleep(250);
      }

      const embed = new EmbedBuilder()
        .setTitle('🎉 Role Massal Selesai!')
        .setDescription(`✅ Berhasil: **${success}**\n❌ Gagal: **${fail}**\nRole: <@&${memberRole.id}>`)
        .setColor(0x00FFA2).setTimestamp();
      await statusMsg.edit({ content: null, embeds: [embed] });
    } catch (e) {
      await statusMsg.edit(`❌ Error: ${e.message}`);
    }
  }

  // --- !phisink @user ---
  else if (command === 'phisink') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator) &&
        !message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply('❌ Butuh izin Manage Roles / Administrator.');
    }

    let target = message.mentions.members.first();
    if (!target && args[0]) {
      const id = args[0].replace(/[^0-9]/g, '');
      if (id) try { target = await message.guild.members.fetch(id); } catch (_) {}
    }
    if (!target) return message.reply(`❌ Contoh: \`${config.prefix}phisink @username\``);

    try {
      const phisinkRole = await getOrCreatePhisinkRole(message.guild);
      const bot = message.guild.members.me;
      if (bot.roles.highest.position <= phisinkRole.position) {
        return message.reply(`❌ Role Bot harus DI ATAS role **${phisinkRole.name}**!`);
      }
      if (target.roles.cache.has(phisinkRole.id)) {
        return message.reply(`ℹ️ <@${target.id}> sudah punya role **${phisinkRole.name}**!`);
      }

      await target.roles.add(phisinkRole);

      const embed = new EmbedBuilder()
        .setTitle('🎓 Role Phisink Diberikan!')
        .setDescription(`Selamat <@${target.id}>! 🎉\nMendapat role **${phisinkRole.name}** dari <@${message.author.id}>.`)
        .addFields(
          { name: '👤 Member', value: target.user.tag, inline: true },
          { name: '🎭 Role', value: `<@&${phisinkRole.id}>`, inline: true },
          { name: '✍️ Oleh', value: `<@${message.author.id}>`, inline: true }
        )
        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
        .setColor(0xF1C40F).setFooter({ text: `${message.guild.name} • Phisink Academy` }).setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (e) {
      message.reply(`❌ Error: ${e.message}`);
    }
  }

  // --- FITUR 4: !clear [jumlah] ---
  else if (command === 'clear' || command === 'purge') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ Butuh izin Manage Messages / Administrator.');
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply(`❌ Masukkan jumlah 1-100. Contoh: \`${config.prefix}clear 50\``);
    }

    try {
      await message.delete().catch(() => {});
      const deleted = await message.channel.bulkDelete(amount, true);

      const confirm = await message.channel.send({
        embeds: [new EmbedBuilder()
          .setDescription(`🧹 Berhasil hapus **${deleted.size}** pesan di <#${message.channel.id}>.`)
          .setColor(0x3498db).setFooter({ text: `Oleh: ${message.author.tag}` }).setTimestamp()]
      });
      setTimeout(() => confirm.delete().catch(() => {}), 5000);

      const logEmbed = new EmbedBuilder()
        .setTitle('🧹 Pesan Dihapus Massal')
        .addFields(
          { name: '👤 Admin', value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
          { name: '📌 Channel', value: `<#${message.channel.id}>`, inline: true },
          { name: '🗑️ Jumlah', value: `${deleted.size} pesan`, inline: true }
        )
        .setColor(0x3498db).setFooter({ text: `${message.guild.name} • Mod Logs` }).setTimestamp();
      await sendLog(message.guild, logEmbed);
    } catch (e) {
      message.channel.send(`❌ Error: ${e.message}`);
    }
  }

  // --- FITUR 4: !timeout @user [durasi] [alasan] ---
  else if (command === 'timeout' || command === 'mute') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ Butuh izin Moderate Members / Administrator.');
    }

    let target = message.mentions.members.first();
    if (!target) return message.reply(`❌ Contoh: \`${config.prefix}timeout @user 10m spam\``);

    const durationStr = args[1] || '10m';
    const reason = args.slice(2).join(' ') || 'Tidak ada alasan';
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = durationStr.match(/^(\d+)([smhd])$/i);
    if (!match) return message.reply('❌ Format durasi salah. Contoh: `10m`, `1h`, `2d`');

    const durationMs = parseInt(match[1]) * (multipliers[match[2].toLowerCase()] || 60000);
    if (durationMs > 28 * 24 * 60 * 60 * 1000) return message.reply('❌ Durasi maks 28 hari!');

    try {
      await target.timeout(durationMs, reason);

      const embed = new EmbedBuilder()
        .setTitle('⏱️ Member Di-Timeout!')
        .addFields(
          { name: '👤 Member', value: `${target.user.tag} (<@${target.id}>)`, inline: true },
          { name: '⏳ Durasi', value: durationStr, inline: true },
          { name: '✍️ Oleh', value: `<@${message.author.id}>`, inline: true },
          { name: '📝 Alasan', value: reason }
        )
        .setColor(0xFF8C00).setFooter({ text: `${message.guild.name} • Moderation` }).setTimestamp();

      await message.reply({ embeds: [embed] });
      await sendLog(message.guild, embed);
    } catch (e) {
      message.reply(`❌ Error: ${e.message}`);
    }
  }

  // --- FITUR 4: !untimeout @user ---
  else if (command === 'untimeout' || command === 'unmute') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ Butuh izin Moderate Members.');
    }

    let target = message.mentions.members.first();
    if (!target) return message.reply(`❌ Contoh: \`${config.prefix}untimeout @user\``);

    try {
      await target.timeout(null);
      const embed = new EmbedBuilder()
        .setDescription(`✅ Timeout <@${target.id}> dicabut oleh <@${message.author.id}>.`)
        .setColor(0x00FF88).setTimestamp();
      await message.reply({ embeds: [embed] });
      await sendLog(message.guild, embed);
    } catch (e) {
      message.reply(`❌ Error: ${e.message}`);
    }
  }

  // --- FITUR 4: !kick @user [alasan] ---
  else if (command === 'kick') {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ Butuh izin Kick Members / Administrator.');
    }

    let target = message.mentions.members.first();
    if (!target) return message.reply(`❌ Contoh: \`${config.prefix}kick @user alasan\``);
    if (!target.kickable) return message.reply('❌ Bot tidak bisa kick member ini.');

    const reason = args.slice(1).join(' ') || 'Tidak ada alasan';

    try {
      const embed = new EmbedBuilder()
        .setTitle('👢 Member Di-Kick!')
        .addFields(
          { name: '👤 Member', value: `${target.user.tag} (<@${target.id}>)`, inline: true },
          { name: '✍️ Oleh', value: `<@${message.author.id}>`, inline: true },
          { name: '📝 Alasan', value: reason }
        )
        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
        .setColor(0xFF4444).setFooter({ text: `${message.guild.name} • Moderation` }).setTimestamp();

      await target.kick(reason);
      await message.reply({ embeds: [embed] });
      await sendLog(message.guild, embed);
    } catch (e) {
      message.reply(`❌ Error: ${e.message}`);
    }
  }

  // --- FITUR 4: !ban @user [alasan] ---
  else if (command === 'ban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ Butuh izin Ban Members / Administrator.');
    }

    let target = message.mentions.members.first();
    if (!target) return message.reply(`❌ Contoh: \`${config.prefix}ban @user alasan\``);
    if (!target.bannable) return message.reply('❌ Bot tidak bisa ban member ini.');

    const reason = args.slice(1).join(' ') || 'Tidak ada alasan';

    try {
      const embed = new EmbedBuilder()
        .setTitle('🔨 Member Di-Ban!')
        .addFields(
          { name: '👤 Member', value: `${target.user.tag} (<@${target.id}>)`, inline: true },
          { name: '✍️ Oleh', value: `<@${message.author.id}>`, inline: true },
          { name: '📝 Alasan', value: reason }
        )
        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
        .setColor(0x8B0000).setFooter({ text: `${message.guild.name} • Moderation` }).setTimestamp();

      await target.ban({ reason, deleteMessageSeconds: 86400 });
      await message.reply({ embeds: [embed] });
      await sendLog(message.guild, embed);
    } catch (e) {
      message.reply(`❌ Error: ${e.message}`);
    }
  }

  // --- !unban [userID] ---
  else if (command === 'unban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ Butuh izin Ban Members.');
    }
    const userId = args[0]?.replace(/[^0-9]/g, '');
    if (!userId) return message.reply(`❌ Contoh: \`${config.prefix}unban 123456789\``);

    try {
      await message.guild.members.unban(userId);
      const embed = new EmbedBuilder()
        .setDescription(`✅ User ID \`${userId}\` di-unban oleh <@${message.author.id}>.`)
        .setColor(0x00FF88).setTimestamp();
      await message.reply({ embeds: [embed] });
      await sendLog(message.guild, embed);
    } catch (e) {
      message.reply(`❌ Error: ${e.message}`);
    }
  }

  // --- !setlogs #channel ---
  else if (command === 'setlogs') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator) &&
        !message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply('❌ Butuh izin **Administrator** atau **Manage Server**.');
    }

    // Ambil channel dari mention atau argumen
    let targetChannel = message.mentions.channels.first();

    // Fallback: cari berdasarkan nama atau ID jika tidak di-mention
    if (!targetChannel && args[0]) {
      const input = args[0].replace(/[^a-z0-9-]/gi, '');
      targetChannel = message.guild.channels.cache.find(
        c => c.name.toLowerCase() === input.toLowerCase() && c.type === ChannelType.GuildText
      ) || message.guild.channels.cache.get(args[0]);
    }

    if (!targetChannel) {
      return message.reply(
        `❌ **Format salah!**\nContoh penggunaan:\n` +
        `• \`${config.prefix}setlogs #member-logs\`\n` +
        `• \`${config.prefix}setlogs nama-channel\``
      );
    }

    if (targetChannel.type !== ChannelType.GuildText) {
      return message.reply('❌ Channel yang dipilih harus berupa **text channel**, bukan voice atau kategori!');
    }

    // Simpan ID channel ke data.json
    botData[`logsChannel_${message.guild.id}`] = targetChannel.id;
    saveData(botData);

    // Kirim konfirmasi
    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Server Logs Channel Diperbarui!')
      .setDescription(
        `Semua log aktivitas server sekarang akan dikirim ke <#${targetChannel.id}>.\n\n` +
        `📋 **Yang akan dicatat secara otomatis:**\n` +
        `• 📥 Member baru join server\n` +
        `• 📤 Member keluar / leave server\n` +
        `• 🗑️ Pesan yang dihapus (beserta isinya)\n` +
        `• ✏️ Pesan yang diedit (sebelum & sesudah)\n` +
        `• 🎭 Perubahan role member\n` +
        `• 🧹 Clear/purge massal\n` +
        `• 👢 Kick / 🔨 Ban / ⏱️ Timeout`
      )
      .setColor(0x00FF88)
      .setFooter({ text: `${message.guild.name} • Log Settings` })
      .setTimestamp();

    await message.reply({ embeds: [confirmEmbed] });

    // Test kirim pesan ke channel logs yang baru
    try {
      await targetChannel.send({
        embeds: [new EmbedBuilder()
          .setDescription(`🔔 **Channel ini sekarang aktif sebagai Server Logs!**\nSemua aktivitas server akan dicatat di sini secara otomatis.\n\n*Di-set oleh <@${message.author.id}>*`)
          .setColor(0x5865F2)
          .setTimestamp()
        ]
      });
    } catch (_) {}

    console.log(`[SETLOGS] Logs channel di-set ke #${targetChannel.name} di server ${message.guild.name}`);
  }

  // --- !help ---

  else if (command === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('📖 Daftar Perintah Bot Server')
      .addFields(
        {
          name: '🛠️ Setup & Verifikasi',
          value:
            `\`${config.prefix}setup\` → Atur permission channel otomatis\n` +
            `\`${config.prefix}verify\` → Kirim tombol verifikasi\n` +
            `\`${config.prefix}allmember\` → Beri role Member ke semua\n` +
            `\`${config.prefix}phisink @user\` → Beri role **MURID PHISINK**`
        },
        {
          name: '🔨 Moderasi',
          value:
            `\`${config.prefix}clear [1-100]\` → Hapus pesan massal\n` +
            `\`${config.prefix}timeout @user [durasi] [alasan]\` → Timeout (contoh: \`10m\`, \`1h\`)\n` +
            `\`${config.prefix}untimeout @user\` → Cabut timeout\n` +
            `\`${config.prefix}kick @user [alasan]\` → Kick member\n` +
            `\`${config.prefix}ban @user [alasan]\` → Ban member\n` +
            `\`${config.prefix}unban [ID]\` → Unban member`
        },
        {
          name: '⚙️ Pengaturan Bot',
          value:
            `\`${config.prefix}setlogs #channel\` → Atur channel tujuan server logs`
        },
        {
          name: '📊 Fitur Otomatis (Berjalan Sendiri)',
          value:
            `📈 **Server Stats** → Angka member update otomatis saat ada yang join/leave\n` +
            `📝 **Server Logs** → Semua aktivitas dicatat di \`#${config.logsChannelName}\``
        }
      )
      .setColor(0x5865F2)
      .setFooter({ text: `${message.guild.name} • Bot Help` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
});

// Login Bot
if (!config.token || config.token === 'MASUKKAN_TOKEN_BOT_DISINI') {
  console.error('❌ DISCORD_TOKEN belum diisi di file .env!');
} else {
  client.login(config.token).catch(err => console.error('❌ Gagal login:', err.message));
}
