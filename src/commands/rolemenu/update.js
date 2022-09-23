const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SelectMenuBuilder, SelectMenuOptionBuilder } = require('discord.js');
const { inlineCode } = require('@discordjs/builders');
const { roles, emoji } = require('../../../config.json');

async function getMessage(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const { options, channel: { messages } } = interaction;

    const messageId = options.getString('message_id');
    const message = await messages.fetch(messageId).catch(() => { return false; });

    if (!message) {
        await interaction.editReply(`:no_entry: Es konnte meine Nachricht mit der ID ${inlineCode(messageId)} konnte nicht gefunden werden.`);
        return;
    }

    if (!message.components || message.components.length < 1 || !message.components[0].components || message.components[0].components.length < 1) {
        await interaction.editReply(`:no_entry: Die Nachricht mit der ID ${inlineCode(messageId)} ist kein Rollenmenü.`);
        return;
    }

    data.message = message;
    const customId = message.components[0].components[0].data.custom_id;

    switch (customId) {
    case 'roleMenuLegends':
        data.menu = 'legends';
        return data;
    case 'roleMenuInputMk':
        data.menu = 'inputs';
        return data;
    case 'roleMenuPlatformPc':
        data.menu = 'platforms';
        return data;
    }

    await interaction.editReply(`:no_entry: Die Nachricht mit der ID ${inlineCode(messageId)} ist kein Rollenmenü.`);
    return;
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
    if (!data || !data.interaction || !data.message) return;

    const components = getComponents(data);

    await data.message.edit({ components: components });

    return data;
}

async function sendResponse(data) {
    if (!data || !data.interaction || !data.menu || !data.message) return;

    await data.interaction.editReply(`:white_check_mark: Das **${data.menu.toUpperCase()}** Rollenmenü mit der Message ID ${inlineCode(data.message.id)} wurde aktualisiert.`);
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    getMessage({ interaction })
        .then(data => createRoleMenu(data))
        .then(data => sendResponse(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};