const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { ChannelType } = require('discord-api-types/v10');
const { inlineCode } = require('@discordjs/builders');
const { format } = require('date-fns');
const { de } = require('date-fns/locale');
const { Users, Teams, Events } = require('../../../database');
const { channel: { teams_category }, colors } = require('../../../../config.json');

async function getUser(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const { id } = interaction.member;
    const user = await Users.findOne({ where: { id: id } }).catch(() => { return false; });

    if (!user) {
        await interaction.reply({ content: `:no_entry: Um ein Team zu erstellen, musst du zuerst deinen Apex Account mit dem Befehl ${inlineCode('/player verify')} verifizieren.`, ephemeral: true });
        return;
    }

    if (user.team_id) {
        await interaction.reply({ content: ':no_entry: Du bist bereits in einem Team.', ephemeral: true });
        return;
    }

    data.user = user;

    return data;
}

async function getEvent(data) {
    if (!data || !data.eventId) return;

    const { eventId } = data;
    const event = await Events.findOne({ where: { id: eventId } }).catch(() => { return false; });

    data.event = event;

    return data;
}

async function showTeamModal(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const modal = new ModalBuilder()
        .setCustomId('createTeam')
        .setTitle('🎉 Event Team Erstellung');

    const components = [
        new ActionRowBuilder()
            .addComponents(
                new TextInputBuilder()
                    .setCustomId('name')
                    .setLabel('Teamname')
                    .setStyle(TextInputStyle.Short))];

    modal.addComponents(components);
    await interaction.showModal(modal);

    return data;
}

async function awaitTeamModalSubmit(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const filter = i => i.customId === 'createTeam';

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

async function createTeam(data) {
    if (!data || !data.interaction || !data.event) return;

    const { interaction, event, user } = data;
    const team = {
        name: interaction.fields.getTextInputValue('name'),
        type: 'TEMP',
        leader_id: user.id,
        events_planed: JSON.stringify([{ id: event.id, name: event.name }]),
    };

    if (team.name.length < 4) {
        await interaction.reply({ content: 'Der Teamname muss mindestens 4 Zeichen lang sein.', ephemeral: true });
        return;
    }

    const isNameTaken = await Teams.findOne({ where: { name: team.name } }).catch(() => { return false; });

    if (isNameTaken) {
        await interaction.reply({ content: 'Der gewählte Teamname is schon vergeben. Bitte wähle einen anderen', ephemeral: true });
        return;
    }

    data.team = await Teams.create(team);

    return data;
}

async function updateUser(data) {
    if (!data || !data.team) return;

    await Users.update({ team_id: data.team.id }, { where: { id: data.team.leader_id } });

    return data;
}

async function updateEvent(data) {
    if (!data || !data.team || !data.event) return;

    const { team, event } = data;
    event.teams_list = event.teams_list ? JSON.parse(event.teams_list) : '';

    if (event.teams_list) {
        event.teams_list.push({ id: team.id, name: team.name });
    } else {
        event.teams_list = [{ id: team.id, name: team.name }];
    }

    data.event.teams_list = JSON.stringify(event.teams_list);

    await Events.update({ teams_list: data.event.teams_list }, { where: { id: event.id } });

    return data;
}

async function createTeamChannel(data) {
    if (!data || !data.interaction || !data.team) return;

    const { team, interaction: { member, guild: { id, channels } } } = data;

    const textChannel = await channels.create({
        name: team.name,
        type: ChannelType.GuildText,
        parent: teams_category,
        topic: team.description,
        permissionOverwrites: [
            {
                id: id,
                deny: PermissionFlagsBits.ViewChannel,
            },
            {
                id: member.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.CreatePublicThreads],
            },
        ] });

    const voiceChannel = await channels.create({
        name: team.name,
        type: ChannelType.GuildVoice,
        parent: teams_category,
        permissionOverwrites: [
            {
                id: id,
                deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
            },
            {
                id: member.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.ManageMessages],
            },
        ] });

    data.textChannel = textChannel;

    await Teams.update({ text_id: textChannel.id, voice_id: voiceChannel.id }, { where: { id: team.id } });

    return data;
}

function getEventEmbedFields(data) {
    if (!data || !data.interaction || !data.event || !data.message) return;

    const { teams_list, max_teams } = data.event;
    const { embeds } = data.message;
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

    const { message } = data;
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

    const { message_id } = data.event;
    const { messages } = data.interaction.channel;
    const message = await messages.fetch(message_id);

    data.message = message;

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
    if (!data || !data.interaction || !data.textChannel) return;

    const { textChannel } = data;
    const embeds = [getTeamNotificationEmbed(data)];

    await textChannel.send({ embeds: embeds });

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.event || !data.textChannel) return;

    const { interaction, event, textChannel } = data;
    await interaction.reply({
        content: `:white_check_mark: Das Team **${data.team.name}** wurde erfolgreich erstellt und für das **${event.name}** Event angemeldet. Du kannst nun in <#${textChannel.id}> neue Team Mitglieder einladen.`,
        embeds: [],
        components: [],
        ephemeral: true,
    });
}

module.exports = {
    data: {
        customId: 'eventCreateTeam',
    },
    async execute(interaction) {
        const eventId = interaction.customIdData;

        getUser({ interaction, eventId })
            .then(data => getEvent(data))
            .then(data => showTeamModal(data))
            .then(data => awaitTeamModalSubmit(data))
            .then(data => createTeam(data))
            .then(data => updateUser(data))
            .then(data => updateEvent(data))
            .then(data => createTeamChannel(data))
            .then(data => updateEventMessage(data))
            .then(data => sendTeamMessage(data))
            .then(data => sendResponse(data))
            .catch(async error => {
                console.log(error);
                return;
            });
    },
};