const Config = require('../database/models/Config');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      const content = message.content.trim();
      const isGeler = content === '!gelerclassement';
      const isDegeler = content === '!degerlerclassement';
      if (!isGeler && !isDegeler) return;
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      let config = await Config.findOne();
      if (!config) config = await Config.create({});

      if (isGeler) {
        if (config.rankFrozen) {
          const frozenAt = config.rankFrozenAt
            ? `<t:${Math.floor(new Date(config.rankFrozenAt).getTime() / 1000)}:R>`
            : 'récemment';
          return message.reply(`⚠️ Le classement est **déjà gelé** (gelé ${frozenAt} par \`${config.rankFrozenBy || 'inconnu'}\`).\nUtilise \`!degerlerclassement\` pour le réactiver.`);
        }
        config.rankFrozen = true;
        config.rankFrozenAt = new Date();
        config.rankFrozenBy = message.author.tag;
        await config.save();
        logStaffAction(client, `❄️ **Classement gelé** | Par : ${message.author.tag}`);
        return message.reply(
          '❄️ Classement **gelé** avec succès.\n' +
          'Les positions sont figées — `!classement` affichera une bannière de gel.\n' +
          'Utilise `!degerlerclassement` pour reprendre les mises à jour.'
        );
      }

      if (isDegeler) {
        if (!config.rankFrozen) return message.reply('⚠️ Le classement n\'est **pas gelé** actuellement.');
        config.rankFrozen = false;
        config.rankFrozenAt = null;
        config.rankFrozenBy = '';
        await config.save();
        logStaffAction(client, `🔥 **Classement dégelé** | Par : ${message.author.tag}`);
        return message.reply('🔥 Classement **dégelé** avec succès. Les mises à jour en temps réel reprennent normalement.');
      }
    } catch (err) {
      console.error('[gelerclassement]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
