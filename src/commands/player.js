const { SlashCommandBuilder } = require('@discordjs/builders');
const subcommands = {
    list: require('./player/list'),
    info: require('./player/info'),
    verify: require('./player/verify'),
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('player')
        .setDescription('Infos & Verifzierung von Apex Legends Spielern.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Liste aller verifizierten Apex Spieler.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Infos über dich oder einen anderen Apex Spieler.')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Member vom Discord Server.')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('verify')
                .setDescription('Verifiziere deinen Apex Legends Account.')
                .addStringOption(option =>
                    option.setName('platform')
                        .setDescription('Platform auf der du Apex Legends spielst.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'PC', value: 'PC' },
                            { name: 'PlayStation', value: 'PS4' },
                            { name: 'XBOX', value: 'X1' },
                        ))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Dein Apex Spielername. (PC Spieler: Gebe deinen Origin Namen und nicht deinen Steam Namen an!)')
                        .setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand().replace('-', '_');

        subcommands[subcommand](interaction);
    },
};