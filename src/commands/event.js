const { SlashCommandBuilder } = require('@discordjs/builders');
const subcommands = {
    list: require('./event/list'),
    create: require('./event/create'),
    update: require('./event/update'),
    publish: require('./event/publish'),
    cancel: require('./event/cancel'),
    delete: require('./event/delete'),
    placements: require('./event/placements'),
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Befehle rund um Events.')
        .setDefaultMemberPermissions(0)
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Listet alle Events auf.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Erstelle ein Event.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Der Name des Events.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('format')
                        .setDescription('Das Format des Events.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Classic Trios', value: 'classicTrios' },
                            { name: 'Classic Duos', value: 'classicDuos' },
                            { name: 'Kills Race Trios', value: 'killsRaceTrios' },
                            { name: 'Kills Race Duos', value: 'killsRaceDuos' },
                            { name: 'Custom', value: 'custom' },
                        ))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Beschreibung des Events.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('start_date')
                        .setDescription('Startdatum des Events (Beispiel: 01.01.2022).')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('start_time')
                        .setDescription('Startzeit des Events (Beispiel: 12:00).')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('max_teams')
                        .setDescription('Maximale Anzahl von Teams (0 = Unbegrenzt).')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('price')
                        .setDescription('Preise die es zu gewinnen gibt.'))
                .addAttachmentOption(option =>
                    option.setName('banner')
                        .setDescription('Banner für das Event.')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('Aktualisere ein Event.')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID des Events.'))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name des Events.'))
                .addStringOption(option =>
                    option.setName('new_name')
                        .setDescription('Der neue Name des Events.'))
                .addStringOption(option =>
                    option.setName('format')
                        .setDescription('Format des Events.')
                        .addChoices(
                            { name: 'Classic Trios', value: 'classicTrios' },
                            { name: 'Classic Duos', value: 'classicDuos' },
                            { name: 'Kills Race Trios', value: 'killsRaceTrios' },
                            { name: 'Kills Race Duos', value: 'killsRaceDuos' },
                            { name: 'Custom', value: 'custom' },
                        ))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Beschreibung des Events.'))
                .addStringOption(option =>
                    option.setName('start_date')
                        .setDescription('Startdatum des Events (Beispiel: 01.01.2022).'))
                .addStringOption(option =>
                    option.setName('start_time')
                        .setDescription('Startzeit des Events (Beispiel: 12:00).'))
                .addIntegerOption(option =>
                    option.setName('max_teams')
                        .setDescription('Maximale Anzahl von Teams (0 = Unbegrenzt).'))
                .addStringOption(option =>
                    option.setName('price')
                        .setDescription('Preise die es zu gewinnen gibt.'))
                .addAttachmentOption(option =>
                    option.setName('banner')
                        .setDescription('Banner für das Event.')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('publish')
                .setDescription('Veröffentlich ein Event und erlaubt es Teams dafür anzumelden.')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID des Events.'))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name des Events.')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Sagt ein Event ab.')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID des Events.'))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name des Events.'))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Grund für die Absage.')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Löscht ein Event.')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID des Events.'))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name des Events.')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('placements')
                .setDescription('Setzt die Platzierungen für die Teams.')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID des Events.'))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name des Events.'))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        subcommands[subcommand](interaction);
    },
};