require('dotenv').config();

module.exports = {
  // Token bot discord dari Discord Developer Portal
  token: process.env.DISCORD_TOKEN || '',
  
  // Prefix untuk command bot
  prefix: process.env.PREFIX || '!',
  
  // Nama role yang akan diberikan ke member setelah verifikasi
  memberRoleName: process.env.MEMBER_ROLE_NAME || 'Member',

  // Nama role khusus Murid Phisink
  phisinkRoleName: process.env.PHISINK_ROLE_NAME || 'MURID PHISINK',
  
  // Nama channel verifikasi (hanya channel ini yang bisa dilihat oleh @everyone)
  verifyChannelName: process.env.VERIFY_CHANNEL_NAME || 'get-roles-member',

  // Nama channel untuk server logs (otomatis mencatat aktivitas server)
  logsChannelName: process.env.LOGS_CHANNEL_NAME || 'member-logs',

  // Nama kategori server stats (untuk auto-update jumlah member)
  statsChannelNames: {
    allMembers: process.env.STATS_ALL_MEMBERS || 'All Members',
    members:    process.env.STATS_MEMBERS    || 'Members',
    bots:       process.env.STATS_BOTS       || 'Bots'
  },

  // Nama kategori/channel yang bersifat READ-ONLY untuk Member (Hanya bisa melihat, tidak bisa chat/masuk voice)
  readOnlyCategories: [
    'SERVER STATS',
    'SERVER GATE',
    'INFORMATION'
  ],

  // Nama channel khusus yang dibuat READ-ONLY untuk Member jika berada di luar kategori di atas
  readOnlyChannels: [
    'welcome-gate',
    'goodbye',
    'rules',
    'member-logs',
    'server-booster',
    'get-roles-phisink',
    'get-roles-member'
  ]
};
