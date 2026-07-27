const { execFile } = require('child_process');
const { EmbedBuilder } = require('discord.js');

const REPO_DIR = process.env.REPO_DIR || process.cwd();

function git(args, cwd = REPO_DIR, timeout = 15000) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, timeout }, (err, stdout, stderr) => {
      if (err) return reject((stderr || stdout || err.message || '').trim());
      resolve((stdout + stderr).trim());
    });
  });
}

function sanitize(str) {
  return String(str).replace(/x-access-token:[^@]+@/g, 'x-access-token:***@');
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content.trim() !== '!statutgit') return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const waiting = await message.reply('⏳ Récupération du statut git...');

    try {
      const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => '?');
      const commitHash = await git(['rev-parse', '--short', 'HEAD']).catch(() => '?');
      const commitMsg = await git(['log', '-1', '--pretty=%s']).catch(() => '?');
      const commitAuthor = await git(['log', '-1', '--pretty=%an']).catch(() => '?');
      const commitDate = await git(['log', '-1', '--pretty=%ar']).catch(() => '?');

      const statusRaw = await git(['status', '--short']).catch(() => '');

      let statusDisplay = '';
      if (!statusRaw) {
        statusDisplay = '*Rien à signaler — répertoire de travail propre*';
      } else {
        const lines = sanitize(statusRaw).split('\n').slice(0, 30);
        statusDisplay = `\`\`\`\n${lines.join('\n')}\n\`\`\``;
        if (sanitize(statusRaw).split('\n').length > 30) {
          statusDisplay += `\n*... et ${sanitize(statusRaw).split('\n').length - 30} fichier(s) de plus*`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('🔍 Statut Git')
        .setColor(0x5865F2)
        .addFields(
          { name: '🌿 Branche', value: `\`${sanitize(branch)}\``, inline: true },
          { name: '🔖 Dernier commit', value: `\`${sanitize(commitHash)}\``, inline: true },
          { name: '🕒 Il y a', value: sanitize(commitDate), inline: true },
          { name: '📝 Message du commit', value: sanitize(commitMsg) || '—', inline: false },
          { name: '👤 Auteur', value: sanitize(commitAuthor) || '—', inline: false },
          { name: '📂 Fichiers modifiés / en attente', value: statusDisplay, inline: false }
        )
        .setFooter({ text: `Demandé par ${message.author.tag}` })
        .setTimestamp();

      await waiting.edit({ content: '', embeds: [embed] });

    } catch (err) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Erreur Git Status')
        .setColor(0xED4245)
        .setDescription(`\`\`\`\n${sanitize(err).slice(0, 1000)}\n\`\`\``)
        .setFooter({ text: `Par ${message.author.tag}` })
        .setTimestamp();
      await waiting.edit({ content: '', embeds: [embed] });
    }
  });
};
