const cron = require('node-cron');
const playerUpdates = require('./cronjobs/player-updates');
const teamLeaderChecks = require('./cronjobs/team-leader-checks');

module.exports.runCronjobs = client => {
    cron.schedule('0 */1 * * *', () => {
        playerUpdates(client);
    });

    cron.schedule('0 3 */1 * *', () => {
        teamLeaderChecks(client);
    });
};