const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const CommandStat = require('../database/models/CommandStat');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const PAGE_SIZE = 20;
const sessions = new Map(); // userId → { rows, page, totalPages }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildEmbed(client, rows, page, totalPages, guildName) {
  const medal = ['🥇', '🥈', '🥉'];
  const start = page * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);

  const lines = slice.map((r, i) => {
    const rank = start + i;
    const prefix = medal[rank] ?? `\`${String(rank + 1).padStart(2)}\``;
    const uses = r.count === 1 ? '1 utilisation' : `${r.count.toLocaleString('fr-FR')} utilisations`;
    return `${prefix} \`${r._id}\` — **${uses}**`;
  });

  const totalUses = rows.reduce((acc, r) => acc + r.count, 0);

  return new EmbedBuilder()
    .setColor(0xFF8C00)
    .setAuthor({ name: 'SUPREMYX — Statistiques des commandes', iconURL: client.user.displayAvatarURL() })
    .setDescription(lines.join('\n') || '—')
    .setFooter({
      text: `${rows.length} commandes · ${totalUses.toLocaleString('fr-FR')} utilisations au total · Page ${page + 1}/${totalPages}`,
    })
    .setTimestamp();
}

function buildRow(userId, page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`commandes:${userId}:prev`)
      .setLabel('◀ Précédent')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`commandes:${userId}:next`)
      .setLabel('Suivant ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );
}

function buildExpiredRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('commandes_exp_prev')
      .setLabel('◀ Précédent')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('commandes_exp_next')
      .setLabel('Suivant ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

// ─── Module ───────────────────────────────────────────────────────────────────
module.exports = (client) => {

  // ── Commande principale ────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.content.trim() !== '!commandes') return;

    const cd = checkCooldown(message.author.id, 'commandes', 15);
    if (cd) return replyCooldown(message, cd, 'commandes');

    try {
      const rows = await CommandStat.aggregate([
        { $match: { guildId: message.guild.id } },
        { $group: { _id: '$command', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      if (!rows.length) {
        return message.reply('📊 Aucune commande enregistrée sur ce serveur pour l\'instant.');
      }

      const totalPages = Math.ceil(rows.length / PAGE_SIZE);
      const page = 0;

      sessions.set(message.author.id, { rows, page, totalPages });

      const sent = await message.channel.send({
        embeds: [buildEmbed(client, rows, page, totalPages, message.guild.name)],
        components: totalPages > 1 ? [buildRow(message.author.id, page, totalPages)] : [],
      });

      // Timeout 3 minutes → désactiver les boutons
      if (totalPages > 1) {
        setTimeout(async () => {
          sessions.delete(message.author.id);
          try { await sent.edit({ components: [buildExpiredRow()] }); } catch {}
        }, 3 * 60 * 1000);
      }

    } catch (err) {
      console.error('[commandes]', err);
      message.reply('❌ Erreur lors de la récupération des statistiques.');
    }
  });

  // ── Interactions boutons ───────────────────────────────────────────────────
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('commandes:')) return;

    const parts = interaction.customId.split(':');
    const ownerId = parts[1];
    const dir     = parts[2];

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: '⚠️ Seul l\'auteur de la commande peut utiliser ces boutons.',
        ephemeral: true,
      });
    }

    const session = sessions.get(ownerId);
    if (!session) {
      return interaction.reply({
        content: '⚠️ Session expirée. Retape `!commandes`.',
        ephemeral: true,
      });
    }

    if (dir === 'prev') session.page = Math.max(0, session.page - 1);
    if (dir === 'next') session.page = Math.min(session.totalPages - 1, session.page + 1);

    await interaction.update({
      embeds: [buildEmbed(client, session.rows, session.page, session.totalPages)],
      components: [buildRow(ownerId, session.page, session.totalPages)],
    });
  });
};
