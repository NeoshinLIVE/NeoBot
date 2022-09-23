const { inlineCode } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ComponentType } = require('discord-api-types/v10');
const { colors, invite_url } = require('../../../config.json');
const { Events } = require('../../database');

async function getEvent(data) {
    if (!data || !data.interaction) return;

    const { options } = data.interaction;
    const id = options.getString('id');
    const name = options.getString('name');
    let event = null;

    if (id) event = await Events.findOne({ where: { id: id } }).catch(() => { return false; });
    if (!id && name || !event && name) event = await Events.findOne({ where: { name: name } }).catch(() => { return false; });

    if (!event && id) {
        await data.interaction.editReply(`:no_entry: Es konnte kein Event mit der ID **${id}** gefunden werden.`);
        return;
    }

    if (!event && name) {
        await data.interaction.editReply(`:no_entry: Es konnte kein Event mit dem Namen **${name}** gefunden werden.`);
        return;
    }

    if (event.status === 'PUBLIC') {
        await data.interaction.editReply(`:no_entry: Das Event kann nicht gelöscht werden, da es öffentlich ist.\nNutze ${inlineCode('/event cancel')} um das Event vorher abzusagen und versuche es erneut.`);
        return;
    }

    data.event = event;

    return data;
}

async function getDeleteQuestionMessage(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction, event } = data;
    const { guild } = interaction;
    const guildIcon = await guild.iconURL({ dynamic: true });

    const embeds = [new EmbedBuilder()
        .setColor(colors.warning)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(':wastebasket: Löschen eines Events')
        .setDescription(`Du bist dabei das Event **${event.name}** zu löschen, bist du dir sicher?.`)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon })];

    const components = [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('delete')
                    .setLabel('Löschen')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Abbrechen')
                    .setStyle(ButtonStyle.Secondary))];

    return { embeds: embeds, components: components };
}

async function sendDeleteQuestion(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    data.message = await interaction.editReply(await getDeleteQuestionMessage(data));

    return data;
}

async function awaitAnswer(data) {
    if (!data || !data.interaction || !data.message) return;

    const { interaction, message } = data;
    const filter = i => i.user.id === interaction.user.id;

    return await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 2 * 60 * 1000 })
        .then(async i => {
            if (i.customId === 'delete') {
                return data;
            } else {
                await interaction.editReply({ content: ':white_check_mark: Löschung abgebrochen.', embeds: [], components: [] });
                return;
            }
        })
        .catch(async () => {
            await interaction.editReply({ content: ':alarm_clock: Die Zeit für die Antwort ist abgelaufen. Bitte versuche es erneut.', embeds: [], components: [] });
            return;
        });
}

async function updateEvent(data) {
    if (!data || !data.interaction || !data.event) return;

    await Events.destroy({ where: { id: data.event.id } });

    return data;
}

async function deleteAnnouncement(data) {
    if (!data || !data.interaction || !data.event) return;

    const { channel_id, message_id } = data.event;
    const { channels } = data.interaction.guild;
    const channel = channels.cache.get(channel_id);

    if (!channel) return data;

    const message = await channel.messages.fetch(message_id);

    if (!message) return data;

    await message.delete();

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction, event } = data;
    await interaction.editReply({ content: `:white_check_mark: Das Event **${event.name}** wurde gelöscht.`, embeds: [], components: [] });

    return;
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    getEvent({ interaction })
        .then(data => sendDeleteQuestion(data))
        .then(data => awaitAnswer(data))
        .then(data => updateEvent(data))
        .then(data => deleteAnnouncement(data))
        .then(data => sendResponse(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply({ content: ':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.', embeds: [], components: [] });
            return;
        });
};