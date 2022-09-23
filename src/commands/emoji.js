const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emojis')
        .setDescription('Zeigt die Emojis des Servers.')
        .setDefaultMemberPermissions(0),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const emojis = await interaction.guild.emojis.fetch();
        let content = '```';

        emojis.forEach(e => {
            content += `${e.name} ${e.id}\n`;
        });

        content += '```';
        await interaction.editReply(content);
    },
};