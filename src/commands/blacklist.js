const { SlashCommandBuilder } = require('@discordjs/builders');
const subcommands = {
    list: require('./blacklist/list'),
    add: require('./blacklist/add'),
    remove: require('./blacklist/remove'),
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Infos, Erstellung & Verwaltung von Einträgen in der Blacklist.')
        .setDefaultMemberPermissions(0)
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Liste aller Spieler auf der Blacklist.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Setzte einen Spieler auf die Blacklist.')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Member vom Discord Server.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Begründung für den Eintrag.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Entferne einen Spieler von Der Blacklist.')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Member vom Discord Server.')
                        .setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand().replace('-', '_');

        subcommands[subcommand](interaction);
    },
};