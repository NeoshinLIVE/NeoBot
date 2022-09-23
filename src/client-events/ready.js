const { ActivityType } = require('discord-api-types/v10');
const { syncTables } = require('../database');
const { runCronjobs } = require('../cronjobs');

module.exports = async function(client) {
    syncTables();
    runCronjobs(client);

    client.user.setActivity({ name: 'Neobot 0.8 [BETA]', type: ActivityType.Watching });
    console.log(`Logged in as ${client.user.tag}!`);
};