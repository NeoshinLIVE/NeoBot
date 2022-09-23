const { apex_delimeter } = require('../../../../config.json').roles;

module.exports = {
    data: {
        customId: 'roleMenuLegends',
    },
    async execute(interaction) {
        const { values, member, component: { options } } = interaction;

        const legendName = options.filter(option => option.value === values[0]).map(option => option.label);
        const addRole = member.roles.cache.find(role => role.id === values[0]) ? false : true;

        if (addRole) {
            await member.roles.add([apex_delimeter, values[0]])
                .then(async () => {
                    await interaction.reply({ content: `Du hast **${legendName}** als Main Legend hinzugefügt.`, ephemeral: true });
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.reply({ content: ':no_entry: Es gab ein Problem bei der Ausführungs des Menüs. Bitte wende dich an einen Admin.', ephemeral: true });
                    return;
                });
        } else {
            await member.roles.remove(values[0])
                .then(async () => {
                    await interaction.reply({ content: `Du hast **${legendName}** als Main Legend entfernt.`, ephemeral: true });
                })
                .catch(async error => {
                    console.error(error);
                    await interaction.reply({ content: ':no_entry: Es gab ein Problem bei der Ausführungs des Menüs. Bitte wende dich an einen Admin.', ephemeral: true });
                    return;
                });
        }
    },
};