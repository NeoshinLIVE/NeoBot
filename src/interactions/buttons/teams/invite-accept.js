const { EmbedBuilder } = require('discord.js');
const { DISCORD_GUILD_ID } = process.env;
const { Users, Teams, TeamInvites } = require('../../../database');
const { colors, max_team_size, invite_url } = require('../../../../config.json');

async function getInvite(data) {
    if (!data || !data.inviteId) return;

    const { inviteId } = data;

    data.invite = await TeamInvites.findOne({ where: { id: inviteId } }).catch(() => { return false; });

    return data;
}

async function getTeam(data) {
    if (!data || !data.interaction || !data.invite) return;

    const { interaction } = data;
    const { team_id } = data.invite;
    const team = await Teams.findOne({ where: { id: team_id } }).catch(() => { return false; });

    if (!team || team.status === 'CLOSED') {
        const embeds = [new EmbedBuilder()
            .setColor(colors.danger)
            .setTitle(':no_entry: Beitritt fehlgeschlagen')
            .setDescription('Beitritt nicht möglich, da dass Team bereits nicht mehr existiert.')];

        await interaction.editReply({ embeds: embeds });
        return;
    }

    const member = team.members ? JSON.parse(team.members) : [];
    const num = member.length + 1;

    if (num >= max_team_size) {
        const embeds = [new EmbedBuilder()
            .setColor(colors.danger)
            .setTitle(':no_entry: Beitritt fehlgeschlagen')
            .setDescription('Beitritt nicht möglich, da dass Team bereits voll ist.')];

        await interaction.editReply({ embeds: embeds });
        return;
    }

    data.team = team;

    return data;
}

async function updateUser(data) {
    if (!data || !data.invite) return;

    const { uid, team_id } = data.invite;

    await Users.update({ team_id: team_id }, { where: { id: uid } });

    return data;
}

async function updateChannelPermissions(data) {
    if (!data || !data.interaction || !data.team) return;

    const { interaction, team } = data;
    const { client: { guilds }, user } = interaction;
    const guild = guilds.cache.get(DISCORD_GUILD_ID);
    const textChannel = guild.channels.cache.get(team.text_id);
    const voiceChannel = guild.channels.cache.get(team.voice_id);

    data.textChannel = await textChannel.permissionOverwrites.create(user, {
        'ViewChannel': true,
        'ManageMessages': false,
        'CreatePublicThreads': false,
    });

    await voiceChannel.permissionOverwrites.create(user, {
        'ViewChannel': true,
        'Connect': true,
        'MuteMembers': false,
        'DeafenMembers': false,
        'ManageMessages': false,
    });

    return data;
}

async function updateTeam(data) {
    if (!data || !data.invite || !data.team) return;

    data.team.members = data.team.members ? JSON.parse(data.team.members) : [];

    const { id, members } = data.team;
    const { uid } = data.invite;

    members.push(uid);
    await Teams.update({ members: JSON.stringify(members) }, { where: { id: id } });

    return data;
}

async function sendJoinMessage(data) {
    if (!data || !data.interaction || !data.team || !data.textChannel) return;

    const { interaction, team, textChannel } = data;
    const embeds = [new EmbedBuilder()
        .setColor(colors.success)
        .setTitle(':v: Neuer Member')
        .setDescription(`Herzlich Willkommen im Team **${team.name}** <@${interaction.user.id}>!`)];

    await textChannel.send({ embeds: embeds });

    return data;
}

async function updateInviteMessage(data) {
    if (!data || !data.interaction || !data.team || !data.textChannel) return;

    const { interaction, team, textChannel: { guild } } = data;
    const guildIcon = await guild.iconURL({ dynamic: true });
    const embeds = [new EmbedBuilder()
        .setColor(colors.success)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(':white_check_mark: Teameinladung angenommen')
        .setDescription(`Du hast die Einladung angenommen und bist dem Team **${team.name}** beigetreten.`)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon })];

    await interaction.update({ embeds: embeds, components: [] });
}

async function updateTeamInvitesDb(inviteId) {
    await TeamInvites.destroy({ where: { id: inviteId } });
}

module.exports = {
    data: {
        customId: 'teamInviteAccept',
    },
    async execute(interaction) {
        const inviteId = interaction.customIdData;

        getInvite({ interaction, inviteId })
            .then(data => getTeam(data))
            .then(data => updateUser(data))
            .then(data => updateChannelPermissions(data))
            .then(data => updateTeam(data))
            .then(data => sendJoinMessage(data))
            .then(data => updateInviteMessage(data))
            .then(() => updateTeamInvitesDb(inviteId))
            .catch(async error => {
                console.log(error);
                await interaction.reply(':no_entry: Es gab ein Problem beim akzeptieren der Teameinladung. Bitte wende dich an einen Admin.');
                return;
            });
    },
};