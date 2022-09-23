const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { inlineCode } = require('@discordjs/builders');
const { ComponentType, GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType } = require('discord-api-types/v10');
const { format } = require('date-fns');
const { de } = require('date-fns/locale');
const { colors, invite_url } = require('../../../config.json');
const { Events } = require('../../database');

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

async function getEvent(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const { options } = interaction;
    const id = options.getString('id');
    const name = options.getString('name');
    let event = null;

    if (!id && !event) {
        await interaction.editReply(':no_entry: Bitte gebe an welches Event du veröffentlichen möchtest.');
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

    if (event.status !== 'DRAFT') {
        const statusName = getStatusName(event.status);
        await interaction.editReply(`:no_entry: Das Event **${event.name}** kann nicht veröffentlich werden, da es bereits **${statusName}** ist.`);
        return;
    }

    data.event = event;

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
        .setTitle(':green_circle: Veröffentlichung eines Events')
        .setDescription(`Du bist dabei das Event **${event.name}** zu veröffentlichen, bist du dir sicher?.`)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon })];

    const components = [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('publish')
                    .setLabel('Veröffentlichen')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Abbrechen')
                    .setStyle(ButtonStyle.Secondary))];

    return { embeds: embeds, components: components };
}

async function sendPublishQuestion(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    data.message = await interaction.editReply(await getPublishQuestionMessage(data));

    return data;
}

async function awaitAnswer(data) {
    if (!data || !data.interaction || !data.message) return;

    const { interaction, message } = data;
    const filter = i => interaction.user.id === i.user.id;

    return await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 2 * 60 * 1000 })
        .then(async i => {
            if (i.customId === 'publish') {
                return data;
            } else {
                await interaction.editReply({ content: ':white_check_mark: Veröffentlichung abgebrochen.', embeds: [], components: [] });
                return;
            }
        })
        .catch(async () => {
            await interaction.editReply({ content: ':alarm_clock: Die Zeit für die Antwort ist abgelaufen. Bitte versuche es erneut.', embeds: [], components: [] });
            return;
        });
}

async function createGuildEvent(data) {
    if (!data || !data.interaction || !data.event) return;
    const { interaction: { guild: { scheduledEvents } }, event } = data;

    if (scheduledEvents.cache.find(e => e.name === event.name)) return data;

    const startDate = new Date(event.start_date);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 4);

    data.guildEvent = await scheduledEvents.create({
        name: event.name,
        scheduledStartTime: startDate,
        scheduledEndTime: endDate,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: GuildScheduledEventEntityType.External,
        description: `Format: ${getFormatName(event.format)} | ${event.description}`,
        entityMetadata: { location: 'twitch.tv/NeoshinLIVE' },
        image: event.banner_url ? event.banner_url : '',
        reason: `Created by ${inlineCode('/event publish')}.`,
    });

    return data;
}

function getEmbedFields(data) {
    if (!data || !data.interaction || !data.event) return;

    const { event } = data;
    const date = new Date(event.start_date);
    const start_date = format(date, 'd. MMMM yyyy - HH:mm', { locale: de });
    const reg_date = format(date.setDate(date.getDate() - 1), 'd. MMMM yyyy - HH:mm', { locale: de });
    const formatName = getFormatName(event.format);
    const maxTeams = event.max_teams === 0 ? 'Unbegrenzt' : event.max_teams;
    const teams = event.teams_list ? JSON.parse(event.teams_list) : false;
    const fields = [];
    const teamsNum = teams && teams.length > 0 ? `${teams.length}/${maxTeams}` : `0/${maxTeams}`;

    if (event.price) {
        fields.push({ name: ':trophy: Preise', value: event.price });
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
    if (!data || !data.interaction || !data.event) return;

    const { interaction: { guild }, event } = data;
    const guildIcon = await guild.iconURL({ dynamic: true });
    const fields = getEmbedFields(data);

    const embed = new EmbedBuilder()
        .setColor(colors.primary)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(`:tada: ${event.name}`)
        .setDescription(event.description)
        .addFields(fields)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon });

    if (event.banner_url) {
        embed.setImage(event.banner_url);
    }

    return embed;
}

function getComponents(data) {
    if (!data || !data.interaction || !data.event) return;

    const { id } = data.event;
    const components = [
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

    return components;
}

async function sendAnnouncement(data) {
    if (!data || !data.interaction || !data.event || !data.guildEvent) return;

    const { interaction: { channel }, guildEvent } = data;
    const embeds = [await getEmbed(data)];
    const components = getComponents(data);

    data.message = await channel.send({ content: guildEvent.url, embeds: embeds, components: components });

    return data;
}

async function updateEvent(data) {
    if (!data || !data.event || !data.guildEvent) return;

    const { message, guildEvent, event } = data;

    await Events.update({ status: 'PUBLIC', guild_event_id: guildEvent.id, message_id: message.id, channel_id: message.channelId }, { where: { id: event.id } });

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction, event } = data;
    await interaction.editReply({ content: `:white_check_mark: Das Event **${event.name}** wurde veröffentlicht.`, embeds: [], components: [] });

    return;
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    getEvent({ interaction })
        .then(data => sendPublishQuestion(data))
        .then(data => awaitAnswer(data))
        .then(data => createGuildEvent(data))
        .then(data => sendAnnouncement(data))
        .then(data => updateEvent(data))
        .then(data => sendResponse(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply({ content: ':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.', embeds: [], components: [] });
            return;
        });
};