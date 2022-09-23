const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ComponentType } = require('discord-api-types/v10');
const { Users } = require('../../database');
const { colors, emoji, invite_url } = require('../../../config.json');

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

async function getUsers(data) {
    if (!data || !data.interaction) return;

    let users = await Users.findAll().catch(() => { return false; });
    users = users ? users.filter(u => { return !u.block_id && !u.blacklist_id; }) : false;

    if (!users) {
        await data.interaction.editReply(':no_entry: Es gibt aktuell keine Spieler.');
        return;
    }

    data.users = users;
    const groups = Math.ceil(users.length / 10);
    data.u = new Array(groups)
        .fill('')
        .map((_, i) => users.slice(i * 10, (i + 1) * 10));

    return data;
}

function getEmbedFields(data) {
    if (!data || !data.interaction || !data.users) return;

    const { interaction: { client } } = data;
    const rankOrder = ['Unranked', 'Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Predator'];
    const platform = {
        PC: 'PC',
        X1: 'XBOX',
        PS4: 'PlayStation',
    };
    const fields = [];

    data.u[data.p].map(user => {
        const { id, apex_name, apex_platform, apex_level, apex_prestige, apex_rank_br, apex_rank_arena } = user;
        const prestige = apex_prestige > 0 ? `- Prestige ${apex_prestige}` : '';
        const rank = rankOrder.indexOf(apex_rank_br) > rankOrder.indexOf(apex_rank_arena) ? apex_rank_br : apex_rank_arena;
        const userEmoji = rank !== 'Unranked' ? client.emojis.cache.find(e => e.name === emoji.ranks[rank.toLowerCase()]) : '';

        fields.push({ name: `${userEmoji} ${apex_name} [${platform[apex_platform]}]`, value: `<@${id}> | Lvl: ${numberWithCommas(apex_level)} ${prestige} | BR: ${apex_rank_br} | Arena: ${apex_rank_arena} ` });
    });

    return fields;
}

async function getEmbed(data) {
    if (!data || !data.interaction || !data.users) return;

    const { interaction, users, p, u } = data;
    const { guild } = interaction;
    const guildIcon = await guild.iconURL({ dynamic: true });
    const page = p + 1;
    const max = u.length;

    const embed = new EmbedBuilder()
        .setColor(colors.primary)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(`:busts_in_silhouette: Spielerliste (${users.length} Spieler)`)
        .setDescription(`─────────────────────[ ${page}/${max} ]─────────────────────`)
        .addFields(getEmbedFields(data))
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon });

    return embed;
}

function getComponents(data) {
    if (!data) return;

    const components = [];
    const { u, p } = data;

    if (u.length < 2) return components;

    const max = u.length - 1;

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

async function replyUserList(data) {
    if (!data || !data.interaction) return;
    if (!data.p) data.p = 0;

    const { interaction } = data;
    const embeds = [await getEmbed(data)];
    const components = getComponents(data);

    data.message = await interaction.editReply({ embeds: embeds, components: components });

    return data;
}

async function awaitAnswer(data) {
    if (!data || !data.interaction || !data.message || data.u.length < 2) return;

    const { interaction, message, u, p } = data;
    const filter = i => interaction.user.id === i.user.id;
    const max = u.length - 1;

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

            replyUserList(data).then(d => awaitAnswer(d));
        })
        .catch(async () => {
            await interaction.editReply({ embeds: [message.embeds[0]], components: [] });
            return;
        });
}

module.exports = async function(interaction) {
    await interaction.deferReply();

    getUsers({ interaction })
        .then(data => replyUserList(data))
        .then(data => awaitAnswer(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};