const { SlashCommandBuilder } = require('@discordjs/builders');
const subcommands = {
    list: require('./team/list'),
    info: require('./team/info'),
    create: require('./team/create'),
    update: require('./team/update'),
    delete: require('./team/delete'),
    leave: require('./team/leave'),
    member_invite: require('./team/member-invite'),
    member_kick: require('./team/member-kick'),
    leader_transfer: require('./team/leader-transfer'),
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('team')
        .setDescription('Infos, Erstellung & Verwaltung von Teams.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Liste aller Teams.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Infos zu deinem oder einem anderen Team.')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Member des Teams.'))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name des Teams.')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Erstelle ein neues Team.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name des Teams.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Beschreibung des Teams.'))
                .addAttachmentOption(option =>
                    option.setName('logo')
                        .setDescription('Logo des Teams')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('Bearbeite das Team.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name des Teams.'))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Beschreibung des Teams.'))
                .addAttachmentOption(option =>
                    option.setName('logo')
                        .setDescription('Logo des Teams.')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Lösche das Team.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Verlasse das aktuelle Team.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('member-invite')
                .setDescription('Lade einen Member in das Team ein.')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Ein Member aus dem Discord Server.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('member-kick')
                .setDescription('Entferne einen Member aus dem Team.')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Der Member der aus dem Team entfernt werden soll.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leader-transfer')
                .setDescription('Übertrage die Team Leader Rechte an einen Member.')
                .addUserOption(option =>
                    option.setName('member')
                        .setDescription('Member des Teams.')
                        .setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand().replace('-', '_');

        subcommands[subcommand](interaction);
    },
};