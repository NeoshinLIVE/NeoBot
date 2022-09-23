const { SlashCommandBuilder } = require('@discordjs/builders');
const subcommands = {
    player: require('./unblock/player'),
    team: require('./unblock/team'),
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unblock')
        .setDescription('Entblockiere Spieler & Teams.')
        .setDefaultMemberPermissions(0)
        .addSubcommand(subcommand =>
            subcommand
                .setName('player')
                .setDescription('Blockiere einen verifizierten Spieler.')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Member vom Discord Server.')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('team')
                .setDescription('Blockiere ein Team.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name des Teams.')
                        .setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand().replace('-', '_');

        subcommands[subcommand](interaction);
    },
};