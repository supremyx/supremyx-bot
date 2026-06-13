const { exec } = require('child_process');
const { EmbedBuilder } = require('discord.js');
const https = require('https');

const REPO_DIR  = '/home/runner/workspace';
const REPO_SLUG = 'supremyx/supremyx-bot';

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, timeout: 10000 }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout.trim());
    });
  });
}

function githubGet(path) {
  return new Promise((resolve, reject) => {
    const token = process.env.GITHUB_TOKEN;
    const options = {
      hostname: 'api.github.com',
      path,
      method: 'GET',
      headers: {
        'User-Agent': 'SUPREMYX-Bot',
        'Accept': 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Réponse GitHub invalide')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout GitHub')); });
    req.end();
  });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Module ───────────────────────────────────────────────────────────────────
module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const content = message.content.trim();
    const isJournal   = content.startsWith('!journal');
    const isChangelog  = content.startsWith('!changelog');
    if (!isJournal && !isChangelog) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    // ── !journal — git local ──────────────────────────────────────────────────
    if (isJournal) {
      const args = content.split(' ');
      const n = Math.min(Math.max(parseInt(args[1]) || 10, 1), 25);

      let log;
      try {
        log = await run(
          `git log -${n} --pretty=format:"%h|%an|%ad|%s" --date=format:"%d/%m/%Y %H:%M"`,
          REPO_DIR
        );
      } catch (err) {
        return message.reply(`❌ Impossible de lire l'historique git : \`${String(err).slice(0, 200)}\``);
      }

      if (!log) return message.reply('❌ Aucun commit trouvé.');

      const commits = log.split('\n').map(line => {
        const [hash, author, date, ...rest] = line.split('|');
        return { hash, author, date, subject: rest.join('|') };
      });

      const lines = commits.map(c =>
        `\`${c.hash}\` **${c.subject}**\n> 👤 ${c.author} • 📅 ${c.date}`
      );

      const chunks = [];
      let current = '';
      for (const line of lines) {
        if ((current + '\n\n' + line).length > 3900) { chunks.push(current); current = line; }
        else { current = current ? current + '\n\n' + line : line; }
      }
      if (current) chunks.push(current);

      for (let i = 0; i < chunks.length; i++) {
        const embed = new EmbedBuilder()
          .setTitle(i === 0 ? `📋 Journal — ${n} derniers commits` : `📋 Journal (suite ${i + 1})`)
          .setColor(0x5865F2)
          .setDescription(chunks[i])
          .setFooter({ text: `SUPREMYX • ${REPO_SLUG} • Page ${i + 1}/${chunks.length}` })
          .setTimestamp();
        await message.channel.send({ embeds: [embed] });
      }
      return;
    }

    // ── !changelog — API GitHub ───────────────────────────────────────────────
    const args = content.split(' ');
    const n = Math.min(Math.max(parseInt(args[1]) || 10, 1), 25);

    let commits;
    try {
      commits = await githubGet(`/repos/${REPO_SLUG}/commits?per_page=${n}`);
    } catch (err) {
      return message.reply(`❌ Impossible de contacter GitHub : \`${String(err).slice(0, 200)}\``);
    }

    if (!Array.isArray(commits) || !commits.length) {
      return message.reply('❌ Aucun commit récupéré depuis GitHub.');
    }

    const lines = commits.map((c, i) => {
      const hash    = c.sha?.slice(0, 7) ?? '???????';
      const subject = c.commit?.message?.split('\n')[0] ?? '(sans message)';
      const author  = c.commit?.author?.name ?? c.author?.login ?? 'Inconnu';
      const date    = fmtDate(c.commit?.author?.date);
      const url     = c.html_url ?? `https://github.com/${REPO_SLUG}/commit/${c.sha}`;
      return `[\`${hash}\`](${url}) **${subject}**\n> 👤 ${author} • 📅 ${date}`;
    });

    const chunks = [];
    let current = '';
    for (const line of lines) {
      if ((current + '\n\n' + line).length > 3900) { chunks.push(current); current = line; }
      else { current = current ? current + '\n\n' + line : line; }
    }
    if (current) chunks.push(current);

    for (let i = 0; i < chunks.length; i++) {
      const embed = new EmbedBuilder()
        .setTitle(i === 0 ? `🚀 Changelog — ${n} derniers commits` : `🚀 Changelog (suite ${i + 1})`)
        .setColor(0x2ECC71)
        .setDescription(chunks[i])
        .setURL(`https://github.com/${REPO_SLUG}/commits`)
        .setFooter({ text: `SUPREMYX • github.com/${REPO_SLUG} • Page ${i + 1}/${chunks.length}` })
        .setTimestamp();
      await message.channel.send({ embeds: [embed] });
    }
  });
};
