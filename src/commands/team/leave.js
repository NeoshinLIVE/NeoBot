const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ComponentType } = require('discord-api-types/v10');
const { inlineCode } = require('@discordjs/builders');
const { colors, invite_url } = require('../../../config.json');
const { Users, Teams } = require('../../database');

async function getUser(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;

    const user = await Users.findOne({ where: { id: interaction.user.id } }).catch(() => { return false; });

    if (!user || !user.team_id) {
        await interaction.editReply(':no_entry: Du bist aktuell in keinem Team.');
        return;
    }

    data.user = user;

    return data;
}

async function getTeam(data) {
    if (!data || !data.interaction || !data.user) return;

    const { interaction, user } = data;
    const team = await Teams.findOne({ where: { id: user.team_id } }).catch(() => { return false; });

    if (!team || team.leader_id === user.id) {
        await interaction.editReply(`:no_entry: Du kannst als Team Leader nicht das Team verlassen.\nWenn du das Team verlassen möchtest, übertrage zuerst mit dem ${inlineCode('/team leader-transfer')} Befehl, die Team Leader Rechte an einen anderen Member des Teams und nutze dann den ${inlineCode('/team leave')} Befehl, um das Team zu verlassen.`);
        return;
    }

    data.team = team;

    return data;
}

async function sendLeaveQuestion(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;

    data.message = await interaction.editReply(await getLeaveQuestionMessage(data));

    return data;
}

async function getLeaveQuestionMessage(data) {
    if (!data || !data.interaction || !data.team) return;

    const { interaction, team } = data;
    const { guild } = interaction;
    const guildIcon = await guild.iconURL({ dynamic: true });

    const embeds = [new EmbedBuilder()
        .setColor(colors.warning)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(`:arrow_left: ${team.name} Verlassen?`)
        .setDescription(`Du bist dabei das Team **${team.name}** zu verlassen bist du dir sicher?.`)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon })];

    const components = [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('leave')
                    .setLabel('Verlassen')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Abbrechen')
                    .setStyle(ButtonStyle.Secondary))];

    return { embeds: embeds, components: components };
}

async function awaitAnswer(data) {
    if (!data || !data.interaction || !data.team || !data.user || !data.message) return;

    const { interaction, message } = data;
    const filter = i => i.user.id === interaction.user.id;

    return await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 2 * 60 * 1000 })
        .then(async i => {
            if (i.customId === 'leave') {
                return data;
            } else {
                await interaction.editReply({ content: ':white_check_mark: Team verlassen abgebrochen.', embeds: [], components: [] });
                return;
            }
        })
        .catch(async () => {
            await interaction.editReply({ content: ':alarm_clock: Die Zeit für die Antwort ist abgelaufen. Bitte versuche es erneut.', embeds: [], components: [] });
            return;
        });
}

async function updateUser(data) {
    if (!data || !data.user) return;

    const { user } = data;

    await Users.update({ team_id: '' }, { where: { id: user.id } });

    return data;
}

async function getMember(data) {
    if (!data || !data.interaction || !data.user) return;

    const { interaction, user } = data;
    const { members } = interaction.guild;

    const member = await members.cache.get(user.id);

    data.member = member;

    return data;
}

async function updateChannelPermissions(data) {
    if (!data || !data.interaction || !data.team || !data.member) return;

    const { interaction, team, member } = data;
    const { channels } = interaction.guild;
    const textChannel = channels.cache.get(team.text_id);
    const voiceChannel = channels.cache.get(team.voice_id);

    await textChannel.permissionOverwrites.delete(member);
    await voiceChannel.permissionOverwrites.delete(member);

    data.textChannel = textChannel;

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.team || !data.user || !data.textChannel) return;

    const { interaction, team, user, textChannel } = data;
    const embeds = [new EmbedBuilder()
        .setColor(colors.secondary)
        .setTitle(':wave: Member verabschiedet sich')
        .setDescription(`<@${user.id}> hat das Team **${team.name}** verlassen.`)];

    await interaction.editReply({ content: `:white_check_mark: Du hast das Team **${team.name}** verlassen.`, embeds: [], components: [] });
    await textChannel.send({ embeds: embeds });
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    getUser({ interaction })
        .then(data => getTeam(data))
        .then(data => sendLeaveQuestion(data))
        .then(data => awaitAnswer(data))
        .then(data => updateUser(data))
        .then(data => getMember(data))
        .then(data => updateChannelPermissions(data))
        .then(data => sendResponse(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};