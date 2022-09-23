const { legends } = require('../../../../config.json').roles;

module.exports = {
    data: {
        customId: 'roleMenuRemoveLegendRoles',
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        await interaction.member.roles.remove(Object.values(legends))
            .then(async () => {
                await interaction.editReply('Dir wurden alle Legend Rollen entfernt.');
            })
            .catch(async error => {
                console.error(error);
                await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführungs des Buttons. Bitte wende dich an einen Admin.');
                return;
            });
    },
};