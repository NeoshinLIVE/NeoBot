const { EmbedBuilder } = require('discord.js');
const { DISCORD_GUILD_ID } = process.env;
const { Teams, TeamInvites } = require('../../../database');
const { colors, invite_url } = require('../../../../config.json');


async function getInvite(data) {
    if (!data || !data.inviteId) return;

    const { inviteId } = data;

    data.invite = await TeamInvites.findOne({ where: { id: inviteId } }).catch(() => { return false; });

    return data;
}

async function getTeam(data) {
    if (!data || !data.invite) return;

    const { team_id } = data.invite;

    data.team = await Teams.findOne({ where: { id: team_id } }).catch(() => { return false; });

    return data;
}

async function sendDenyMessage(data) {
    if (!data || !data.interaction || !data.invite || !data.team) return;

    const { interaction, invite, team } = data;
    const { users } = interaction.client;

    const inviter = await users.fetch(invite.inviter_uid);
    const dm = await inviter.createDM();
    const embeds = [new EmbedBuilder()
        .setColor(colors.danger)
        .setTitle(':x: Einladung abgelehnt')
        .setDescription(`<@${interaction.user.id}> hat die Einladung zum Team **${team.name}** abgelehnt.`)];

    await dm.send({ embeds: embeds });

    return data;
}

async function updateInviteMessage(data) {
    if (!data || !data.interaction || !data.invite || !data.team) return;

    const { interaction, team } = data;
    const { guilds } = interaction.client;
    const guild = guilds.cache.get(DISCORD_GUILD_ID);
    const guildIcon = await guild.iconURL({ dynamic: true });

    const embeds = [new EmbedBuilder()
        .setColor(colors.danger)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(':no_entry_sign: Teameinladung blockiert')
        .setDescription(`Du hast das Team **${team.name}** blockiert und erhälst von denen keine Einladungen mehr.`)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon })];

    await interaction.update({ embeds: embeds, components: [] });
}

async function updateTeamInvites(inviteId) {
    await TeamInvites.update({ blocked: 1 }, { where: { id: inviteId } });
}

module.exports = {
    data: {
        customId: 'teamInviteBlock',
    },
    async execute(interaction) {
        const inviteId = interaction.customIdData;

        getInvite({ interaction, inviteId })
            .then(data => getTeam(data))
            .then(data => sendDenyMessage(data))
            .then(data => updateInviteMessage(data))
            .then(() => updateTeamInvites(inviteId))
            .catch(async error => {
                console.log(error);
                await interaction.reply(':no_entry: Es gab ein Problem beim blockieren der Teameinladung. Bitte wende dich an einen Admin.');
                return;
            });
    },
};