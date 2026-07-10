const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const CommandStat = require('../database/models/CommandStat');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const PAGE_SIZE = 20;
const sessions  = new Map(); // userId → { rows, page, totalPages, period }

// ─── Périodes disponibles ─────────────────────────────────────────────────────
const PERIODS = [
  { value: 'all',        label: 'Tout (depuis le début)',  emoji: '📊', desc: 'Toutes les utilisations enregistrées' },
  { value: '30j',        label: '30 derniers jours',       emoji: '📅', desc: 'Commandes des 30 derniers jours'      },
  { value: '7j',         label: '7 derniers jours',        emoji: '🗓️', desc: 'Commandes des 7 derniers jours'       },
  { value: "aujourd'hui",label: 'Aujourd\'hui',            emoji: '🌅', desc: 'Commandes depuis minuit aujourd\'hui' },
];

const PERIOD_LABELS = Object.fromEntries(PERIODS.map(p => [p.value, `${p.emoji} ${p.label}`]));

function periodFilter(period) {
  const now = Date.now();
  switch (period) {
    case '30j':         return { usedAt: { $gte: new Date(now - 30 * 86400000) } };
    case '7j':          return { usedAt: { $gte: new Date(now -  7 * 86400000) } };
    case "aujourd'hui": return { usedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } };
    default:            return {};
  }
}

// ─── Requête MongoDB ──────────────────────────────────────────────────────────
async function fetchRows(guildId, period) {
  return CommandStat.aggregate([
    { $match: { guildId, ...periodFilter(period) } },
    { $group: { _id: '$command', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
}

// ─── Builders d'embeds et composants ─────────────────────────────────────────
function buildEmbed(client, rows, page, totalPages, period) {
  const medal = ['🥇', '🥈', '🥉'];
  const start = page * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);

  const lines = slice.length
    ? slice.map((r, i) => {
        const rank   = start + i;
        const prefix = medal[rank] ?? `\`${String(rank + 1).padStart(2)}\``;
        const uses   = r.count === 1 ? '1 utilisation' : `${r.count.toLocaleString('fr-FR')} utilisations`;
        return `${prefix} \`${r._id}\` — **${uses}**`;
      })
    : ['*Aucune commande pour cette période.*'];

  const totalUses = rows.reduce((acc, r) => acc + r.count, 0);

  return new EmbedBuilder()
    .setColor(0xFF8C00)
    .setAuthor({ name: 'SUPREMYX — Statistiques des commandes', iconURL: client.user.displayAvatarURL() })
    .setDescription(lines.join('\n'))
    .setFooter({
      text: [
        `Période : ${PERIOD_LABELS[period] ?? period}`,
        `${rows.length} commande(s) · ${totalUses.toLocaleString('fr-FR')} utilisation(s) au total`,
        `Page ${page + 1}/${totalPages || 1}`,
      ].join('  ·  '),
    })
    .setTimestamp();
}

function buildPeriodRow(userId, period) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`commandes_period:${userId}`)
      .setPlaceholder('📅 Changer la période...')
      .addOptions(
        PERIODS.map(p => ({
          label:       p.label,
          value:       p.value,
          description: p.desc,
          emoji:       p.emoji,
          default:     p.value === period,
        }))
      )
  );
}

function buildNavRow(userId, page, totalPages, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`commandes_nav:${userId}:prev`)
      .setLabel('◀ Précédent')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page === 0),
    new ButtonBuilder()
      .setCustomId(`commandes_nav:${userId}:next`)
      .setLabel('Suivant ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page >= totalPages - 1)
  );
}

function buildComponents(userId, page, totalPages, period, expired = false) {
  const rows = [buildPeriodRow(userId, period)];
  if (totalPages > 1) rows.push(buildNavRow(userId, page, totalPages, expired));
  return rows;
}

function buildExpiredComponents(period) {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('commandes_period_exp')
        .setPlaceholder('⏱️ Session expirée — retape !commandes')
        .setDisabled(true)
        .addOptions([{ label: 'Expiré', value: 'expired' }])
    ),
  ];
}

// ─── Module ───────────────────────────────────────────────────────────────────
module.exports = (client) => {

  // ── Commande principale ────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.content.trim() !== '!commandes') return;

    const cd = checkCooldown(message.author.id, 'commandes', 15, message.guild?.id);
    if (cd) return replyCooldown(message, cd, 'commandes');

    const period = 'all';
    let rows;
    try {
      rows = await fetchRows(message.guild.id, period);
    } catch (err) {
      console.error('[commandes]', err);
      return message.reply('❌ Erreur lors de la récupération des statistiques.');
    }

    if (!rows.length) {
      return message.reply('📊 Aucune commande enregistrée sur ce serveur pour l\'instant.');
    }

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const page = 0;
    const userId = message.author.id;

    sessions.set(userId, { rows, page, totalPages, period, guildId: message.guild.id });

    const sent = await message.channel.send({
      embeds:     [buildEmbed(client, rows, page, totalPages, period)],
      components: buildComponents(userId, page, totalPages, period),
    });

    // Timeout 5 minutes → désactiver les composants
    setTimeout(async () => {
      sessions.delete(userId);
      try { await sent.edit({ components: buildExpiredComponents(period) }); } catch {}
    }, 5 * 60 * 1000);
  });

  // ── Changement de période (select menu) ───────────────────────────────────
  client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('commandes_period:')) return;

    const ownerId = interaction.customId.split(':')[1];
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: '⚠️ Seul l\'auteur de la commande peut utiliser ce menu.', ephemeral: true });
    }

    const session = sessions.get(ownerId);
    if (!session) {
      return interaction.reply({ content: '⚠️ Session expirée. Retape `!commandes`.', ephemeral: true });
    }

    const newPeriod = interaction.values[0];

    let rows;
    try {
      rows = await fetchRows(session.guildId, newPeriod);
    } catch (err) {
      console.error('[commandes period]', err);
      return interaction.reply({ content: '❌ Erreur lors de la récupération.', ephemeral: true });
    }

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    session.rows       = rows;
    session.page       = 0;
    session.totalPages = totalPages;
    session.period     = newPeriod;

    await interaction.update({
      embeds:     [buildEmbed(client, rows, 0, totalPages, newPeriod)],
      components: buildComponents(ownerId, 0, totalPages, newPeriod),
    });
  });

  // ── Navigation (boutons précédent / suivant) ───────────────────────────────
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('commandes_nav:')) return;

    const parts   = interaction.customId.split(':');
    const ownerId = parts[1];
    const dir     = parts[2];

    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: '⚠️ Seul l\'auteur de la commande peut utiliser ces boutons.', ephemeral: true });
    }

    const session = sessions.get(ownerId);
    if (!session) {
      return interaction.reply({ content: '⚠️ Session expirée. Retape `!commandes`.', ephemeral: true });
    }

    if (dir === 'prev') session.page = Math.max(0, session.page - 1);
    if (dir === 'next') session.page = Math.min(session.totalPages - 1, session.page + 1);

    await interaction.update({
      embeds:     [buildEmbed(client, session.rows, session.page, session.totalPages, session.period)],
      components: buildComponents(ownerId, session.page, session.totalPages, session.period),
    });
  });
};
