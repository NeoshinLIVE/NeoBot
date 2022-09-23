const { PermissionFlagsBits } = require('discord.js');
const { ChannelType } = require('discord-api-types/v10');
const { inlineCode } = require('@discordjs/builders');
const { Users, Teams } = require('../../database');
const {
    channel: { teams_category },
    roles: { server_booster, twitch_sub },
} = require('../../../config.json');

async function checkUser(data) {
    if (!data || !data.interaction) return;

    data.user = await Users.findOne({ where: { id: data.interaction.user.id } }).catch(() => { return false; });

    if (!data.user) {
        await data.interaction.editReply(`:no_entry: Du musst deinen Apex Legends Account verifizieren, um ein Team erstellen zu können.\nDu kannst mit dem Befehl ${inlineCode('/player verify')} deinen Apex Legends Account verifizieren.`);
        return;
    }

    if (data.user.team_id) {
        await data.interaction.editReply(':no_entry: Du bist bereits in einem Team. Du kannst nur ein Team erstellen, wenn du selbst in keinem bist.');
        return;
    }

    return data;
}

async function prepareTeamData(data) {
    if (!data || !data.interaction) return;

    const { guild, member, options } = data.interaction;
    const name = options.getString('name');
    const description = options.getString('description');
    const logo = options.getAttachment('logo');
    const serverBoosterRole = guild.roles.cache.get(server_booster);
    const twitchSubRole = guild.roles.cache.get(twitch_sub);
    const isServerBooster = await member.roles.cache.get(serverBoosterRole.id);
    const isTwitchSub = await member.roles.cache.get(twitchSubRole.id);

    if (!isServerBooster && !isTwitchSub) {
        await data.interaction.editReply(`:no_entry: Um ein Premium Team zu erstellen musst du entweder ${twitchSubRole} oder ${serverBoosterRole} sein.\nUm ein Team für ein Event zu erstellen, nutze bitte den **"Team erstellen"** Button unter dem Event.`);
        return;
    }

    if (name.length < 4) {
        await data.interaction.editReply(':no_entry: Der Teamname muss mindestens 4 Zeichen lang sein.');
        return;
    }

    const isNameTaken = await Teams.findOne({ where: { name: name } }).catch(() => { return false; });

    if (isNameTaken) {
        await data.interaction.editReply(':no_entry: Der gewählte Teamname is schon vergeben. Bitte wähle einen anderen.');
        return;
    }

    data.teamData = {
        type: 'PERM',
        name: name,
        description: description ? description : '',
        logo_url: logo ? logo.url : '',
        leader_id: member.id,
    };

    return data;
}

async function createTeam(data) {
    if (!data || !data.teamData) return;

    data.team = await Teams.create(data.teamData);

    return data;
}

async function updateUser(data) {
    if (!data || !data.team) return;

    return await Users.update({ team_id: data.team.id }, { where: { id: data.team.leader_id } }).then(() => { return data; });
}

async function createTeamChannel(data) {
    if (!data || !data.interaction || !data.team) return;

    const { team, interaction: { member, guild: { id, channels } } } = data;

    const textChannel = await channels.create({
        name: team.name,
        type: ChannelType.GuildText,
        parent: teams_category,
        topic: team.description,
        permissionOverwrites: [
            {
                id: id,
                deny: PermissionFlagsBits.ViewChannel,
            },
            {
                id: member.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.CreatePublicThreads],
            },
        ] });

    const voiceChannel = await channels.create({
        name: team.name,
        type: ChannelType.GuildVoice,
        parent: teams_category,
        permissionOverwrites: [
            {
                id: id,
                deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
            },
            {
                id: member.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.ManageMessages],
            },
        ] });

    data.textChannel = textChannel;
    return await Teams.update({ text_id: textChannel.id, voice_id: voiceChannel.id }, { where: { id: team.id } }).then(() => { return data; });
}

async function sendCreationMessage(data) {
    if (!data || !data.interaction || !data.textChannel) return;

    await data.interaction.editReply(`:white_check_mark: Das Team **${data.team.name}** wurde erfolgreich erstellt. Du kannst nun in <#${data.textChannel.id}> mit dem ${inlineCode('/team member-invite')} Befehl neue Team Mitglieder einladen.`);
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    checkUser({ interaction })
        .then(data => prepareTeamData(data))
        .then(data => createTeam(data))
        .then(data => updateUser(data))
        .then(data => createTeamChannel(data))
        .then(data => sendCreationMessage(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};