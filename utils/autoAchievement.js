const Achievement = require('../database/models/Achievement');
const Match = require('../database/models/Match');
const Team = require('../database/models/Team');

const AUTO_ACHIEVEMENTS = [
  {
    id: 'first_win',
    icon: '🥇',
    title: 'Première Victoire',
    description: 'Remporter son premier match.',
    check: (team, matches) => matches.some(m => m.placement === 1),
  },
  {
    id: 'hat_trick',
    icon: '🎩',
    title: 'Hat-Trick',
    description: '3 victoires consécutives.',
    check: (team, matches) => {
      let consecutive = 0;
      for (const m of [...matches].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))) {
        if (m.placement === 1) consecutive++;
        else break;
      }
      return consecutive >= 3;
    },
  },
  {
    id: 'unstoppable',
    icon: '🔥',
    title: 'Inarrêtable',
    description: '5 victoires consécutives.',
    check: (team, matches) => {
      let consecutive = 0;
      for (const m of [...matches].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))) {
        if (m.placement === 1) consecutive++;
        else break;
      }
      return consecutive >= 5;
    },
  },
  {
    id: 'sniper',
    icon: '🎯',
    title: 'Sniper de l\'arène',
    description: '15 kills dans un seul match.',
    check: (team, matches) => matches.some(m => m.kills >= 15),
  },
  {
    id: 'kill_machine',
    icon: '💀',
    title: 'Machine à kills',
    description: '100 kills au total.',
    check: (team, matches) => team.kills >= 100,
  },
  {
    id: 'veteran',
    icon: '🎖️',
    title: 'Vétéran',
    description: '20 matchs joués.',
    check: (team, matches) => matches.length >= 20,
  },
  {
    id: 'champion',
    icon: '🏆',
    title: 'Champion',
    description: '10 victoires au total.',
    check: (team, matches) => matches.filter(m => m.placement === 1).length >= 10,
  },
  {
    id: 'consistent',
    icon: '📊',
    title: 'Régularité d\'acier',
    description: 'Top 3 sur 5 matchs consécutifs.',
    check: (team, matches) => {
      const sorted = [...matches].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      let consecutive = 0;
      for (const m of sorted) {
        if (m.placement <= 3) consecutive++;
        else break;
      }
      return consecutive >= 5;
    },
  },
  {
    id: 'comeback',
    icon: '⚡',
    title: 'Comeback King',
    description: 'Victoire après 3 défaites consécutives.',
    check: (team, matches) => {
      const sorted = [...matches].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      let lossStreak = 0;
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].placement > 5) lossStreak++;
        else if (sorted[i].placement === 1 && lossStreak >= 3) return true;
        else lossStreak = 0;
      }
      return false;
    },
  },
  {
    id: 'point_machine',
    icon: '⭐',
    title: 'Machine à points',
    description: '500 points totaux.',
    check: (team, matches) => team.points >= 500,
  },
];

async function checkAutoAchievements(client, teamName) {
  const team = await Team.findOne({ name: teamName });
  if (!team) return [];

  const matches = await Match.find({ team: teamName }).sort({ createdAt: -1 }).lean();
  const unlocked = [];

  for (const ach of AUTO_ACHIEVEMENTS) {
    const alreadyHas = await Achievement.findOne({
      target: teamName,
      title: ach.title,
      autoId: ach.id
    });
    if (alreadyHas) continue;

    if (ach.check(team, matches)) {
      await Achievement.create({
        target: teamName,
        title: ach.title,
        description: ach.description,
        icon: ach.icon,
        awardedBy: 'SUPREMYX Bot',
        autoId: ach.id
      });
      unlocked.push(ach);
    }
  }

  return unlocked;
}

async function announceAchievements(client, teamName, achievements) {
  if (!achievements.length) return;
  const { EmbedBuilder } = require('discord.js');
  const channelId = process.env.ACHIEVEMENT_CHANNEL_ID || process.env.LOG_CHANNEL_ID;
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  for (const ach of achievements) {
    const embed = new EmbedBuilder()
      .setTitle(`${ach.icon} Succès débloqué !`)
      .setColor(0xFEE75C)
      .addFields(
        { name: '🎯 Équipe', value: teamName, inline: true },
        { name: '🏅 Succès', value: ach.title, inline: true }
      )
      .setDescription(ach.description)
      .setFooter({ text: 'SUPREMYX · Succès automatique' })
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
  }
}

module.exports = { checkAutoAchievements, announceAchievements, AUTO_ACHIEVEMENTS };
