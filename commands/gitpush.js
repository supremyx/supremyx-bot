const { execFile } = require('child_process');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

const REPO_DIR = process.env.REPO_DIR || process.cwd();

function getRemote() {
  return `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/supremyx/supremyx-bot.git`;
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
    if (message.content.trim() !== '!envoyergit') return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const waiting = await message.reply('⏳ Push en cours vers GitHub...');

    try {
      const REMOTE = getRemote();

      const commitHash = await git(['rev-parse', '--short', 'HEAD']).catch(() => '?');
      const commitMsg  = await git(['log', '-1', '--pretty=%s']).catch(() => '?');

      // Step 1: fetch remote into proper tracking ref (updates origin/main)
      let syncNote = '';
      try {
        await waiting.edit('⏳ Fetch du remote...');
        await git(['fetch', REMOTE, 'main:refs/remotes/origin/main']);
        // Merge fetched changes (inline identity so merge commits always work)
        await git(['-c', 'user.name=SUPREMYX Bot', '-c', 'user.email=bot@supremyx.gg',
          'merge', 'origin/main', '--no-edit', '--allow-unrelated-histories']);
        syncNote = '✅ Sync réussi (fetch + merge)';
      } catch (e) {
        syncNote = `⚠️ Sync ignoré : ${sanitize(e).slice(0, 150)}`;
      }

      // Step 2: push — normal first, then --force fallback
      await waiting.edit('⏳ Push vers GitHub...');
      let pushed = false;
      let pushNote = '';
      let pushErrText = '';

      try {
        await git(['push', REMOTE, 'main']);
        pushed = true;
      } catch (e1) {
        // Force push as last resort (we own the repo, local is authoritative)
        try {
          await git(['push', REMOTE, 'main', '--force']);
          pushed = true;
          pushNote = '⚠️ Force push utilisé';
        } catch (e2) {
          pushErrText = sanitize(e2).slice(0, 500);
        }
      }

      if (!pushed) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Push GitHub échoué')
          .setColor(0xED4245)
          .addFields(
            { name: '🔄 Sync', value: syncNote || '—' },
            { name: '❌ Erreur push', value: `\`\`\`\n${pushErrText || 'inconnue'}\n\`\`\`` }
          )
          .setFooter({ text: `Par ${message.author.tag}` })
          .setTimestamp();
        return waiting.edit({ content: '', embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Push GitHub réussi')
        .setColor(0x57F287)
        .addFields(
          { name: '🔖 Commit', value: `\`${commitHash}\``, inline: true },
          { name: '📝 Dernier message', value: commitMsg || '—', inline: false },
          { name: '🔄 Sync', value: syncNote || '—', inline: false },
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
