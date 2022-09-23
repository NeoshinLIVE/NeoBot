module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply('Befehl noch in Arbeit.');
};