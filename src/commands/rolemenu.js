const { SlashCommandBuilder } = require('@discordjs/builders');
const subcommands = {
    create: require('./rolemenu/create'),
    update: require('./rolemenu/update'),
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolemenu')
        .setDescription('Erstelle und verwalte Rolenmenüs.')
        .setDefaultMemberPermissions(0)
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Erstelle ein Rollenmenü.')
                .addStringOption(option =>
                    option.setName('menu')
                        .setDescription('Wähle welches Menü du erstellen möchtest.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Legends', value: 'legends' },
                            { name: 'Platforms', value: 'platforms' },
                            { name: 'Inputs', value: 'inputs' },
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('Aktualisiere ein Rollenmenü.')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('ID der Nachricht mit dem Rollenmenü.')
                        .setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand().replace('-', '_');

        subcommands[subcommand](interaction);
    },
};