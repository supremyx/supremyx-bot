const { exec } = require('child_process');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

const REPO_DIR = '/home/runner/workspace';
const REMOTE = `https://x-access-token:${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/supremyx/supremyx-bot.git`;

function run(cmd, cwd, timeout = 90000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, timeout }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve((stdout + stderr).trim());
    });
  });
}

function sanitize(str) {
  return String(str).replace(/https:\/\/[^@]+@/g, 'https://***@');
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content.trim() !== '!gitpush') return;
    if (!message.guild) return;
    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const waiting = await message.reply('⏳ Push en cours vers GitHub...');

    try {
      const commitHash = await run('git rev-parse --short HEAD', REPO_DIR).catch(() => '?');
      const commitMsg  = await run('git log -1 --pretty=%s', REPO_DIR).catch(() => '?');

      // Step 1: pull remote changes to sync (90s timeout)
      let pullNote = '';
      try {
        await waiting.edit('⏳ Synchronisation avec le remote (pull)...');
        await run(`git pull ${REMOTE} main --no-edit`, REPO_DIR);
        pullNote = '✅ Pull réussi';
      } catch (pullErr) {
        pullNote = `⚠️ Pull ignoré : ${sanitize(pullErr).slice(0, 200)}`;
      }

      // Step 2: push (with --force-with-lease as fallback)
      await waiting.edit('⏳ Push vers GitHub...');
      let pushed = false;
      let pushErr = '';

      try {
        await run(`git push ${REMOTE} main`, REPO_DIR);
        pushed = true;
      } catch (e1) {
        try {
          await run(`git push ${REMOTE} main --force-with-lease`, REPO_DIR);
          pushed = true;
          pushErr = '(force-with-lease utilisé)';
        } catch (e2) {
          pushErr = sanitize(e2).slice(0, 400);
        }
      }

      if (!pushed) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Push GitHub échoué')
          .setColor(0xED4245)
          .addFields(
            { name: '🔄 Pull', value: pullNote },
            { name: '❌ Push erreur', value: `\`\`\`\n${pushErr}\n\`\`\`` }
          )
          .setFooter({ text: `Par ${message.author.tag}` })
          .setTimestamp();
        return waiting.edit({ content: '', embeds: [embed] });
      }

      const ahead = await run('git rev-list @{u}..HEAD --count', REPO_DIR).catch(() => '?');

      const embed = new EmbedBuilder()
        .setTitle('✅ Push GitHub réussi')
        .setColor(0x57F287)
        .addFields(
          { name: '🔖 Commit', value: `\`${commitHash}\``, inline: true },
          { name: '📤 Commits poussés', value: `${ahead}`, inline: true },
          { name: '📝 Dernier message', value: commitMsg || '—', inline: false },
          { name: '🔄 Sync', value: pullNote, inline: false },
          { name: '🌿 Branche', value: '`main`', inline: true },
          { name: '🔗 Dépôt', value: '[supremyx/supremyx-bot](https://github.com/supremyx/supremyx-bot)', inline: true }
        )
        .setFooter({ text: `Poussé par ${message.author.tag}${pushErr ? ' • ' + pushErr : ''}` })
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
