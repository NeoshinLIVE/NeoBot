const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { inlineCode } = require('@discordjs/builders');
const { ComponentType } = require('discord-api-types/v10');
const { format } = require('date-fns');
const { de } = require('date-fns/locale');
const { colors, invite_url } = require('../../../config.json');
const { Events, Teams } = require('../../database');

function getStatusName(status) {
    switch (status) {
    case 'DRAFT': return 'Entwurf';
    case 'PUBLIC': return 'Öffentlich';
    case 'CANCELED': return 'Abgesagt';
    case 'ENDED': return 'Beendet';
    }
}

function getFormatName(formatId) {
    switch (formatId) {
    case 'classicTrios': return 'Classic Trios';
    case 'classicDuos': return 'Classic Duos';
    case 'killsRaceTrios': return 'Kills Race Trios';
    case 'killsRaceDuos': return 'Kills Race Duos';
    case 'custom': return 'Custom';
    }
}

function createDateTime(date, time) {
    const d = date.split('.');
    const dateString = `${d[1]}.${d[0]}.${d[2]} ${time}`;

    return new Date(dateString);
}

function getDateTime(dateString) {
    const d = new Date(dateString);
    const DD = d.getDate();
    const MM = d.getMonth() + 1 < 10 ? `0${d.getMonth() + 1}` : d.getMonth() + 1;
    const YYYY = d.getFullYear();
    const hh = d.getHours();
    const mm = d.getMinutes() < 10 ? `0${d.getMinutes()}` : d.getMinutes();

    return {
        date: `${DD}.${MM}.${YYYY}`,
        time: `${hh}:${mm}`,
    };
}

function isTeamsFull(data) {
    if (!data || !data.newEvent) return;

    const { teams_list, max_teams } = data.newEvent;
    const teamsCount = teams_list ? JSON.parse(teams_list).length : 0;

    return max_teams === 0 || max_teams > teamsCount ? false : true;
}

async function getEvent(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const { options } = interaction;
    const id = options.getString('id');
    const name = options.getString('name');
    let event = null;

    if (!id && !event) {
        await interaction.editReply(':no_entry: Bitte gebe an welches Event du aktuallisieren möchtest.');
        return;
    }
    if (id) event = await Events.findOne({ where: { id: id } }).catch(() => { return false; });
    if (!id && name || !event && name) event = await Events.findOne({ where: { name: name } }).catch(() => { return false; });

    if (!event && id) {
        await interaction.editReply(`:no_entry: Es konnte kein Event mit der ID **${id}** gefunden werden.`);
        return;
    }

    if (!event && name) {
        await interaction.editReply(`:no_entry: Es konnte kein Event mit dem Namen **${name}** gefunden werden.`);
        return;
    }

    if (event.status === 'CANCELED' || event.status === 'CLOSED') {
        const statusName = getStatusName(event.status);
        await interaction.editReply(`:no_entry: Das Event **${event.name}** kann nicht aktuallisiert werden, da es bereits **${statusName}** ist.`);
        return;
    }

    data.event = event;

    return data;
}

async function getNewEventData(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction, event } = data;
    const { options } = interaction;
    const newEventData = {};
    const e = {
        name: options.getString('new_name'),
        price: options.getString('price'),
        format: options.getString('format'),
        description: options.getString('description'),
        start_date: options.getString('start_date'),
        start_time: options.getString('start_time'),
        max_teams: options.getInteger('max_teams'),
        banner: options.getAttachment('banner'),
    };

    if (!e.name && !e.price && !e.format && !e.description && !e.start_date && !e.start_time && !e.max_teams && !e.banner) {
        await interaction.editReply(':no_entry: Bitte gebe an was du an dem Event aktuallisieren willst.');
        return;
    }

    if (e.name && e.name !== event.name) newEventData.name = e.name;
    if (e.price && e.price !== event.price) newEventData.price = e.price;
    if (e.format && e.format !== event.format) newEventData.format = e.format;
    if (e.description && e.description !== event.description) newEventData.description = e.description;
    if (e.max_teams && e.max_teams !== event.max_teams) newEventData.max_teams = e.max_teams;
    if (e.banner && e.banner.url !== event.banner_url) newEventData.banner_url = e.banner.url;
    if (e.start_date || e.start_time) {
        const eDateTime = getDateTime(event.start_date);
        const eDate = e.start_date && e.start_date !== eDateTime.date ? e.start_date : eDateTime.date;
        const eTime = e.start_time && e.start_time !== eDateTime.time ? e.start_time : eDateTime.time;
        newEventData.start_date = createDateTime(eDate, eTime);
    }

    data.newEventData = newEventData;
    data.newEvent = { ...event.dataValues, ...newEventData };

    return data;
}

async function getPublishQuestionMessage(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction, event } = data;
    const { guild } = interaction;
    const guildIcon = await guild.iconURL({ dynamic: true });

    const embeds = [new EmbedBuilder()
        .setColor(colors.success)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(':arrows_clockwise: Aktualisierung eines öffentlichen Events')
        .setDescription(`Du bist dabei das öffentliche Event **${event.name}** zu aktualisieren, bist du dir sicher?.`)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon })];

    const components = [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('update')
                    .setLabel('Aktualisieren')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Abbrechen')
                    .setStyle(ButtonStyle.Secondary))];

    return { embeds: embeds, components: components };
}

async function sendPublishQuestion(data) {
    if (!data || !data.interaction || !data.event) return;
    if (data.event.status === 'DRAFT') return data;

    const { interaction } = data;
    data.message = await interaction.editReply(await getPublishQuestionMessage(data));

    return data;
}

async function awaitAnswer(data) {
    if (!data || !data.interaction || !data.event) return;
    if (data.event.status === 'DRAFT') return data;
    if (!data.message) return;

    const { interaction, message } = data;
    const filter = i => interaction.user.id === i.user.id;

    return await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 2 * 60 * 1000 })
        .then(async i => {
            if (i.customId === 'update') {
                return data;
            } else {
                await interaction.editReply({ content: ':white_check_mark: Aktualisierung abgebrochen.', embeds: [], components: [] });
                return;
            }
        })
        .catch(async () => {
            await interaction.editReply({ content: ':alarm_clock: Die Zeit für die Antwort ist abgelaufen. Bitte versuche es erneut.', embeds: [], components: [] });
            return;
        });
}


async function updateEvent(data) {
    if (!data || !data.newEventData) return;

    const { event, newEventData } = data;

    await Events.update(newEventData, { where: { id: event.id } });

    return data;
}

async function updateGuildEvent(data) {
    if (!data || !data.interaction || !data.event) return;
    if (data.event.status === 'DRAFT') return data;

    const { interaction: { guild: { scheduledEvents } }, newEvent } = data;
    const guildEvent = scheduledEvents.cache.get(newEvent.guild_event_id);

    const startDate = new Date(newEvent.start_date);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 4);

    await guildEvent.edit({
        name: newEvent.name,
        scheduledStartTime: startDate,
        scheduledEndTime: endDate,
        description: `Format: ${getFormatName(newEvent.format)} | ${newEvent.description}`,
        image: newEvent.banner_url ? newEvent.banner_url : '',
    });

    return data;
}

function getEmbedFields(data) {
    if (!data || !data.interaction || !data.newEvent) return;

    const { newEvent } = data;
    const date = new Date(newEvent.start_date);
    const start_date = format(date, 'd. MMMM yyyy - HH:mm', { locale: de });
    const reg_date = format(date.setDate(date.getDate() - 1), 'd. MMMM yyyy - HH:mm', { locale: de });
    const formatName = getFormatName(newEvent.format);
    const maxTeams = newEvent.max_teams === 0 ? 'Unbegrenzt' : newEvent.max_teams;
    const teams = newEvent.teams_list ? JSON.parse(newEvent.teams_list) : false;
    const fields = [];
    const teamsNum = teams && teams.length > 0 ? `${teams.length}/${maxTeams}` : `0/${maxTeams}`;

    if (newEvent.price) {
        fields.push({ name: ':trophy: Preise', value: newEvent.price });
    }

    fields.push({ name: ':floppy_disk: Format', value: formatName, inline: true });
    fields.push({ name: '\u200B', value: '\u200B', inline: true });
    fields.push({ name: ':scroll: Teams', value: teamsNum, inline: true });
    fields.push({ name: ':calendar_spiral: Begin', value: start_date, inline: true });
    fields.push({ name: '\u200B', value: '\u200B', inline: true });
    fields.push({ name: ':alarm_clock: Anmeldeschluss', value: reg_date, inline: true });

    if (teams && teams.length) {
        let teamsString = '';
        let i = 0;

        teams.map(t => {
            teamsString += i > 0 ? `, ${inlineCode(t.name)}` : `${inlineCode(t.name)}`;
            i++;
        });

        fields.push({ name: ':shield: Team Liste', value: teamsString });
    }

    return fields;
}

async function getEmbed(data) {
    if (!data || !data.interaction || !data.newEvent) return;

    const { interaction: { guild }, newEvent } = data;
    const guildIcon = await guild.iconURL({ dynamic: true });
    const fields = getEmbedFields(data);

    const embed = new EmbedBuilder()
        .setColor(colors.primary)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(`:tada: ${newEvent.name}`)
        .setDescription(newEvent.description)
        .addFields(fields)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon });

    if (newEvent.banner_url) {
        embed.setImage(newEvent.banner_url);
    }

    return embed;
}

function getStatusEmbed() {
    return new EmbedBuilder()
        .setColor(colors.secondary)
        .setTitle(':lock: Anmeldung deaktiviert')
        .setDescription('Die maximale Anzahl an teilnehmenden Teams wurde erreicht.\nAngemeldete Teams können sich noch abmelden.\nSollten Plätze wieder frei werden, wird die Anmeldung wieder aktiviert.');
}

function getComponents(data) {
    if (!data || !data.interaction || !data.newEventData || !data.newEvent) return;

    const { id } = data.newEvent;
    const { max_teams } = data.newEventData;

    if (max_teams && isTeamsFull(data)) {
        return [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`eventCancelTeam-${id}`)
                        .setLabel('Abmelden')
                        .setStyle(ButtonStyle.Danger))];
    } else {
        return [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`eventRegisterTeam-${id}`)
                        .setLabel('Anmelden')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`eventCancelTeam-${id}`)
                        .setLabel('Abmelden')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`eventCreateTeam-${id}`)
                        .setLabel('Team erstellen')
                        .setStyle(ButtonStyle.Primary))];
    }
}

async function updateAnnouncement(data) {
    if (!data || !data.interaction || !data.newEventData || !data.newEvent) return;
    if (data.newEvent.status === 'DRAFT') return data;

    const { interaction: { guild: { channels } }, newEventData, newEvent } = data;
    const channel = channels.cache.get(newEvent.channel_id);
    const message = await channel.messages.fetch(newEvent.message_id);
    const components = getComponents(data);
    const embeds = [await getEmbed(data)];

    if (newEventData.max_teams && isTeamsFull(data)) {
        embeds.push(getStatusEmbed());
    }

    data.message = await message.edit({ embeds: embeds, components: components });

    return data;
}

async function updateTeams(data) {
    if (!data || !data.interaction || !data.event || !data.newEventData) return;
    if (data.event.status === 'DRAFT' || !data.event.teams_list) return data;

    data.event.teams_list = JSON.parse(data.event.teams_list);

    if (data.event.teams_list.length < 1) return data;

    const { channels } = data.interaction.guild;
    const { event: oe, newEvent: ne, newEventData: ned } = data;
    const fields = [];

    if (ned.name) {
        fields.push({ name: 'Neuer Name', value: inlineCode(ne.name), inline: true });
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
        fields.push({ name: 'Alter Name', value: inlineCode(oe.name), inline: true });
    }

    if (ned.format) {
        fields.push({ name: 'Neues Format', value: inlineCode(getFormatName(ne.format)), inline: true });
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
        fields.push({ name: 'Altes Format', value: inlineCode(getFormatName(oe.format)), inline: true });
    }

    if (ned.description) {
        fields.push({ name: 'Neue Beschreibung', value: inlineCode(ne.description), inline: true });
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
        fields.push({ name: 'Alte Beschreibung', value: inlineCode(oe.description), inline: true });
    }

    if (ned.start_date) {
        const oeDate = new Date(oe.start_date);
        const neDate = new Date(ne.start_date);

        fields.push({ name: 'Neues Datum', value: inlineCode(format(neDate, 'd. MMMM yyyy - HH:mm', { locale: de })), inline: true });
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
        fields.push({ name: 'Altes Datum', value: inlineCode(format(oeDate, 'd. MMMM yyyy - HH:mm', { locale: de })), inline: true });
    }

    if (ned.price) {
        fields.push({ name: 'Neue Preise', value: inlineCode(ne.price), inline: true });
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
        fields.push({ name: 'Alte Preise', value: inlineCode(oe.price), inline: true });
    }

    if (ned.max_teams) {
        fields.push({ name: 'Neue Max. Teams', value: inlineCode(ne.max_teams), inline: true });
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
        fields.push({ name: 'Alte Max. Teams', value: inlineCode(oe.max_teams), inline: true });
    }

    data.event.teams_list.map(async t => {
        const team = await Teams.findOne({ where: { id: t.id } }).catch(() => { return false; });
        const channel = channels.cache.get(team.text_id);
        const embeds = [new EmbedBuilder()
            .setColor(colors.warning)
            .setTitle(':bell: Event Notification')
            .setDescription(`Das Event **${oe.name}** wurde aktualisiert.`)
            .setFields(fields)];

        if (ned.name) {
            const events = JSON.parse(team.events_planed);
            const event = events.find(e => e.id === data.event.id);
            const eventIndex = events.indexOf(event);
            events[eventIndex].name = ned.name;

            await Teams.update({ events_planed: JSON.stringify(events) }, { where: { id: t.id } });
        }

        await channel.send({ embeds: embeds });
    });

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction, event } = data;
    await interaction.editReply({ content: `:white_check_mark: Das Event **${event.name}** wurde aktualisiert.`, embeds: [], components: [] });

    return;
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    getEvent({ interaction })
        .then(data => getNewEventData(data))
        .then(data => sendPublishQuestion(data))
        .then(data => awaitAnswer(data))
        .then(data => updateEvent(data))
        .then(data => updateGuildEvent(data))
        .then(data => updateAnnouncement(data))
        .then(data => updateTeams(data))
        .then(data => sendResponse(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply({ content: ':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.', embeds: [], components: [] });
            return;
        });
};