const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ComponentType } = require('discord-api-types/v10');
const { inlineCode } = require('@discordjs/builders');
const { Users, Teams } = require('../../database');
const { colors, invite_url } = require('../../../config.json');

async function getUser(uid) {
    if (!uid) return;

    return await Users.findOne({ where: { id: uid } }).catch(() => { return false; });
}

async function checkLeader(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const user = await getUser(interaction.user.id);

    if (!user || !user.team_id) {
        await interaction.editReply(':no_entry: Du musst Team Leader des Teams sein, um den Member kicken zu können.');
        return;
    }

    data.user = user;

    return data;
}

async function getTeam(data) {
    if (!data || !data.interaction || !data.user) return;

    const { interaction, user } = data;
    const team = await Teams.findOne({ where: { id: user.team_id } }).catch(() => { return false; });

    if (!team || team.leader_id !== user.id) {
        await interaction.editReply(':no_entry: Du musst Team Leader des Teams sein, um den Member kicken zu können.');
        return;
    }

    data.team = team;

    return data;
}

async function checkMember(data) {
    if (!data || !data.interaction || !data.member || !data.user || !data.team) return;

    const { interaction, member, user, team } = data;

    if (user.id === member.id) {
        await interaction.editReply(`:no_entry: Du kannst dich nicht selbst aus dem Team werfen.\nWenn du das Team verlassen möchtest, übertrage zuerst mit dem ${inlineCode('/team leader-transfer')} Befehl, die Team Leader Rechte an einen anderen Member des Teams und nutze dann den ${inlineCode('/team leave')} Befehl, um das Team zu verlassen.`);
        return;
    }

    const memberUser = await getUser(member.id);

    if (!memberUser || !memberUser.team_id || memberUser.team_id != team.id) {
        await interaction.editReply(':no_entry: Der Member befindet sich nicht im Team.');
        return;
    }

    return data;
}

async function updateTeam(data) {
    if (!data || !data.user || !data.team) return;

    data.team.members = data.team.members ? JSON.parse(data.team.members) : [];

    const { user, team: { id, members } } = data;
    const index = members.indexOf(user.id);

    members.splice(index, 1);
    await Teams.update({ members: JSON.stringify(members) }, { where: { id: id } });

    return data;
}

async function getKickQuestionMessage(data) {
    if (!data || !data.interaction || !data.team || !data.member) return;

    const { interaction, team, member } = data;
    const { guild } = interaction;
    const guildIcon = await guild.iconURL({ dynamic: true });

    const embeds = [new EmbedBuilder()
        .setColor(colors.warning)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(':no_entry_sign: Member Kick')
        .setDescription(`Du bist dabei **<@${member.id}>** aus dem Team **${team.name}** zu entfernen, bist du dir sicher?.`)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon })];

    const components = [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('kick')
                    .setLabel('Kicken')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Abbrechen')
                    .setStyle(ButtonStyle.Secondary))];

    return { embeds: embeds, components: components };
}

async function sendKickQuestion(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    data.message = await interaction.editReply(await getKickQuestionMessage(data));

    return data;
}

async function awaitAnswer(data) {
    if (!data || !data.interaction || !data.message) return;

    const { interaction, message } = data;
    const filter = i => i.user.id === interaction.user.id;

    return await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 2 * 60 * 1000 })
        .then(async i => {
            if (i.customId === 'kick') {
                return data;
            } else {
                await interaction.editReply({ content: ':white_check_mark: Entfernung abgebrochen.', embeds: [], components: [] });
                return;
            }
        })
        .catch(async () => {
            await interaction.editReply({ content: ':alarm_clock: Die Zeit für die Antwort ist abgelaufen. Bitte versuche es erneut.', embeds: [], components: [] });
            return;
        });
}

async function updateUser(data) {
    if (!data || !data.team || !data.member) return;

    const { member } = data;

    await Users.update({ team_id: '' }, { where: { id: member.id } });

    return data;
}

async function updateChannelPermissions(data) {
    if (!data || !data.interaction || !data.team || !data.member) return;

    const { interaction, member, team } = data;
    const { channels } = interaction.guild;
    const textChannel = channels.cache.get(team.text_id);
    const voiceChannel = channels.cache.get(team.voice_id);

    await textChannel.permissionOverwrites.delete(member);
    await voiceChannel.permissionOverwrites.delete(member);

    data.textChannel = textChannel;

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.team || !data.member || !data.textChannel) return;

    const { interaction, member, team, textChannel } = data;

    const embeds = [new EmbedBuilder()
        .setColor(colors.danger)
        .setTitle(':no_entry: Member gekickt')
        .setDescription(`<@${member.id}> wurde von <@${interaction.member.id}> aus dem Team **${team.name}** entfernt.`)];

    await interaction.editReply({ content: `:no_entry_sign: <@${member.id}> wurde aus dem Team **${team.name}** entfernt.`, embeds: [], components: [] });
    await textChannel.send({ embeds: embeds });
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.options.getMember('member');

    checkLeader({ interaction, member })
        .then(data => getTeam(data))
        .then(data => checkMember(data))
        .then(data => sendKickQuestion(data))
        .then(data => awaitAnswer(data))
        .then(data => updateUser(data))
        .then(data => updateChannelPermissions(data))
        .then(data => updateTeam(data))
        .then(data => sendResponse(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};