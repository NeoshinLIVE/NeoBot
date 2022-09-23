module.exports.ready = client => require('./client-events/ready')(client);
module.exports.interactionCreate = (client, interaction) => require('./client-events/interaction-create')(client, interaction);
module.exports.guildMemberUpdate = (client, oldMember, newMember) => require('./client-events/guild-member-update')(client, oldMember, newMember);