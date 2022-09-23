const { EmbedBuilder } = require('discord.js');
const { DISCORD_GUILD_ID } = process.env;
const { Users, Teams } = require('../database');
const { roles, colors } = require('../../config.json');

async function checkTeamLeader(data) {
    if (!data) return;

    const { oldMember, newMember } = data;
    const oCache = oldMember.roles.cache;
    const verified = oldMember.roles.cache.has(roles.verified);
    const oSub = oCache.has(roles.twitch_sub);
    const oBooster = oCache.has(roles.server_booster);
    const nCache = newMember.roles.cache;
    const nSub = nCache.has(roles.twitch_sub);
    const nBooster = nCache.has(roles.server_booster);

    if (!verified || (!oSub && !oBooster) || nSub || nBooster) return;

    const user = await Users.findOne({ where: { id: newMember.id } });

    if (!user.team_id) return;

    const team = await Teams.findOne({ where: { id: user.team_id } });

    if (!team || team.type === 'TEMP' || team.leader_id !== user.id) return;

    data.user = user;
    data.team = team;
    data.subRole = oCache.get(roles.twitch_sub);
    data.boostRole = oCache.get(roles.server_booster);

    if (oSub) data.role = data.subRole;
    if (oBooster) data.role = data.boostRole;

    return data;
}

async function updateTeam(data) {
    if (!data) return;

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    await Teams.update({ expires: expires }, { where: { id: data.team.id } });

    data.team.expires = expires;

    return data;
}

async function sendMessage(data) {
    if (!data) return;

    const { client, team, role, user, subRole, boostRole } = data;
    const now = new Date();
    const days = Math.ceil(team.expires.getTime() - now.getTime() / (1000 * 3600 * 24));
    const guild = client.guilds.cache.get(DISCORD_GUILD_ID);
    const channel = guild.channels.cache.get(team.text_id);
    const embeds = [new EmbedBuilder()
        .setColor(colors.warning)
        .setTitle(':pensive: Teamschließung')
        .setDescription(
            `Da leider der Teamleader <@${user}> kein <@${role}> mehr ist, verliert das Team seinen **Premium Status** und wird in **${days}** geschlossen.\n
            Der Teamleader kann dies verhindern, wenn dieser in den ${days} Tagen <@${subRole}> oder <@${boostRole}> wird, natürlich kann der Teamleader auch gewechselt werden.\n
            Wenn das Team geschlossen wird, kann es nicht mehr genutzt werden. Die Channel bleiben noch weitere 7 Tage erhalten, bevor diese endgültig gelöscht werden.\n`)];

    await channel.send({ embeds: embeds });
}

module.exports = async function(client, oldMember, newMember) {
    checkTeamLeader({ client, oldMember, newMember })
        .then(data => updateTeam(data))
        .then(data => sendMessage(data))
        .catch(err => console.log(err));
};