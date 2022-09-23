const { apex_delimeter, platforms: { PS4 } } = require('../../../../config.json').roles;

module.exports = {
    data: {
        customId: 'roleMenuPlatformPs',
    },
    async execute(interaction) {
        const { member } = interaction;
        const addRole = interaction.member.roles.cache.find(role => role.id === PS4) ? false : true;

        await interaction.deferReply({ ephemeral: true });

        if (addRole) {
            await member.roles.add([apex_delimeter, PS4])
                .then(async () => {
                    await interaction.editReply('Du hast PlayStation als Plattform hinzugefügt.');
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                    return;
                });
        } else {
            await member.roles.remove(PS4)
                .then(async () => {
                    await interaction.editReply('Du hast PlayStation als Plattform entfernt.');
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                    return;
                });
        }
    },
};