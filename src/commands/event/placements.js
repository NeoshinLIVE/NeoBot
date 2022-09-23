const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { inlineCode } = require('@discordjs/builders');
const { colors } = require('../../../config.json');
const { Events, Teams } = require('../../database');

async function getEvent(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const { options } = data.interaction;
    const id = options.getString('id');
    const name = options.getString('name');
    let event = null;

    if (id) event = await Events.findOne({ where: { id: id } }).catch(() => { return false; });
    if (!id && name || !event && name) event = await Events.findOne({ where: { name: name } }).catch(() => { return false; });

    if (!event && id) {
        await interaction.reply({ content: `:no_entry: Es konnte kein Event mit der ID **${id}** gefunden werden.`, ephemeral: true });
        return;
    }

    if (!event && name) {
        await interaction.reply({ content: `:no_entry: Es konnte kein Event mit dem Namen **${name}** gefunden werden.`, ephemeral: true });
        return;
    }

    if (event.status !== 'PUBLIC') {
        await interaction.reply({ content: `:no_entry: Die Platzierungen für das Event **${event.name}** können nicht gesetzt werden, da es nicht öffentlich ist.`, ephemeral: true });
        return;
    }

    data.event = event;

    return data;
}

async function sendPlacementsModal(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction, event: { name, teams_list } } = data;
    const teams = teams_list ? JSON.parse(teams_list) : false;

    if (!teams || teams.length < 1) {
        await interaction.reply({ content: `:no_entry: Die Platzierungen können nicht für das Event **${name}** gesetzte werden, da keine Teams angemeldet sind.`, ephemeral: true });
        return;
    }

    const components = [];
    const modal = new ModalBuilder()
        .setCustomId('teamPlacements')
        .setTitle('🏆 Team Platzierungen');

    teams.map(t => {
        const component = new ActionRowBuilder()
            .addComponents(
                new TextInputBuilder()
                    .setCustomId(`team-${t.id}`)
                    .setLabel(t.name)
                    .setValue(t.pos ? t.pos : '')
                    .setStyle(TextInputStyle.Short));

        components.push(component);
    });

    data.event.teams_list = teams;

    modal.addComponents(components);
    await interaction.showModal(modal);

    return data;
}

async function awaitPlacementsModalSubmit(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const filter = i => i.customId === 'teamPlacements';

    return await interaction.awaitModalSubmit({ filter, time: 2 * 60 * 1000 })
        .then(async i => {
            data.interaction = i;
            return data;
        })
        .catch(async () => {
            await interaction.reply({ content: ':alarm_clock: Die Zeit für die Antwort ist abgelaufen. Bitte versuche es erneut.', embeds: [], components: [] });
            return;
        });
}

async function updateEvent(data) {
    if (!data || !data.event) return;

    const { fields } = data.interaction;
    const { id, teams_list } = data.event;

    teams_list.map(t => {
        teams_list[teams_list.indexOf(t)].pos = fields.getTextInputValue(`team-${t.id}`);
    });

    teams_list.sort((a, b) => a.pos - b.pos);

    await Events.update({ teams_list: JSON.stringify(teams_list) }, { where: { id: id } });

    return data;
}

async function updateTeams(data) {
    if (!data || !data.interaction || !data.event) return;

    const { channels } = data.interaction.guild;
    const { id, name, teams_list } = data.event;

    teams_list.map(async t => {
        const team = await Teams.findOne({ where: { id: t.id } }).catch(() => { return false; });
        const { events_planed, events_history } = team;
        const planed = events_planed ? JSON.parse(events_planed) : [];
        const history = events_history ? JSON.parse(events_history) : [];
        const planedIndex = planed.findIndex(e => e.id === id);
        const historyEntry = history.find(e => e.id === id);
        const channel = channels.cache.get(team.text_id);
        const embeds = [new EmbedBuilder()
            .setColor(colors.success)
            .setTitle(':bell: Event Notification')
            .setDescription(`Das Team hat im **${name}** Event den **${t.pos}.** Platz gemacht!`)];

        planed.splice(planedIndex, 1);

        if (historyEntry) {
            history[history.indexOf(historyEntry)].pos = t.pos;
        } else {
            history.push({ id: id, name: name, pos: t.pos });
        }

        await Teams.update({ events_planed: JSON.stringify(planed), events_history: JSON.stringify(history) }, { where: { id: t.id } });
        await channel.send({ embeds: embeds });
    });

    return data;
}

function getEventEmbedFields(data) {
    if (!data || !data.interaction || !data.event || !data.message) return;

    const { teams_list } = data.event;
    const { embeds } = data.message;
    const { fields } = embeds[0];
    const teamListField = fields.find(f => f.name.startsWith(':shield: Team Liste'));
    let teamsString = '';
    let i = 0;

    teams_list.map(t => {
        const teamString = t.pos < 4 ? `**#${t.pos}** ${inlineCode(t.name)}` : `#${t.pos} ${inlineCode(t.name)}`;
        teamsString += i > 0 ? `, ${teamString}` : teamString;
        i++;
    });

    const teamListFieldIndex = fields.indexOf(teamListField);
    teamListField.value = teamsString;
    fields[teamListFieldIndex] = teamListField;

    return fields;
}

async function getEventEmbed(data) {
    if (!data || !data.interaction || !data.event || !data.message) return;

    const { message } = data;
    const embed = message.embeds[0].data;
    embed.fields = getEventEmbedFields(data);

    return embed;
}

async function getEventMessage(data) {
    if (!data || !data.interaction || !data.event) return;

    const { channel_id, message_id } = data.event;
    const { channels } = data.interaction.guild;
    const channel = channels.cache.get(channel_id);
    const message = await channel.messages.fetch(message_id);

    return message;
}

async function updateEventMessage(data) {
    if (!data || !data.interaction || !data.event) return;

    data.message = await getEventMessage(data);
    const embeds = [await getEventEmbed(data)];

    await data.message.edit({ embeds: embeds, components: data.message.components });

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction, event } = data;
    await interaction.reply({
        content: `:white_check_mark: Die Teamplatzierungen für das Event **${event.name}** wurden gesetzt.`,
        embeds: [],
        components: [],
        ephemeral: true,
    });
}

module.exports = async function(interaction) {
    getEvent({ interaction })
        .then(data => sendPlacementsModal(data))
        .then(data => awaitPlacementsModalSubmit(data))
        .then(data => updateEvent(data))
        .then(data => updateTeams(data))
        .then(data => updateEventMessage(data))
        .then(data => sendResponse(data))
        .catch(async error => {
            console.log(error);
            await interaction.reply({ content: ':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.', embeds: [], components: [], ephemeral: true });
            return;
        });
};