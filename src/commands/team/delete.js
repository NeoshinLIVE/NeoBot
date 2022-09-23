const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ComponentType } = require('discord-api-types/v10');
const { inlineCode } = require('@discordjs/builders');
const { colors, invite_url } = require('../../../config.json');
const { Users, Teams, Events } = require('../../database');
const { format } = require('date-fns');
const { de } = require('date-fns/locale');

function getFormatName(formatId) {
    switch (formatId) {
    case 'classicTrios': return 'Classic Trios';
    case 'classicDuos': return 'Classic Duos';
    case 'killsRaceTrios': return 'Kills Race Trios';
    case 'killsRaceDuos': return 'Kills Race Duos';
    case 'custom': return 'Custom';
    }
}

async function getUser(userId) {
    if (!userId) return;

    return await Users.findOne({ where: { id: userId } }).catch(() => { return false; });
}

async function getTeam(teamId) {
    if (!teamId) return;

    return await Teams.findOne({ where: { id: teamId } }).catch(() => { return false; });
}

async function checkIfLeader(data) {
    if (!data || !data.interaction) return;

    const user = await getUser(data.interaction.user.id);

    if (!user || !user.team_id) {
        data.interaction.editReply(':no_entry: Du bist aktuell in keinem Team.');
        return;
    }

    const team = await getTeam(user.team_id);

    if (!team || team.leader_id !== user.id) {
        data.interaction.editReply(':no_entry: Du musst Team Leader des Teams sein, um es löschen zu können.');
        return;
    }

    data.team = team;

    return data;
}

async function checkIfTeamEmpty(data) {
    if (!data || !data.interaction || !data.team) return;

    const member = await Users.findAll({ where: { team_id: data.team.id } }).catch(() => { return false; });

    if (member.length > 1) {
        data.interaction.editReply(':no_entry: Es darf sich kein Member mehr im Team befinden, bevor du es löscht.');
        return;
    }

    return data;
}

async function sendDeleteQuestion(data) {
    if (!data || !data.interaction) return;

    return await data.interaction.editReply(await getDeleteQuestionMessage(data)).then(message => {
        data.message = message;
        return data;
    });
}

async function getDeleteQuestionMessage(data) {
    if (!data || !data.interaction || !data.team) return;

    const { interaction: { guild }, team } = data;
    const guildIcon = await guild.iconURL({ dynamic: true });

    const embeds = [new EmbedBuilder()
        .setColor(colors.warning)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(`:wastebasket: Löschung vom Team ${team.name}`)
        .setDescription(`Du bist dabei das Team **${team.name}** zu löschen, bist du dir sicher?.`)
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

async function awaitAnswer(data) {
    if (!data || !data.interaction) return;

    const { interaction, message } = data;
    const filter = i => i.user.id === interaction.user.id;

    return await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 2 * 60 * 1000 })
        .then(async i => {
            if (i.customId === 'delete') {
                return data;
            } else {
                await interaction.editReply({ content: ':white_check_mark: Team Löschung abgebrochen.', embeds: [], components: [] });
                return;
            }
        })
        .catch(async () => {
            await interaction.editReply({ content: ':alarm_clock: Die Zeit für die Antwort ist abgelaufen. Bitte versuche es erneut.', embeds: [], components: [] });
            return;
        });
}

async function updateUser(data) {
    if (!data || !data.interaction) return;

    return await Users.update({ team_id: '' }, { where: { id: data.interaction.user.id } }).then(() => { return data; });
}

async function updateTeam(data) {
    if (!data || !data.interaction || !data.team) return;

    await Teams.update({ status: 'CLOSED' }, { where: { id: data.team.id } });

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
    const fields = [];
    const teams = event.teams_list;
    const teamsNum = teams && teams.length > 0 ? `${teams.length}/${maxTeams}` : `0/${maxTeams}`;

    if (event.price) {
        fields.push({ name: ':trophy: Preise', value: event.price });
    }

    fields.push({ name: ':floppy_disk: Format', value: formatName, inline: true });
    fields.push({ name: '\u200B', value: '\u200B', inline: true });
    fields.push({ name: ':scroll: Teams', value: teamsNum, inline: true });
    fields.push({ name: ':calendar_spiral: Beginn', value: start_date, inline: true });
    fields.push({ name: '\u200B', value: '\u200B', inline: true });
    fields.push({ name: ':alarm_clock: Anmeldeschluss', value: reg_date, inline: true });

    if (teams && teams.length > 0) {
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

function getComponents(data, teamsFull) {
    if (!data || !data.interaction || !data.event) return;

    const { id } = data.event;

    if (teamsFull) {
        const components = [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`eventCancelTeam-${id}`)
                        .setLabel('Abmelden')
                        .setStyle(ButtonStyle.Danger))];
        return components;
    }

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

async function updateEventMessage(data) {
    if (!data || !data.interaction || !data.event) return;

    const { channel_id, message_id } = data.event;
    const { channels } = data.interaction.guild;
    const channel = channels.cache.get(channel_id);
    const message = await channel.messages.fetch(message_id);
    const { teams_list, max_teams } = data.event;
    const teamsFull = max_teams === 0 || (max_teams > teams_list.length) ? false : true;
    const embeds = [await getEmbed(data)];

    if (teamsFull) {
        const embed = new EmbedBuilder()
            .setColor(colors.secondary)
            .setTitle(':lock: Anmeldung deaktiviert')
            .setDescription('Die maximale Anzahl an teilnehmenden Teams wurde erreicht.\nAngemeldete Teams können sich noch abmelden.\nSollten Plätze wieder frei werden, wird die Anmeldung wieder aktiviert.');

        embeds.push(embed);
    }

    await message.edit({ embeds: embeds, components: getComponents(data, teamsFull) });

    return data;
}

async function updateEvents(data) {
    if (!data || !data.interaction || !data.team) return;

    const { id, events_planed } = data.team;
    const events = events_planed ? JSON.parse(events_planed) : false;

    if (!events) return data;

    await events.map(async e => {
        const event = await Events.findOne({ where: { id: e.id, status: 'PUBLIC' } }).catch(() => { return false; });

        if (!event) return;

        event.teams_list = event.teams_list ? JSON.parse(event.teams_list).filter(t => t.id !== id) : [];
        data.event = event;

        await Events.update({ teams_list: JSON.stringify(event.teams_list) }, { where: { id: e.id } });
        await updateEventMessage(data);
    });

    return data;
}

async function deleteTeamChannel(data) {
    if (!data || !data.interaction || !data.team) return;

    const { channels } = data.interaction.guild;
    const textChannel = channels.cache.get(data.team.text_id);
    const voiceChannel = channels.cache.get(data.team.voice_id);

    if (textChannel) await textChannel.delete();
    if (voiceChannel) await voiceChannel.delete();

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.team || data.interaction.channelId === data.team.text_id) return;

    await data.interaction.editReply({ content: `:wastebasket: Das Team **${data.team.name}** wurde gelöscht.`, embeds: [], components: [] });

    return data;
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    checkIfLeader({ interaction })
        .then(data => checkIfTeamEmpty(data))
        .then(data => sendDeleteQuestion(data))
        .then(data => awaitAnswer(data))
        .then(data => updateUser(data))
        .then(data => updateTeam(data))
        .then(data => updateEvents(data))
        .then(data => deleteTeamChannel(data))
        .then(data => sendResponse(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};