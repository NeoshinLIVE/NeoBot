const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ComponentType } = require('discord-api-types/v10');
const { Users, Teams } = require('../../database');
const { roles: { server_booster, twitch_sub }, colors, invite_url } = require('../../../config.json');

async function getUser(userId) {
    if (!userId) return;

    return await Users.findOne({ where: { id: userId } }).catch(() => { return false; });
}

async function getTeam(teamId) {
    if (!teamId) return;

    return await Teams.findOne({ where: { id: teamId } }).catch(() => { return false; });
}

async function checkIfLeader(data) {
    if (!data || !data.interaction) return;

    const user = await getUser(data.interaction.user.id);

    if (!user || !user.team_id) {
        data.interaction.editReply(':no_entry: Du bist aktuell in keinem Team.');
        return;
    }

    const team = await getTeam(user.team_id);

    if (!team || team.leader_id !== user.id) {
        data.interaction.editReply(':no_entry: Du musst Team Leader des Teams sein, um die Team Leader Rechte übetragen zu können.');
        return;
    }

    data.team = team;

    return data;
}

async function checkIfMember(data) {
    if (!data || !data.interaction || !data.team) return;

    const { interaction } = data;
    const { type } = data.team;
    const member = interaction.options.getMember('member');

    if (member.id === interaction.user.id) {
        data.interaction.editReply(':no_entry: Du kannst die Team Leader Rechte nicht an dich selbst übertragen.');
        return;
    }

    const user = await getUser(member.id);

    if (!user || !user.team_id || user.team_id != data.team.id) {
        data.interaction.editReply(':no_entry: Der Member muss im Team sein, um ihm die Team Leader Rechte übertragen zu können.');
        return;
    }

    const { guild } = interaction;
    const serverBoosterRole = guild.roles.cache.get(server_booster);
    const twitchSubRole = guild.roles.cache.get(twitch_sub);
    const isServerBooster = await member.roles.cache.get(serverBoosterRole.id);
    const isTwitchSub = await member.roles.cache.get(twitchSubRole.id);

    if (type === 'PERM' && !isServerBooster && !isTwitchSub) {
        await data.interaction.editReply(`:no_entry: Der Member muss entweder ${twitchSubRole} oder ${serverBoosterRole} sein, um das Team als Team Leader leiten zu können.`);
        return;
    }

    data.member = member;

    return data;
}

async function sendTransferQuestion(data) {
    if (!data || !data.interaction) return;

    return await data.interaction.editReply(await getTransferQuestionMessage(data)).then(message => {
        data.message = message;
        return data;
    });
}

async function getTransferQuestionMessage(data) {
    if (!data || !data.interaction || !data.team || !data.member) return;

    const { interaction: { guild }, team, member } = data;
    const guildIcon = await guild.iconURL({ dynamic: true });

    const embeds = [new EmbedBuilder()
        .setColor(colors.warning)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(`:repeat: Leader Transfer von Team ${team.name}`)
        .setDescription(`Du bist dabei deine Team Leader Rechte vom Team **${team.name}** an **<@${member.id}>** zu übertragen, bist du dir sicher?.`)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon })];

    const components = [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('transfer')
                    .setLabel('Übertragen')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Abbrechen')
                    .setStyle(ButtonStyle.Secondary))];

    return { embeds: embeds, components: components };
}

async function awaitAnswer(data) {
    if (!data || !data.interaction) return;

    const { interaction, message } = data;
    const filter = i => i.user.id === interaction.user.id;

    return await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 2 * 60 * 1000 })
        .then(async i => {
            if (i.customId === 'transfer') {
                return data;
            } else {
                await data.interaction.editReply({ content: ':white_check_mark: Team Leader Transfer abgebrochen.', embeds: [], components: [] });
                return;
            }
        })
        .catch(async () => {
            await data.interaction.editReply({ content: ':alarm_clock: Die Zeit für die Antwort ist abgelaufen. Bitte versuche es erneut.', embeds: [], components: [] });
            return;
        });
}

async function updateTeam(data) {
    if (!data || !data.interaction || !data.team || !data.member) return;

    const { id, leader_id, members } = data.team;
    const member = JSON.parse(members);
    const index = member.indexOf(data.member.id);
    member.splice(index, 1, leader_id);

    return await Teams.update({ leader_id: data.member.id, members: JSON.stringify(member) }, { where: { id: id } }).then(() => { return data; });
}

async function updateChannelPermissions(data) {
    if (!data || !data.interaction || !data.team || !data.member) return;

    const { interaction, team, member } = data;
    const { channels } = data.interaction.guild;
    const textChannel = channels.cache.get(team.text_id);
    const voiceChannel = channels.cache.get(team.voice_id);

    await textChannel.permissionOverwrites.edit(interaction.user, {
        'ManageMessages': false,
        'CreatePublicThreads': false,
    });
    await voiceChannel.permissionOverwrites.edit(interaction.user, {
        'MuteMembers': false,
        'DeafenMembers': false,
        'ManageMessages': false,
    });
    await textChannel.permissionOverwrites.edit(member, {
        'ManageMessages': true,
        'CreatePublicThreads': true,
    });
    await voiceChannel.permissionOverwrites.edit(member, {
        'MuteMembers': true,
        'DeafenMembers': true,
        'ManageMessages': true,
    });

    data.textChannel = textChannel;

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.team || !data.member || !data.textChannel) return;

    const embedsTeam = [new EmbedBuilder()
        .setColor(colors.success)
        .setTitle(':crown: Neuer Teamleader')
        .setDescription(`<@${data.interaction.user.id}> hat die Team Leader Rechte für das Team **${data.team.name}** an <@${data.member.id}> übertragen.`)];

    await data.interaction.editReply({ content: `:repeat: Du hast deine Team Leader Rechte für das Team **${data.team.name}** an <@${data.member.id}> übertragen.`, embeds: [], components: [] });
    await data.textChannel.send({ embeds: embedsTeam });
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    checkIfLeader({ interaction })
        .then(data => checkIfMember(data))
        .then(data => sendTransferQuestion(data))
        .then(data => awaitAnswer(data))
        .then(data => updateTeam(data))
        .then(data => updateChannelPermissions(data))
        .then(data => sendResponse(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};