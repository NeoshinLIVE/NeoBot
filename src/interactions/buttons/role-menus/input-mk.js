const { apex_delimeter, inputs: { mk } } = require('../../../../config.json').roles;

module.exports = {
    data: {
        customId: 'roleMenuInputMk',
    },
    async execute(interaction) {
        const { member } = interaction;
        const addRole = interaction.member.roles.cache.find(role => role.id === mk) ? false : true;

        await interaction.deferReply({ ephemeral: true });

        if (addRole) {
            await member.roles.add([apex_delimeter, mk])
                .then(async () => {
                    await interaction.editReply('Du hast Maus & Keyboard als Input hinzugefügt.');
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                    return;
                });
        } else {
            await member.roles.remove(mk)
                .then(async () => {
                    await interaction.editReply('Du hast Maus & Keyboard als Input entfernt.');
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                    return;
                });
        }
    },
};