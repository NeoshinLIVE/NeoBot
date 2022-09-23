const { EmbedBuilder } = require('discord.js');
const { inlineCode } = require('@discordjs/builders');
const { format } = require('date-fns');
const { de } = require('date-fns/locale');
const { Users, Teams, Events } = require('../../../database');
const { colors } = require('../../../../config.json');

async function getUser(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const { id } = interaction.member;
    const user = await Users.findOne({ where: { id: id } }).catch(() => { return false; });

    if (!user || !user.team_id) {
        await interaction.reply({ content: ':no_entry: Du bist in keinem Team. Du musst Leader eines Teams sein, um dich bei einem Event anzumelden.', ephemeral: true });
        return;
    }

    data.user = user;
    return data;
}

async function getTeam(data) {
    if (!data || !data.interaction || !data.user || !data.eventId) return;

    const { interaction, user } = data;
    const team = await Teams.findOne({ where: { id: user.team_id } }).catch(() => { return false; });

    if (!team) {
        await interaction.reply({ content: ':no_entry: Das Team indem du dich befindest, existiert nicht mehr.', ephemeral: true });
        return;
    }

    const eventsPlaned = team.events_planed ? JSON.parse(team.events_planed) : '';

    if (user.id !== team.leader_id) {
        await interaction.reply({ content: ':no_entry: Du musst der Team Leader sein, um das Team für das Event anzumelden.', ephemeral: true });
        return;
    }

    if (eventsPlaned && eventsPlaned.filter(e => e.id === data.eventId).length > 0) {
        await interaction.reply({ content: ':no_entry: Das Team ist bereits für das Event angemeldet.', ephemeral: true });
        return;
    }

    data.team = team;
    return data;
}

async function getEvent(data) {
    if (!data || !data.interaction || !data.eventId) return;

    const { interaction, eventId } = data;
    const event = await Events.findOne({ where: { id: eventId } }).catch(() => { return false; });
    const teams = event.teams_list ? JSON.parse(event.teams_list) : '';

    event.teams_list = teams;

    if (teams && teams.length >= event.max_teams) {
        await interaction.reply({ content: ':no_entry: Das Event ist leider voll. Mit etwas Glück wird später ein Platz frei.', ephemeral: true });
        return;
    }

    data.event = event;
    return data;
}

async function updateEvent(data) {
    if (!data || !data.team || !data.event) return;

    const { team, event } = data;

    if (event.teams_list) {
        event.teams_list.push({ id: team.id, name: team.name });
    } else {
        event.teams_list = [{ id: team.id, name: team.name }];
    }

    data.event.teams_list = JSON.stringify(event.teams_list);

    await Events.update({ teams_list: data.event.teams_list }, { where: { id: event.id } });

    return data;
}

async function updateTeam(data) {
    if (!data || !data.team || !data.event) return;

    const { team, event } = data;
    data.team.events_planed = team.events_planed ? JSON.parse(team.events_planed) : '';

    if (data.team.events_planed) {
        data.team.events_planed.push({ id: event.id, name: event.name });
    } else {
        data.team.events_planed = [{ id: event.id, name: event.name }];
    }

    data.team.events_planed = JSON.stringify(data.team.events_planed);

    await Teams.update({ events_planed: data.team.events_planed }, { where: { id: team.id } });

    return data;
}

function getEventEmbedFields(data) {
    if (!data || !data.interaction || !data.event) return;

    const { teams_list, max_teams } = data.event;
    const { embeds } = data.interaction.message;
    const { fields } = embeds[0];
    const teamsList = teams_list ? JSON.parse(teams_list) : false;
    const teamsField = fields.find(f => f.name.startsWith(':scroll: Teams'));
    const teamListField = fields.find(f => f.name.startsWith(':shield: Team Liste'));
    const teamsFieldIndex = fields.indexOf(teamsField);
    const maxTeams = max_teams === 0 ? 'Unbegrenzt' : max_teams;
    const teamsVal = teamsList && teamsList.length > 0 ? `${teamsList.length}/${maxTeams}` : `0/${maxTeams}`;

    teamsField.value = teamsVal;
    fields[teamsFieldIndex] = teamsField;

    if (teamsList && teamsList.length > 0) {
        let teamsString = '';
        let i = 0;

        teamsList.map(t => {
            teamsString += i > 0 ? `, ${inlineCode(t.name)}` : `${inlineCode(t.name)}`;
            i++;
        });

        if (teamListField) {
            const teamListFieldIndex = fields.indexOf(teamListField);
            teamListField.value = teamsString;
            fields[teamListFieldIndex] = teamListField;
        } else {
            fields.push({ name: ':shield: Team Liste', value: teamsString });
        }
    }

    return fields;
}

function isTeamsFull(data) {
    if (!data || !data.event) return;

    const { teams_list, max_teams } = data.event;
    const teamsCount = teams_list ? JSON.parse(teams_list).length : 0;

    return max_teams === 0 || max_teams > teamsCount ? false : true;
}

async function getEventEmbed(data) {
    if (!data || !data.interaction || !data.event) return;

    const { message } = data.interaction;
    const embed = message.embeds[0].data;
    embed.fields = getEventEmbedFields(data);

    return embed;
}

function getStatusEmbed() {
    return new EmbedBuilder()
        .setColor(colors.secondary)
        .setTitle(':lock: Anmeldung deaktiviert')
        .setDescription('Die maximale Anzahl an teilnehmenden Teams wurde erreicht.\nAngemeldete Teams können sich noch abmelden.\nSollten Plätze wieder frei werden, wird die Anmeldung wieder aktiviert.');
}

async function updateEventMessage(data) {
    if (!data || !data.interaction || !data.event) return;

    const { message } = data.interaction;
    const embeds = [await getEventEmbed(data)];
    const components = message.components;

    if (isTeamsFull(data)) {
        components[0].components = [components[0].components[1]];
        embeds.push(getStatusEmbed());
    }

    await message.edit({ embeds: embeds, components: components });

    return data;
}

function getTeamNotificationEmbed(data) {
    if (!data || !data.event) return;

    const { event } = data;
    const date = format(new Date(event.start_date), 'd. MMMM yyyy - HH:mm', { locale: de });

    return new EmbedBuilder()
        .setColor(colors.success)
        .setTitle(':bell: Event Notification')
        .setDescription(`Das Team wurde für das **${event.name}** Event angemeldet. Das Event findet am **${date}** statt.`);
}

async function sendTeamMessage(data) {
    if (!data || !data.interaction || !data.team) return;

    const { interaction: { guild }, team: { text_id } } = data;
    const channel = guild.channels.cache.get(text_id);
    const embeds = [getTeamNotificationEmbed(data)];

    await channel.send({ embeds: embeds });

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction, event, team } = data;
    await interaction.reply({
        content: `:white_check_mark: Du hast das Team **${team.name}** für das **${event.name}** Event angemeldet.`,
        embeds: [],
        components: [],
        ephemeral: true,
    });
}

module.exports = {
    data: {
        customId: 'eventRegisterTeam',
    },
    async execute(interaction) {
        const eventId = interaction.customIdData;

        getUser({ interaction, eventId })
            .then(data => getTeam(data))
            .then(data => getEvent(data))
            .then(data => updateEvent(data))
            .then(data => updateTeam(data))
            .then(data => updateEventMessage(data))
            .then(data => sendTeamMessage(data))
            .then(data => sendResponse(data))
            .catch(async error => {
                console.log(error);
                return;
            });
    },
};