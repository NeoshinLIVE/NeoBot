function endsWithNumber(str) {
    return /[0-9]+$/.test(str);
}

function getNumberAtEnd(str) {
    return Number(str.match(/[0-9]+$/)[0]);
}

function getCustomIdBase(interaction) {
    const data = getNumberAtEnd(interaction.customId);
    const componentId = interaction.customId.replace(`-${data}`, '');
    interaction.customIdData = data;

    return componentId;
}

module.exports = async function(client, interaction) {
    // Interaction is a command
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: ':no_entry: Es gab ein Problem bei der Ausführungs des Befehls. Bitte wende dich an einen Admin.', ephemeral: true });
        }
    }

    // Interaction is a button
    if (interaction.isButton()) {
        const button = endsWithNumber(interaction.customId) ? client.buttons.get(getCustomIdBase(interaction)) : client.buttons.get(interaction.customId);

        if (!button) return;

        try {
            await button.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: ':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.', ephemeral: true });
        }
    }

    // Interaction is a select menu
    if (interaction.isSelectMenu()) {
        const selectMenu = endsWithNumber(interaction.customId) ? client.selectMenus.get(getCustomIdBase(interaction)) : client.selectMenus.get(interaction.customId);

        if (!selectMenu) return;

        try {
            await selectMenu.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: ':no_entry: Es gab ein Problem bei der Ausführungs des Menüs. Bitte wende dich an einen Admin.', ephemeral: true });
        }
    }
};