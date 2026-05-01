const Team = require('../database/models/Team');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content === '!ranking') {

      let teams = await Team.find().sort({ points: -1 });

      if (!teams.length) return message.channel.send('Aucune équipe enregistrée.');

      let text = teams.map((t,i)=>
        `#${i+1} ${t.name} - ${t.points} pts`
      ).join('\n');

      message.channel.send(text);
    }
  });
};
