const { execFile } = require('child_process');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

const REPO_DIR = '/home/runner/workspace';

function getRemote() {
  return `https://x-access-token:${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/supremyx/supremyx-bot.git`;
}

function git(args, cwd = REPO_DIR, timeout = 90000) {
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
    if (message.content.trim() !== '!gitpush') return;
    if (!message.guild) return;
    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const waiting = await message.reply('⏳ Push en cours vers GitHub...');

    try {
      const REMOTE = getRemote();

      const commitHash = await git(['rev-parse', '--short', 'HEAD']).catch(() => '?');
      const commitMsg  = await git(['log', '-1', '--pretty=%s']).catch(() => '?');

      // Step 1: pull remote changes to sync
      let pullNote = '';
      try {
        await waiting.edit('⏳ Synchronisation avec GitHub (pull)...');
        await git(['pull', REMOTE, 'main', '--no-edit']);
        pullNote = '✅ Pull réussi';
      } catch (e) {
        pullNote = `⚠️ Pull ignoré : ${sanitize(e).slice(0, 150)}`;
      }

      // Step 2: push — normal, then force-with-lease fallback
      await waiting.edit('⏳ Push vers GitHub...');
      let pushed = false;
      let pushNote = '';
      let pushErrText = '';

      try {
        await git(['push', REMOTE, 'main']);
        pushed = true;
      } catch (e1) {
        try {
          await git(['push', REMOTE, 'main', '--force-with-lease']);
          pushed = true;
          pushNote = 'force-with-lease utilisé';
        } catch (e2) {
          pushErrText = sanitize(e2).slice(0, 500);
        }
      }

      if (!pushed) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Push GitHub échoué')
          .setColor(0xED4245)
          .addFields(
            { name: '🔄 Pull', value: pullNote || '—' },
            { name: '❌ Erreur push', value: `\`\`\`\n${pushErrText || 'inconnue'}\n\`\`\`` }
          )
          .setFooter({ text: `Par ${message.author.tag}` })
          .setTimestamp();
        return waiting.edit({ content: '', embeds: [embed] });
      }

      // Count commits ahead of remote (after push, should be 0)
      const ahead = await git(['rev-list', 'origin/main..HEAD', '--count']).catch(() => '0');

      const embed = new EmbedBuilder()
        .setTitle('✅ Push GitHub réussi')
        .setColor(0x57F287)
        .addFields(
          { name: '🔖 Commit', value: `\`${commitHash}\``, inline: true },
          { name: '📤 En avance', value: `${ahead} commit(s)`, inline: true },
          { name: '📝 Dernier message', value: commitMsg || '—', inline: false },
          { name: '🔄 Sync', value: pullNote || '—', inline: false },
          { name: '🌿 Branche', value: '`main`', inline: true },
          { name: '🔗 Dépôt', value: '[supremyx/supremyx-bot](https://github.com/supremyx/supremyx-bot)', inline: true }
        )
        .setFooter({ text: `Poussé par ${message.author.tag}${pushNote ? ' • ' + pushNote : ''}` })
        .setTimestamp();

      await waiting.edit({ content: '', embeds: [embed] });
      logStaffAction(client, `📤 **Git push** — \`${commitHash}\` — "${commitMsg}" | Par : ${message.author.tag}`);

    } catch (err) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Push GitHub échoué')
        .setColor(0xED4245)
        .setDescription(`\`\`\`\n${sanitize(err).slice(0, 1000)}\n\`\`\``)
        .setFooter({ text: `Par ${message.author.tag}` })
        .setTimestamp();
      await waiting.edit({ content: '', embeds: [embed] });
    }
  });
};
