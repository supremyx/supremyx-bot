const Sanction = require('../database/models/Sanction');
const EscaladeConfig = require('../database/models/EscaladeConfig');
const Warning = require('../database/models/Warning');
const { EmbedBuilder } = require('discord.js');
const { addSanction, getSanctions, buildSanctionEmbed, DEFAULT_RULES, ACTION_LABELS } = require('../utils/sanctionManager');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    if (!message.guild) return;
    const isStaff = message.member?.permissions.has('Administrator');

    // =========================================================
    // !sanctions [@user]
    // =========================================================
    if (cmd === '!sanctions') {
      const target = message.mentions.members.first();
      if (!target) return message.reply('Usage : `!sanctions @user`');

      const sanctions = await getSanctions(message.guild.id, target.user.id);

      if (!sanctions.length) {
        return message.reply(`✅ **${target.user.tag}** n'a aucune sanction enregistrée.`);
      }

      const embed = buildSanctionEmbed(target.user, sanctions, message.guild);
      return message.channel.send({ embeds: [embed] });
    }

    // =========================================================
    // !punition @user <warn|mute|kick|ban> [durée_min] | <raison>
    // =========================================================
    if (cmd === '!punition') {
      if (!isStaff) return message.reply('Staff uniquement');

      const target = message.mentions.members.first();
      if (!target) return message.reply(
        '**Usage :** `!punition @user <type> [durée_min] | <raison>`\n' +
        '**Types :** `warn`, `mute`, `kick`, `ban`\n\n' +
        '**Exemples :**\n' +
        '`!punition @user warn | Langage inapproprié`\n' +
        '`!punition @user mute 30 | Spam`\n' +
        '`!punition @user kick | Non-respect des règles`\n' +
        '`!punition @user ban | Triche avérée`'
      );

      if (target.id === message.author.id) return message.reply('❌ Tu ne peux pas te sanctionner toi-même.');
      if (target.permissions.has('Administrator')) return message.reply('❌ Impossible de sanctionner un administrateur.');

      const rawRest = args.slice(2).join(' ');
      const pipeIdx = rawRest.indexOf('|');
      const beforePipe = (pipeIdx === -1 ? rawRest : rawRest.slice(0, pipeIdx)).trim();
      const afterPipe  = (pipeIdx === -1 ? ''      : rawRest.slice(pipeIdx + 1)).trim();
      const tokens = beforePipe.split(' ');
      const type = tokens[0]?.toLowerCase();
      const durationArg = parseInt(tokens[1]);
      const duration = !isNaN(durationArg) && durationArg > 0 ? durationArg : null;
      const reason = afterPipe || 'Aucune raison précisée';

      if (!['warn', 'mute', 'kick', 'ban'].includes(type)) {
        return message.reply('❌ Type invalide. Utilise : `warn`, `mute`, `kick`, `ban`');
      }
      if (type === 'mute' && !duration) {
        return message.reply('❌ Durée requise pour un mute. Ex : `!punition @user mute 30 | Raison`');
      }

      // Apply Discord action
      if (type === 'mute') {
        if (duration > 40320) return message.reply('❌ Durée maximum : 40320 minutes (28 jours).');
        await target.timeout(duration * 60 * 1000, reason).catch(() => {});
      } else if (type === 'kick') {
        await target.kick(reason).catch(() => {});
      } else if (type === 'ban') {
        await message.guild.members.ban(target.id, { reason }).catch(() => {});
      }

      // Save sanction
      const { sanction, escalation } = await addSanction(client, message.guild, {
        userId: target.user.id,
        userTag: target.user.tag,
        type,
        reason,
        duration,
        moderatorId: message.author.id,
        moderatorTag: message.author.tag
      });

      // DM the target
      const durationStr = duration ? ` pendant **${duration} min**` : '';
      target.user.createDM()
        .then(dm => dm.send(
          `${ACTION_LABELS[type]} reçu sur **${message.guild.name}**${durationStr}.\n` +
          `📝 Raison : ${reason}`
        ))
        .catch(() => {});

      const embed = new EmbedBuilder()
        .setTitle(`${ACTION_LABELS[type]} appliqué`)
        .setColor(type === 'warn' ? 0xFEE75C : type === 'mute' ? 0xE67E22 : 0xED4245)
        .addFields(
          { name: '👤 Membre', value: `${target.user.tag}`, inline: true },
          { name: '📝 Raison', value: reason, inline: true }
        )
        .setThumbnail(target.user.displayAvatarURL())
        .setFooter({ text: `Par ${message.author.tag}` })
        .setTimestamp();

      if (duration) embed.addFields({ name: '⏱️ Durée', value: `${duration} min`, inline: true });

      // Show escalation info if triggered
      if (escalation) {
        const warnCount = escalation.warnCount;
        const autoAction = ACTION_LABELS[escalation.rule.action];
        const autoDur = escalation.rule.duration ? ` (${escalation.rule.duration} min)` : '';
        embed.addFields({
          name: '🤖 Auto-escalade déclenchée',
          value: `**${warnCount} warns** atteints → **${autoAction}${autoDur}** appliqué automatiquement`
        });
        embed.setColor(0xED4245);
      }

      logStaffAction(client,
        `${ACTION_LABELS[type]} **${type.toUpperCase()}** — \`${target.user.tag}\`${duration ? ` (${duration}min)` : ''} | Raison : ${reason} | Par : ${message.author.tag}`
      );

      return message.channel.send({ embeds: [embed] });
    }

    // =========================================================
    // !clearactions @user — clear all sanctions (staff)
    // =========================================================
    if (cmd === '!clearactions') {
      if (!isStaff) return message.reply('Staff uniquement');
      const target = message.mentions.users.first();
      if (!target) return message.reply('Usage : `!clearactions @user`');

      const result = await Sanction.deleteMany({ guildId: message.guild.id, userId: target.id });
      logStaffAction(client, `🗑️ **Sanctions effacées** — \`${target.tag}\` (${result.deletedCount}) | Par : ${message.author.tag}`);
      return message.reply(`✅ **${result.deletedCount}** sanction(s) supprimée(s) pour **${target.tag}**.`);
    }

    // =========================================================
    // !escalade — view / configure escalation rules
    // =========================================================
    if (cmd === '!escalade') {
      if (!isStaff) return message.reply('Staff uniquement');
      const sub = args[1]?.toLowerCase();

      let config = await EscaladeConfig.findOne({ guildId: message.guild.id });

      // --- !escalade (view) ---
      if (!sub) {
        const rules = config?.rules?.length ? config.rules : DEFAULT_RULES;
        const enabled = config?.enabled !== false;

        const embed = new EmbedBuilder()
          .setTitle('🤖 Auto-escalade des sanctions')
          .setColor(enabled ? 0x57F287 : 0xED4245)
          .addFields({ name: '🔘 Statut', value: enabled ? '✅ Activée' : '⛔ Désactivée' })
          .setDescription(
            rules
              .sort((a, b) => a.warnCount - b.warnCount)
              .map(r => {
                const dur = r.duration ? ` (${r.duration} min)` : '';
                return `• **${r.warnCount} warns** → ${ACTION_LABELS[r.action]}${dur}`;
              }).join('\n') || '*Aucune règle configurée*'
          )
          .setFooter({ text: 'Configure avec !escalade set <warns> <action> [durée_min]' })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // --- !escalade on/off ---
      if (sub === 'on' || sub === 'off') {
        config = config || await EscaladeConfig.create({ guildId: message.guild.id, rules: DEFAULT_RULES });
        config.enabled = sub === 'on';
        await config.save();
        logStaffAction(client, `🤖 **Auto-escalade ${sub === 'on' ? 'activée' : 'désactivée'}** | Par : ${message.author.tag}`);
        return message.reply(`${sub === 'on' ? '✅ Auto-escalade **activée**.' : '⛔ Auto-escalade **désactivée**.'}`);
      }

      // --- !escalade set <warns> <action> [durée_min] ---
      if (sub === 'set') {
        const warnCount = parseInt(args[2]);
        const action = args[3]?.toLowerCase();
        const duration = parseInt(args[4]) || null;

        if (isNaN(warnCount) || warnCount < 1) return message.reply('Usage : `!escalade set <warns> <action> [durée_min]`');
        if (!['mute', 'kick', 'ban'].includes(action)) return message.reply('❌ Action invalide : `mute`, `kick`, `ban`');
        if (action === 'mute' && !duration) return message.reply('❌ Durée requise pour mute. Ex : `!escalade set 3 mute 60`');

        config = config || await EscaladeConfig.create({ guildId: message.guild.id, rules: [] });

        // Remove existing rule for this warn count, then add new
        config.rules = config.rules.filter(r => r.warnCount !== warnCount);
        config.rules.push({ warnCount, action, duration });
        config.rules.sort((a, b) => a.warnCount - b.warnCount);
        await config.save();

        const durStr = duration ? ` — ${duration} min` : '';
        logStaffAction(client, `🤖 **Escalade** — ${warnCount} warns → ${action}${durStr} | Par : ${message.author.tag}`);
        return message.reply(`✅ Règle configurée : **${warnCount} warns** → **${ACTION_LABELS[action]}${durStr}**`);
      }

      // --- !escalade del <warns> ---
      if (sub === 'del' || sub === 'delete') {
        const warnCount = parseInt(args[2]);
        if (!config || isNaN(warnCount)) return message.reply('Usage : `!escalade del <warns>`');
        config.rules = config.rules.filter(r => r.warnCount !== warnCount);
        await config.save();
        logStaffAction(client, `🗑️ **Escalade** règle supprimée : ${warnCount} warns | Par : ${message.author.tag}`);
        return message.reply(`✅ Règle **${warnCount} warns** supprimée.`);
      }

      // --- !escalade reset ---
      if (sub === 'reset') {
        if (config) {
          config.rules = DEFAULT_RULES;
          config.enabled = true;
          await config.save();
        } else {
          await EscaladeConfig.create({ guildId: message.guild.id, rules: DEFAULT_RULES, enabled: true });
        }
        logStaffAction(client, `🔄 **Escalade réinitialisée** aux valeurs par défaut | Par : ${message.author.tag}`);
        return message.reply('✅ Escalade réinitialisée :\n• **3 warns** → Mute 1h\n• **5 warns** → Mute 24h\n• **7 warns** → Ban');
      }

      return message.reply(
        '**Commandes `!escalade` :**\n' +
        '`!escalade` — Voir les règles actuelles\n' +
        '`!escalade on / off` — Activer / désactiver\n' +
        '`!escalade set <warns> <action> [durée_min]` — Configurer une règle\n' +
        '`!escalade del <warns>` — Supprimer une règle\n' +
        '`!escalade reset` — Réinitialiser aux valeurs par défaut'
      );
    }
  });
};
