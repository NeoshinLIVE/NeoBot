const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { inlineCode } = require('@discordjs/builders');
const { Users, Teams, Events } = require('../../../database');
const { colors } = require('../../../../config.json');

async function getUser(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const { id } = interaction.member;
    const user = await Users.findOne({ where: { id: id } }).catch(() => { return false; });

    if (!user || !user.team_id) {
        await interaction.reply({ content: ':no_entry: Du bist in keinem Team. Du musst Leader eines Teams sein, um dich bei einem Event abzumelden.', ephemeral: true });
        return;
    }

    data.user = user;
    return data;
}

async function getTeam(data) {
    if (!data || !data.interaction || !data.user || !data.eventId) return;

    const { interaction, user } = data;
    const team = await Teams.findOne({ where: { id: user.team_id } }).catch(() => { return false; });
    const eventsPlaned = team.events_planed ? JSON.parse(team.events_planed) : '';

    if (user.id !== team.leader_id) {
        await interaction.reply({ content: ':no_entry: Du musst der Team Leader sein, um das Team für das Event abzumelden.', ephemeral: true });
        return;
    }

    if (!eventsPlaned || eventsPlaned.filter(e => e.id === data.eventId).length === 0) {
        await interaction.reply({ content: ':no_entry: Das Team ist für das Event nicht angemeldet.', ephemeral: true });
        return;
    }

    team.events_planed = eventsPlaned;

    data.team = team;
    return data;
}

async function getEvent(data) {
    if (!data || !data.interaction || !data.eventId) return;

    const event = await Events.findOne({ where: { id: data.eventId } }).catch(() => { return false; });
    event.teams_list = JSON.parse(event.teams_list);
    data.event = event;

    return data;
}

async function updateEvent(data) {
    if (!data || !data.team || !data.event) return;

    const { team, event } = data;

    const teamsList = event.teams_list.filter(t => t.id !== team.id);
    data.event.teams_list = JSON.stringify(teamsList);

    await Events.update({ teams_list: data.event.teams_list }, { where: { id: event.id } });

    return data;
}

async function updateTeam(data) {
    if (!data || !data.team || !data.event) return;

    const { team, event } = data;
    const eventsPlaned = team.events_planed.filter(e => e.id !== event.id);
    data.team.events_planed = JSON.stringify(eventsPlaned);

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

        teamsList.forEach((t, i) => {
            teamsString += i > 0 ? `, ${inlineCode(t.name)}` : `${inlineCode(t.name)}`;
        });

        if (teamListField) {
            const teamListFieldIndex = fields.indexOf(teamListField);
            teamListField.value = teamsString;
            fields[teamListFieldIndex] = teamListField;
        } else {
            fields.push({ name: ':shield: Team Liste', value: teamsString });
        }
    } else if (teamListField) {
        const teamListFieldIndex = fields.indexOf(teamListField);
        fields.splice(teamListFieldIndex, 1);
    }

    return fields;
}

async function getEventEmbed(data) {
    if (!data || !data.interaction || !data.event) return;

    const { message } = data.interaction;
    const embed = message.embeds[0].data;
    embed.fields = getEventEmbedFields(data);

    return embed;
}

async function updateEventMessage(data) {
    if (!data || !data.interaction || !data.event) return;

    const { id } = data.event;
    const { message } = data.interaction;
    const embeds = [await getEventEmbed(data)];
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

    await message.edit({ embeds: embeds, components: components });

    return data;
}

function getTeamNotificationEmbed(data) {
    if (!data || !data.event) return;

    const { event } = data;

    return new EmbedBuilder()
        .setColor(colors.danger)
        .setTitle(':bell: Event Notification')
        .setDescription(`Das Team wurde für das **${event.name}** Event abgemeldet.`);
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
        content: `:white_check_mark: Du hast das Team **${team.name}** für das **${event.name}** Event abgemeldet.`,
        embeds: [],
        components: [],
        ephemeral: true,
    });
}

module.exports = {
    data: {
        customId: 'eventCancelTeam',
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