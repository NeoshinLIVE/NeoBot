const { apex_delimeter, platforms: { SWITCH } } = require('../../../../config.json').roles;

module.exports = {
    data: {
        customId: 'roleMenuPlatformSwitch',
    },
    async execute(interaction) {
        const { member } = interaction;
        const addRole = interaction.member.roles.cache.find(role => role.id === SWITCH) ? false : true;

        await interaction.deferReply({ ephemeral: true });

        if (addRole) {
            await member.roles.add([apex_delimeter, SWITCH])
                .then(async () => {
                    await interaction.editReply('Du hast Switch als Plattform hinzugefügt.');
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                    return;
                });
        } else {
            await member.roles.remove(SWITCH)
                .then(async () => {
                    await interaction.editReply('Du hast Switch als Plattform entfernt.');
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                    return;
                });
        }
    },
};