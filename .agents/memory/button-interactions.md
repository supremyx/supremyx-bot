---
name: Button interactions cross-command
description: How Discord button/interaction handlers are structured in this bot
---

This bot registers button/select-menu handlers via `client.on('interactionCreate', ...)` inside the same command file that creates the message with components. 

**Pattern:**
```js
module.exports = (client) => {
  client.on('messageCreate', async message => { /* create message with buttons */ });
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('myprefix_')) return;
    // handle
  });
};
```

**Why prefix filtering is critical:** All command files share the same `client` event emitter. Without a unique prefix check, every `interactionCreate` handler fires for every button click. Each handler must bail early if the customId doesn't match.

**Prediction customId format:** `pred_vote_${pred._id}_A` or `pred_vote_${pred._id}_B`
**Draft customId format:** `draft_pick_${draft._id}_${encodeURIComponent(playerName)}`

Use `encodeURIComponent` for player names in customIds to handle spaces/special chars. Decode with `decodeURIComponent` in the handler.
