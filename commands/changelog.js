const { exec } = require('child_process');
const { EmbedBuilder } = require('discord.js');

const REPO_DIR = '/home/runner/workspace';

function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, timeout: 10000 }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout.trim());
    });
  });
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!changelog')) return;
    if (!message.guild) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const args = content.split(' ');
    const n = Math.min(Math.max(parseInt(args[1]) || 10, 1), 25);

    let log;
    try {
      // Format: hash | author | date | subject
      log = await run(
        `git log -${n} --pretty=format:"%h|%an|%ad|%s" --date=format:"%d/%m/%Y %H:%M"`,
        REPO_DIR
      );
    } catch (err) {
      return message.reply(`❌ Impossible de lire l'historique git : \`${String(err).slice(0, 200)}\``);
    }

    if (!log) return message.reply('❌ Aucun commit trouvé.');

    const commits = log.split('\n').map(line => {
      const [hash, author, date, ...subjectParts] = line.split('|');
      return { hash, author, date, subject: subjectParts.join('|') };
    });

    const lines = commits.map((c, i) =>
      `\`${c.hash}\` **${c.subject}**\n> 👤 ${c.author} • 📅 ${c.date}`
    );

    // Split into chunks of 4096 chars max per embed description
    const chunks = [];
    let current = '';
    for (const line of lines) {
      if ((current + '\n\n' + line).length > 3900) {
        chunks.push(current);
        current = line;
      } else {
        current = current ? current + '\n\n' + line : line;
      }
    }
    if (current) chunks.push(current);

    for (let i = 0; i < chunks.length; i++) {
      const embed = new EmbedBuilder()
        .setTitle(i === 0 ? `📋 Changelog — ${n} derniers commits` : `📋 Changelog (suite ${i + 1})`)
        .setColor(0x5865F2)
        .setDescription(chunks[i])
        .setFooter({ text: `SUPREMYX • hulksilver1-eng/moseto-bot • Page ${i + 1}/${chunks.length}` })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
    }
  });
};
