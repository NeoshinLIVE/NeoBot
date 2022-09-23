const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ComponentType } = require('discord-api-types/v10');
const { Teams } = require('../../database');
const { colors, emoji, max_team_size, invite_url } = require('../../../config.json');

async function getTeams(data) {
    if (!data || !data.interaction) return;

    const teams = await Teams.findAll({ where: { status: 'OPEN' } }).catch(() => { return false; });

    if (!teams) {
        await data.interaction.editReply(':no_entry: Es gibt aktuell keine Teams.');
        return;
    }

    data.teams = teams;
    const groups = Math.ceil(teams.length / 10);
    data.t = new Array(groups)
        .fill('')
        .map((_, i) => teams.slice(i * 10, (i + 1) * 10));

    return data;
}

function getEmbedFields(data) {
    if (!data || !data.interaction || !data.teams) return;

    const fields = [];

    data.t[data.p].map(team => {
        const { type, name, leader_id, members, events_history } = team;
        const member = members ? JSON.parse(members) : [];
        const memberNum = member.length + 1;
        const events = events_history ? JSON.parse(events_history) : [];
        const teamType = type === 'PERM' ? 'Premium' : 'Event';
        const teamSizePercentage = (memberNum / max_team_size) * 100;
        let statusEmoji = ':green_circle:';

        if (teamSizePercentage >= 70) statusEmoji = ':orange_circle:';
        if (teamSizePercentage === 100) statusEmoji = ':red_circle:';

        let value = `Leader: <@${leader_id}> | Member: ${memberNum}/${max_team_size} | Typ: ${teamType} Team`;

        if (type === 'PERM' && events.length > 0) {
            value += ` | Events: ${events.length}`;
        }

        fields.push({ name: `${statusEmoji} ${name}`, value: value });
    });

    return fields;
}

async function getEmbed(data) {
    if (!data || !data.interaction || !data.teams) return;

    const { interaction, teams, p, t } = data;
    const { guild } = interaction;
    const guildIcon = await guild.iconURL({ dynamic: true });
    const page = p + 1;
    const max = t.length;

    const embed = new EmbedBuilder()
        .setColor(colors.primary)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(`:shield: Teamliste (${teams.length} Teams)`)
        .setDescription(`─────────────────────[ ${page}/${max} ]─────────────────────`)
        .addFields(getEmbedFields(data))
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon });

    return embed;
}

function getComponents(data) {
    if (!data) return;

    const components = [];
    const { t, p } = data;

    if (t.length < 2) return components;

    const max = t.length - 1;

    if (p === 0) {
        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('first')
                        .setEmoji(emoji.arrows.dl)
                        .setDisabled(true)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setEmoji(emoji.arrows.l)
                        .setDisabled(true)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('num')
                        .setLabel((p + 1).toString())
                        .setDisabled(true)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setEmoji(emoji.arrows.r)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('last')
                        .setEmoji(emoji.arrows.dr)
                        .setStyle(ButtonStyle.Primary)));
    } else if (p === max) {
        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('first')
                        .setEmoji(emoji.arrows.dl)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setEmoji(emoji.arrows.l)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('num')
                        .setLabel((p + 1).toString())
                        .setDisabled(true)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setEmoji(emoji.arrows.r)
                        .setDisabled(true)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('last')
                        .setEmoji(emoji.arrows.dr)
                        .setDisabled(true)
                        .setStyle(ButtonStyle.Primary)));
    } else {
        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('first')
                        .setEmoji(emoji.arrows.dl)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setEmoji(emoji.arrows.l)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('num')
                        .setLabel((p + 1).toString())
                        .setDisabled(true)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setEmoji(emoji.arrows.r)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('last')
                        .setEmoji(emoji.arrows.dr)
                        .setStyle(ButtonStyle.Primary)));
    }

    return components;
}

async function replyTeamsList(data) {
    if (!data || !data.interaction) return;
    if (!data.p) data.p = 0;

    const { interaction } = data;
    const embeds = [await getEmbed(data)];
    const components = getComponents(data);

    data.message = await interaction.editReply({ embeds: embeds, components: components });

    return data;
}

async function awaitAnswer(data) {
    if (!data || !data.interaction || !data.message || data.t.length < 2) return;

    const { interaction, message, t, p } = data;
    const filter = i => interaction.user.id === i.user.id;
    const max = t.length - 1;

    return await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 2 * 60 * 1000 })
        .then(async i => {
            i.deferUpdate();

            switch (i.customId) {
            case 'first':
                data.p = 0;
                break;
            case 'last':
                data.p = max;
                break;
            case 'next':
                data.p = p !== max ? p + 1 : max;
                break;
            case 'prev':
                data.p = p !== 0 ? p - 1 : 0;
                break;
            }

            replyTeamsList(data).then(d => awaitAnswer(d));
        })
        .catch(async () => {
            await interaction.editReply({ embeds: [message.embeds[0]], components: [] });
            return;
        });
}

module.exports = async function(interaction) {
    await interaction.deferReply();

    getTeams({ interaction })
        .then(data => replyTeamsList(data))
        .then(data => awaitAnswer(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};