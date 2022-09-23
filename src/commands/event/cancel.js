const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ComponentType } = require('discord-api-types/v10');
const { colors, invite_url } = require('../../../config.json');
const { Events, Teams } = require('../../database');

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

    if (event.status !== 'PUBLIC') {
        await data.interaction.editReply(`:no_entry: Das Event **${event.name}** kann nicht abgesagt werden, da es nicht öffentlich ist.`);
        return;
    }

    data.event = event;

    return data;
}

async function getCancelQuestionMessage(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction, event } = data;
    const { guild } = interaction;
    const guildIcon = await guild.iconURL({ dynamic: true });

    const embeds = [new EmbedBuilder()
        .setColor(colors.warning)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(':x: Absage eines Events')
        .setDescription(`Du bist dabei das Event **${event.name}** abzusagen, bist du dir sicher?.`)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon })];

    const components = [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('cancelEvent')
                    .setLabel('Absagen')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Abbrechen')
                    .setStyle(ButtonStyle.Secondary))];

    return { embeds: embeds, components: components };
}

async function sendCancelQuestion(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    data.message = await interaction.editReply(await getCancelQuestionMessage(data));

    return data;
}

async function awaitAnswer(data) {
    if (!data || !data.interaction || !data.message) return;

    const { interaction, message } = data;
    const filter = i => i.user.id === interaction.user.id;

    return await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 2 * 60 * 1000 })
        .then(async i => {
            if (i.customId === 'cancelEvent') {
                return data;
            } else {
                await interaction.editReply({ content: ':white_check_mark: Absage abgebrochen.', embeds: [], components: [] });
                return;
            }
        })
        .catch(async () => {
            await interaction.editReply({ content: ':alarm_clock: Die Zeit für die Antwort ist abgelaufen. Bitte versuche es erneut.', embeds: [], components: [] });
            return;
        });
}

async function deleteGuildEvent(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction: { guild: { scheduledEvents } }, event } = data;
    const guildEvent = scheduledEvents.cache.get(event.guild_event_id);

    if (!guildEvent) return data;

    await guildEvent.delete();
    return data;
}

async function updateTeams(data) {
    if (!data || !data.interaction || !data.event) return;
    if (!data.event.teams_list) return data;

    data.event.teams_list = JSON.parse(data.event.teams_list);

    if (data.event.teams_list.length < 1) return data;

    const { channels } = data.interaction.guild;

    data.event.teams_list.map(async t => {
        const team = await Teams.findOne({ where: { id: t.id } }).catch(() => { return false; });
        const events = JSON.parse(team.events_planed);
        const event = events.find(e => e.id === data.event.id);
        const eventIndex = events.indexOf(event);
        const channel = channels.cache.get(team.text_id);
        const embeds = [new EmbedBuilder()
            .setColor(colors.danger)
            .setTitle(':bell: Event Notification')
            .setDescription(`Das Team wurde für das **${event.name}** Event abgemeldet, da es abgesagt wurde.`)];

        events.splice(eventIndex, 1);

        await Teams.update({ events_planed: JSON.stringify(events) }, { where: { id: t.id } });
        await channel.send({ embeds: embeds });
    });

    return data;
}

async function updateEvent(data) {
    if (!data || !data.interaction || !data.event) return;

    await Events.update({ status: 'CANCELED', guild_event_id: '' }, { where: { id: data.event.id } });

    return data;
}

function getEventEmbedFields(data) {
    if (!data || !data.message || !data.interaction || !data.event) return;

    const { interaction: { options }, event: { max_teams } } = data;
    const { embeds } = data.message;
    const { fields } = embeds[0];
    const teamsField = fields.find(f => f.name.startsWith(':scroll: Teams'));
    const teamsFieldIndex = fields.indexOf(teamsField);
    const teamListField = fields.find(f => f.name.startsWith(':shield: Team Liste'));
    const teamListFieldIndex = fields.indexOf(teamListField);
    const reason = options.getString('reason') ? options.getString('reason') : 'Das Event wurde abgesagt.';

    fields[teamsFieldIndex].val = `0/${max_teams}`;
    fields.splice(teamListFieldIndex, 1);
    fields.push({ name: ':x: Event abgesagt', value: reason });

    return fields;
}

function getEventEmbed(data) {
    if (!data || !data.message || !data.event) return;

    const { embeds } = data.message;
    const embed = embeds[0].data;

    embed.fields = getEventEmbedFields(data);
    embed.title = embed.title.replace(':tada:', ':x:');
    embed.color = colors.danger;

    return embed;
}

async function updateAnnouncement(data) {
    if (!data || !data.interaction || !data.event) return;

    const { channel_id, message_id } = data.event;
    const { channels } = data.interaction.guild;
    const channel = channels.cache.get(channel_id);

    if (!channel) return;

    const message = await channel.messages.fetch(message_id);
    data.message = message;

    if (!message) return;

    await message.edit({ content: '', embeds: [getEventEmbed(data)], components: [] });

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction, event } = data;
    await interaction.editReply({ content: `:white_check_mark: Das Event **${event.name}** wurde abgesagt.`, embeds: [], components: [] });

    return;
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    getEvent({ interaction })
        .then(data => sendCancelQuestion(data))
        .then(data => awaitAnswer(data))
        .then(data => deleteGuildEvent(data))
        .then(data => updateEvent(data))
        .then(data => updateTeams(data))
        .then(data => updateAnnouncement(data))
        .then(data => sendResponse(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply({ content: ':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.', embeds: [], components: [] });
            return;
        });
};