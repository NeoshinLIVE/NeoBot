const { EmbedBuilder } = require('discord.js');
const { inlineCode } = require('@discordjs/builders');
const { format } = require('date-fns');
const { de } = require('date-fns/locale');
const { colors, invite_url } = require('../../../config.json');
const { Users, Teams } = require('../../database');

async function getUser(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const member = data.member ? data.member : interaction.member;
    const user = await Users.findOne({ where: { id: member.id } }).catch(() => { return false; });

    if (!user || !user.team_id) {
        const content = member.id === interaction.member.id ? ':no_entry: Du bist in keinem Team.' : ':no_entry: Der Member ist in keinem Team.';
        await interaction.reply({ content: content, ephemeral: true });
        return;
    }

    data.user = user;

    return data;
}

async function getTeam(data) {
    if (!data || !data.interaction) return;

    let team = false;

    if (data.name) {
        team = await Teams.findOne({ where: { name: data.name, status: 'OPEN' } }).catch(() => { return false; });

        if (!team) {
            await data.interaction.reply({ content: `:no_entry: Es konnte kein Team mit dem Namen **${data.name}** gefunden werden.`, ephemeral: true });
            return;
        }
    } else {
        const user = await getUser(data);

        if (!user) return;

        team = await Teams.findOne({ where: { id: await user.user.team_id, status: 'OPEN' } }).catch(() => { return false; });

        if (!team) return;
    }

    data.team = team;

    return data;
}

async function getEmbedFields(data) {
    if (!data || !data.team) return;

    const { type, leader_id, members, events_planed, events_history, createdAt } = data.team;
    const fields = [
        { name: ':crown: Leader', value: `<@${leader_id}>`, inline: true },
    ];

    const member = members ? JSON.parse(members) : [];
    const events = events_planed ? JSON.parse(events_planed) : '';
    const pastEvents = events_history ? JSON.parse(events_history) : '';

    if (member.length > 0) {
        member.forEach(id => {
            fields.push({ name: ':mortar_board: Member', value: `<@${id}>`, inline: true });
        });

        switch (member.length) {
        case 1:
            fields.push({ name: '\u200B', value: '\u200B', inline: true });
            break;
        case 3:
            fields.push({ name: '\u200B', value: '\u200B', inline: true });
            fields.push({ name: '\u200B', value: '\u200B', inline: true });
            break;
        }
    } else {
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
    }

    if (events && events.length > 0) {
        let eventsString = '';
        let i = 0;

        events.map(t => {
            eventsString += i > 0 ? `, ${inlineCode(t.name)}` : `${inlineCode(t.name)}`;
            i++;
        });

        fields.push({ name: ':tickets: Geplante Events', value: eventsString });
    }

    if (pastEvents && pastEvents.length > 0) {
        let pastEventsString = '';
        let i = 0;

        pastEvents.map(e => {
            let eventString = inlineCode(e.name);

            if (e.pos) {
                eventString = e.pos < 4 ? `**#${e.pos}** ${eventString}` : `#${e.pos} ${eventString}`;
            }

            pastEventsString += i > 0 ? `, ${eventString}` : `${eventString}`;
            i++;
        });

        fields.push({ name: ':tada: Teilgenommene Events', value: pastEventsString });
    }

    fields.push({ name: 'Gründung', value: format(new Date(createdAt), 'd. MMMM yyyy - HH:mm', { locale: de }), inline: true });
    fields.push({ name: 'Team Typ', value: type === 'PERM' ? 'Premium Team (Permanent)' : 'Event Team (Temporär)', inline: true });

    return fields;
}

async function getTeamEmbed(data) {
    if (!data || !data.interaction || !data.team) return;

    const { interaction, team } = data;
    const { guild } = interaction;
    const guildIcon = await guild.iconURL({ dynamic: true });
    const description = team.description ? team.description : 'Keine Beschreibung vorhanden.';

    const embed = new EmbedBuilder()
        .setColor(colors.info)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(`${team.name} - Teamprofil`)
        .setDescription(description)
        .setThumbnail(team.logo_url)
        .addFields(await getEmbedFields(data))
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon });

    return embed;
}

async function replyTeamInfo(data) {
    if (!data || !data.interaction || !data.team) return;

    const { interaction, team } = data;

    if (team) {
        const embeds = [await getTeamEmbed(data)];

        await interaction.reply({ embeds: embeds });
    } else {
        await interaction.reply({ content: ':no_entry: Das Team konnte leider nicht gefunden werden.', ephemeral: true });
    }
}

module.exports = async function(interaction) {
    const { options } = interaction;
    const name = options.getString('name');
    const member = options.getMember('member');

    getTeam({ interaction, name, member })
        .then(data => replyTeamInfo(data))
        .catch(async error => {
            console.log(error);
            await interaction.reply({ content: ':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.', ephemeral: true });
            return;
        });
};