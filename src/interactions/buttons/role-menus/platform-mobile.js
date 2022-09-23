const { apex_delimeter, platforms: { MOBILE } } = require('../../../../config.json').roles;

module.exports = {
    data: {
        customId: 'roleMenuPlatformMobile',
    },
    async execute(interaction) {
        const { member } = interaction;
        const addRole = interaction.member.roles.cache.find(role => role.id === MOBILE) ? false : true;

        await interaction.deferReply({ ephemeral: true });

        if (addRole) {
            await member.roles.add([apex_delimeter, MOBILE])
                .then(async () => {
                    await interaction.editReply('Du hast Mobile als Plattform hinzugefügt.');
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                    return;
                });
        } else {
            await member.roles.remove(MOBILE)
                .then(async () => {
                    await interaction.editReply('Du hast Mobile als Plattform entfernt.');
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                    return;
                });
        }
    },
};