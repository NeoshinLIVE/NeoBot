const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ComponentType } = require('discord-api-types/v10');
const { format } = require('date-fns');
const { de } = require('date-fns/locale');
const { colors, emoji, invite_url } = require('../../../config.json');
const { Events } = require('../../database');

async function getEvents(data) {
    if (!data || !data.interaction) return;

    const events = await Events.findAll().catch(() => { return false; });

    if (!events) {
        await data.interaction.editReply(':no_entry: Es gibt aktuell keine Events.');
        return;
    }

    data.events = events;
    const groups = Math.ceil(events.length / 10);
    data.e = new Array(groups)
        .fill('')
        .map((_, i) => events.slice(i * 10, (i + 1) * 10));

    return data;
}

function getStatusIcon(status) {
    switch (status) {
    case 'DRAFT': return ':pencil:';
    case 'PUBLIC': return ':green_circle:';
    case 'CANCELED': return ':x:';
    case 'ENDED': return ':white_circle:';
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

function getEmbedFields(data) {
    if (!data || !data.events) return;

    const fields = [];

    data.e[data.p].map(e => {
        const statusIcon = getStatusIcon(e.status);
        const formatName = getFormatName(e.format);
        const date = format(new Date(e.start_date), 'd. MMMM yyyy - HH:mm', { locale: de });
        const teams = e.teams_list ? JSON.parse(e.teams_list) : [];
        let teamsString = '';

        if (teams.length > 0) {
            const teamsNum = e.max_teams === 0 ? teams.le : `${teams.length}/${e.max_teams}`;
            teamsString = `| Teams: ${teamsNum}`;
        }

        fields.push({ name: `${statusIcon} ${e.name}`, value: `${date} | ${formatName} | ID: ${e.id} ${teamsString}` });
    });

    return fields;
}

async function getEmbed(data) {
    if (!data || !data.interaction || !data.events) return;

    const { interaction, events, p, e } = data;
    const { guild } = interaction;
    const guildIcon = await guild.iconURL({ dynamic: true });
    const page = p + 1;
    const max = e.length;

    const embed = new EmbedBuilder()
        .setColor(colors.primary)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(`:tada: Eventliste (${events.length} Events)`)
        .setDescription(`─────────────────────[ ${page}/${max} ]─────────────────────`)
        .addFields(getEmbedFields(data))
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon });

    return embed;
}

function getComponents(data) {
    if (!data) return;

    const components = [];
    const { e, p } = data;

    if (e.length < 2) return components;

    const max = e.length - 1;

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

async function replyEventList(data) {
    if (!data || !data.interaction || !data.events) return;
    if (!data.p) data.p = 0;

    const { interaction } = data;
    const embeds = [await getEmbed(data)];
    const components = getComponents(data);

    data.message = await interaction.editReply({ embeds: embeds, components: components });
    return data;
}

async function awaitAnswer(data) {
    if (!data || !data.interaction || !data.message || data.e.length < 2) return;

    const { interaction, message, e, p } = data;
    const filter = i => interaction.user.id === i.user.id;
    const max = e.length - 1;

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

            replyEventList(data).then(d => awaitAnswer(d));
        })
        .catch(async () => {
            await interaction.editReply({ embeds: [message.embeds[0]], components: [] });
            return;
        });
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    getEvents({ interaction })
        .then(data => replyEventList(data))
        .then(data => awaitAnswer(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};