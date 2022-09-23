const { SlashCommandBuilder } = require('@discordjs/builders');
const subcommands = {
    list_players: require('./block/list-players'),
    list_teams: require('./block/list-teams'),
    player: require('./block/player'),
    team: require('./block/team'),
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('block')
        .setDescription('Blockiere Spieler & Teams.')
        .setDefaultMemberPermissions(0)
        .addSubcommand(subcommand =>
            subcommand
                .setName('list-players')
                .setDescription('Liste aller blockierten Spieler.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list-teams')
                .setDescription('Liste aller blockierten Teams.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('player')
                .setDescription('Blockiere einen verifizierten Spieler.')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Member vom Discord Server.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Wähle wie lange der Spieler blockiert werden soll.')
                        .setRequired(true)
                        .addChoices(
                            { name: '1 Tag', value: '1day' },
                            { name: '3 Tage', value: '3days' },
                            { name: '1 Woche', value: '1week' },
                            { name: '2 Wochen', value: '1weeks' },
                            { name: '1 Monat', value: '1month' },
                        ))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Begründung der Blockierung.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('team')
                .setDescription('Blockiere ein Team.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name des Teams.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Wähle wie lange das Team blockiert werden soll.')
                        .setRequired(true)
                        .addChoices(
                            { name: '1 Tag', value: '1day' },
                            { name: '3 Tage', value: '3days' },
                            { name: '1 Woche', value: '1week' },
                            { name: '2 Wochen', value: '1weeks' },
                            { name: '1 Monat', value: '1month' },
                        ))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Begründung der Blockierung.')
                        .setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand().replace('-', '_');

        subcommands[subcommand](interaction);
    },
};