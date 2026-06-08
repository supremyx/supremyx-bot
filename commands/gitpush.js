const { exec } = require('child_process');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

const REPO_DIR = '/home/runner/workspace';
const REMOTE = `https://x-access-token:${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/supremyx/supremyx-bot.git`;

function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve((stdout + stderr).trim());
    });
  });
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content.trim() !== '!gitpush') return;
    if (!message.guild) return;
    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const waiting = await message.reply('⏳ Push en cours vers GitHub...');

    try {
      // Get current commit info
      const commitHash = await run('git rev-parse --short HEAD', REPO_DIR).catch(() => '?');
      const commitMsg  = await run('git log -1 --pretty=%s', REPO_DIR).catch(() => '?');
      const ahead      = await run('git rev-list @{u}..HEAD --count', REPO_DIR).catch(() => '?');

      // Pull remote changes first (authenticated URL) to avoid "fetch first" rejection
      await run(`git pull ${REMOTE} main --no-edit`, REPO_DIR);

      // Push
      await run(`git push ${REMOTE} main`, REPO_DIR);

      const embed = new EmbedBuilder()
        .setTitle('✅ Push GitHub réussi')
        .setColor(0x57F287)
        .addFields(
          { name: '🔖 Commit', value: `\`${commitHash}\``, inline: true },
          { name: '📤 Commits poussés', value: `${ahead}`, inline: true },
          { name: '📝 Dernier message', value: commitMsg || '—', inline: false },
          { name: '🌿 Branche', value: '`main`', inline: true },
          { name: '🔗 Dépôt', value: '[supremyx/supremyx-bot](https://github.com/supremyx/supremyx-bot)', inline: true }
        )
        .setFooter({ text: `Poussé par ${message.author.tag}` })
        .setTimestamp();

      await waiting.edit({ content: '', embeds: [embed] });

      logStaffAction(client, `📤 **Git push** — \`${commitHash}\` — "${commitMsg}" | ${ahead} commit(s) | Par : ${message.author.tag}`);

    } catch (err) {
      // Sanitize token from error output before showing it
      const safe = String(err).replace(/https:\/\/[^@]+@/g, 'https://***@');
      const embed = new EmbedBuilder()
        .setTitle('❌ Push GitHub échoué')
        .setColor(0xED4245)
        .setDescription(`\`\`\`\n${safe.slice(0, 1000)}\n\`\`\``)
        .setFooter({ text: `Par ${message.author.tag}` })
        .setTimestamp();
      await waiting.edit({ content: '', embeds: [embed] });
    }
  });
};
