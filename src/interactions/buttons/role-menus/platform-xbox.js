const { apex_delimeter, platforms: { X1 } } = require('../../../../config.json').roles;

module.exports = {
    data: {
        customId: 'roleMenuPlatformXbox',
    },
    async execute(interaction) {
        const { member } = interaction;
        const addRole = interaction.member.roles.cache.find(role => role.id === X1) ? false : true;

        await interaction.deferReply({ ephemeral: true });

        if (addRole) {
            await member.roles.add([apex_delimeter, X1])
                .then(async () => {
                    await interaction.editReply('Du hast Xbox als Plattform hinzugefügt.');
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                    return;
                });
        } else {
            await member.roles.remove(X1)
                .then(async () => {
                    await interaction.editReply('Du hast Xbox als Plattform entfernt.');
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                    return;
                });
        }
    },
};