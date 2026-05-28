const { EventEmitter } = require('events');

const eventBus = new EventEmitter();
eventBus.setMaxListeners(200);

module.exports = eventBus;
