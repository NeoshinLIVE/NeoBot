const { EmbedBuilder } = require('discord.js');
const { inlineCode } = require('@discordjs/builders');
const { Users, Teams, Events } = require('../../database');
const { colors } = require('../../../config.json');

async function checkUser(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    data.user = await Users.findOne({ where: { id: data.interaction.user.id } }).catch(() => { return false; });
    const { user } = data;

    if (!user || !user.team_id) {
        await interaction.editReply(':no_entry: Du bist in keinem Team. Du musst Leader eines Teams sein, um es bearbeiten zu können.');
        return;
    }

    data.team = await Teams.findOne({ where: { id: user.team_id } }).catch(() => { return false; });
    const { team } = data;

    if (!team || team.leader_id !== user.id) {
        await interaction.editReply(':no_entry: Du musst Leader eines Teams sein, um es bearbeiten zu können.');
        return;
    }

    return data;
}

async function prepareTeamData(data) {
    if (!data || !data.interaction || !data.team) return;

    const { interaction, team } = data;
    const { options } = interaction;
    const name = options.getString('name');
    const description = options.getString('description');
    const logo = options.getAttachment('logo');
    data.options = { name, description, logo };

    if (!name && !description && !logo) {
        await interaction.editReply(':no_entry: Bitte gebe an, was du ändern möchtest.');
        return;
    }

    if (!name && team.type === 'TEMP') {
        await interaction.editReply(':no_entry: Nur Premium Teams können eine Beschreibung und ein Logo haben.');
        return;
    }

    if (name.length < 4) {
        await interaction.editReply(':no_entry: Der Teamname muss mindestens 4 Zeichen lang sein.');
        return;
    }

    const isNameTaken = await Teams.findOne({ where: { name: name } }).catch(() => { return false; });

    if (isNameTaken) {
        await interaction.editReply(':no_entry: Der gewählte Teamname is schon vergeben. Bitte wähle einen anderen.');
        return;
    }

    data.newTeam = {
        name: name ? name : team.name,
        description: description && team.type === 'PERM' ? description : team.description,
        logo_url: logo && team.type === 'PERM' ? logo.url : team.logo_url,
    };

    return data;
}

async function updateTeam(data) {

    if (!data || !data.newTeam || !data.team) return;

    await Teams.update(data.newTeam, { where: { id: data.team.id } });

    return data;
}

async function updateTeamChannel(data) {
    if (!data || !data.interaction || !data.team || !data.newTeam) return;

    const { team, newTeam, interaction, options } = data;

    if (!options.name && !options.description) return data;

    const { channels } = interaction.guild;

    if (options.name) {
        const vc = channels.cache.get(team.voice_id);
        await vc.edit({ name: newTeam.name });
    }

    if (options.name || (options.description && team.type === 'PERM')) {
        const description = newTeam.description ? newTeam.description : '';
        const tc = channels.cache.get(team.text_id);
        data.textChannel = await tc.edit({ name: newTeam.name, topic: description });
    }

    return data;
}

async function updateEvents(data) {
    if (!data || !data.interaction || !data.team || !data.newTeam) return;
    if (data.team.name === data.newTeam.name) return data;

    const { channels } = data.interaction.guild;
    const { id, events_planed } = data.team;
    const events = events_planed ? JSON.parse(events_planed) : [];

    if (events.length < 1) return data;

    events.forEach(async (e, index) => {
        const event = await Events.findOne({ where: { id: e.id } }).catch(() => { return false; });

        if (!event) return data;

        const { teams_list, channel_id, message_id } = event;
        const teams = teams_list ? JSON.parse(teams_list) : [];
        const team = teams.find(t => t.id === id);
        const teamIndex = teams.indexOf(team);
        const channel = channels.cache.get(channel_id);
        const message = await channel.messages.fetch(message_id);
        const { fields } = message.embeds[0];
        const teamListField = fields.find(f => f.name.startsWith(':shield: Team Liste'));
        const teamListFieldIndex = fields.indexOf(teamListField);

        teams[teamIndex].name = data.newTeam.name;
        events[index].teams_list = JSON.stringify(teams);

        let teamsString = '';

        teams.forEach((t, i) => {
            teamsString += i > 0 ? `, ${inlineCode(t.name)}` : `${inlineCode(t.name)}`;
        });

        teamListField.value = teamsString;
        message.embeds[0].fields[teamListFieldIndex] = teamListField;

        await Events.update({ teams_list: JSON.stringify(teams) }, { where: { id: e.id } });

        await message.edit({ embeds: message.embeds });

    });


    return data;
}

async function sendUpdateMessage(data) {
    if (!data || !data.interaction || !data.team || !data.textChannel || !data.newTeam) return;

    const fields = [];
    const { interaction, textChannel, team, newTeam, options } = data;

    if (team.name !== newTeam.name) {
        fields.push({ name: 'Neuer Name', value: inlineCode(newTeam.name), inline: true });
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
        fields.push({ name: 'Alter Name', value: inlineCode(team.name), inline: true });
    }

    if (team.description !== newTeam.description) {
        fields.push({ name: 'Neue Beschreibung', value: inlineCode(newTeam.description), inline: true });
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
        fields.push({ name: 'Alte Beschreibung', value: inlineCode(team.description), inline: true });
    }

    if (team.logo_url !== newTeam.logo_url) {
        fields.push({ name: 'Neues Logo', value: inlineCode(newTeam.logo_url), inline: true });
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
        fields.push({ name: 'Altes Logo', value: inlineCode(team.logo_url), inline: true });
    }

    if (team.type === 'TEMP' && (options.description || options.logo)) {
        fields.push({ name: 'Hinweis', value: 'Nur Premium Teams können eine Beschreibung und ein Logo haben.' });
    }

    const embeds = [new EmbedBuilder()
        .setColor(colors.success)
        .setTitle(':floppy_disk: Team aktualisiert')
        .setDescription('Die Teaminformationen wurden aktualisiert.')
        .setFields(fields)];

    await interaction.editReply(`:white_check_mark: Das Team **${team.name}** wurde erfolgreich aktualisiert.`);
    await textChannel.send({ embeds: embeds });
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    checkUser({ interaction })
        .then(data => prepareTeamData(data))
        .then(data => updateTeam(data))
        .then(data => updateTeamChannel(data))
        .then(data => updateEvents(data))
        .then(data => sendUpdateMessage(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};