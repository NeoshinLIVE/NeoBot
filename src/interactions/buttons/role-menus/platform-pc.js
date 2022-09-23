const { apex_delimeter, platforms: { PC } } = require('../../../../config.json').roles;

module.exports = {
    data: {
        customId: 'roleMenuPlatformPc',
    },
    async execute(interaction) {
        const { member } = interaction;
        const addRole = interaction.member.roles.cache.find(role => role.id === PC) ? false : true;

        await interaction.deferReply({ ephemeral: true });

        if (addRole) {
            await member.roles.add([apex_delimeter, PC])
                .then(async () => {
                    await interaction.editReply('Du hast PC als Plattform hinzugefügt.');
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                    return;
                });
        } else {
            await member.roles.remove(PC)
                .then(async () => {
                    await interaction.editReply('Du hast PC als Plattform entfernt.');
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                    return;
                });
        }
    },
};