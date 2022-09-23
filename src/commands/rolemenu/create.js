const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SelectMenuBuilder, SelectMenuOptionBuilder } = require('discord.js');
const { inlineCode } = require('@discordjs/builders');
const { roles, emoji, colors, invite_url } = require('../../../config.json');

function getEmbedTitle(data) {
    if (!data || !data.interaction || !data.menu) return;

    switch (data.menu) {
    case 'inputs': return ':video_game: Apex Legends - Inputgeräte Rollenmenü';
    case 'legends': return ':military_helmet: Apex Legends - Legenden Rollenmenü';
    case 'platforms': return ':desktop: Apex Legends - Plattformen Rollenmenü';
    }
}

function getEmbedDescription(data) {
    if (!data || !data.interaction || !data.menu) return;

    switch (data.menu) {
    case 'inputs': return 'Wähle das Inputgerät was du benutzt um Apex Legends zu spielen.';
    case 'legends': return 'Wähle die Legenden aus, die du am meißten/liebsten in Apex Legends spielst.';
    case 'platforms': return 'Wähle die Plattform aus, auf der du Apex Legends spielst.';
    }
}

async function getEmbed(data) {
    if (!data || !data.interaction || !data.menu) return;

    const { guild } = data.interaction;
    const guildIcon = await guild.iconURL({ dynamic: true });
    const title = getEmbedTitle(data);
    const description = getEmbedDescription(data);
    const embed = new EmbedBuilder()
        .setColor(colors.primary)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon });

    return embed;
}

function getComponents(data) {
    if (!data || !data.interaction || !data.menu) return;

    switch (data.menu) {
    case 'inputs': {
        const components = [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('roleMenuInputMk')
                        .setLabel('Maus & Keyboard')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('roleMenuInputController')
                        .setLabel('Controller')
                        .setStyle(ButtonStyle.Secondary)),
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('roleMenuRemoveInputRoles')
                        .setLabel('Entferne alle Input Rollen')
                        .setStyle(ButtonStyle.Danger))];
        return components;
    }
    case 'legends': {
        const options = [];

        for (const [legendName, roleId] of Object.entries(roles.legends)) {
            const name = legendName.replace('_', ' ');

            options.push(new SelectMenuOptionBuilder()
                .setLabel(name)
                .setValue(roleId)
                .setEmoji(emoji.legends[legendName]));
        }

        const components = [
            new ActionRowBuilder()
                .addComponents(
                    new SelectMenuBuilder()
                        .setCustomId('roleMenuLegends')
                        .setPlaceholder('Wähle deine Legends')
                        .addOptions(options)),
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('roleMenuRemoveLegendRoles')
                        .setLabel('Entferne alle Legend Rollen')
                        .setStyle(ButtonStyle.Danger)),
        ];

        return components;
    }
    case 'platforms': {
        const components = [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('roleMenuPlatformPc')
                        .setLabel('PC')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('roleMenuPlatformPs')
                        .setLabel('PlayStation')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('roleMenuPlatformXbox')
                        .setLabel('Xbox')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('roleMenuPlatformSwitch')
                        .setLabel('Switch')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('roleMenuPlatformMobile')
                        .setLabel('Mobile')
                        .setStyle(ButtonStyle.Secondary)),
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('roleMenuRemovePlatformRoles')
                        .setLabel('Entferne alle Plattform Rollen')
                        .setStyle(ButtonStyle.Danger)),
        ];

        return components;
    }
    }
}

async function createRoleMenu(data) {
    if (!data || !data.interaction) return;

    const { options, channel } = data.interaction;
    data.menu = options.getString('menu');
    const embeds = [await getEmbed(data)];
    const components = getComponents(data);

    data.message = await channel.send({ embeds: embeds, components: components });

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.menu || !data.message) return;

    await data.interaction.editReply(`:white_check_mark: Ein **${data.menu.toUpperCase()}** Rollenmenü mit der Message ID ${inlineCode(data.message.id)} wurde erstellt.`);
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    createRoleMenu({ interaction })
        .then(data => sendResponse(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};