const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Users, Teams, TeamInvites } = require('../../database');
const { max_team_size, colors, invite_url } = require('../../../config.json');

async function getUser(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;
    const user = await Users.findOne({ where: { id: interaction.member.id } }).catch(() => { return false; });

    if (!user || !user.team_id) {
        await interaction.editReply(':no_entry: Du musst Team Leader des Teams sein, um Member einladen zu können.');
        return;
    }

    data.user = user;

    return data;
}

async function checkIfFull(data) {
    if (!data || !data.interaction || !data.user) return;

    const { interaction, user } = data;
    const users = await Users.findAll({ where: { team_id: user.team_id } }).catch(() => { return false; });

    if (users.length >= max_team_size) {
        await interaction.editReply(':no_entry: Du kannst niemanden mehr in das Team einladen, da es voll ist.');
        return;
    }

    return data;
}

async function getTeam(data) {
    if (!data || !data.interaction || !data.user) return;

    const { interaction, user } = data;
    const team = await Teams.findOne({ where: { id: user.team_id } }).catch(() => { return false; });

    if (!team || team.leader_id !== user.id) {
        await interaction.editReply(':no_entry: Du musst Team Leader des Teams sein, um Member einladen zu können.');
        return;
    }

    if (team.status === 'BLOCKED') {
        await interaction.editReply({ content: ':no_entry: Du kannst keine Member in das Team einladen, da es aktuell blockiert ist.', ephemeral: true });
        return;
    }

    data.team = team;

    return data;
}

async function checkReciever(data) {
    if (!data || !data.interaction || !data.member || !data.user || !data.team) return;

    const { interaction, member, user, team } = data;

    if (member.user.id === user.id) {
        await interaction.editReply(':no_entry: Du kannst dir selbst keine Einladung senden.');
        return;
    }

    if (member.user.bot) {
        await interaction.editReply(':no_entry: Du kannst keine Bots in das Team einladen.');
        return;
    }

    const recieverUser = await Users.findOne({ where: { id: member.id } }).catch(() => { return false; });

    if (!recieverUser) {
        await interaction.editReply(':no_entry: Der Member muss seinen Apex Legends Account verifizieren, um in das Team eingeladen zu werden.');
        return;
    }

    if (recieverUser.team_id) {
        if (recieverUser.team_id === team.id) {
            await interaction.editReply(':no_entry: Der Member ist in deinem Team.');
        } else {
            await interaction.editReply(':no_entry: Der Member ist bereits in einem anderen Team.');
        }

        return;
    }

    return data;
}

async function updateTeamInvites(data) {
    if (!data || !data.interaction || !data.team || !data.member) return;

    const { interaction, team, member } = data;
    const teamInvite = {
        uid: member.id,
        team_id: team.id,
        inviter_uid: team.leader_id,
    };

    const isInvited = await TeamInvites.findOne({ where: { uid: member.id, inviter_uid: team.leader_id } }).catch(() => { return false; });

    if (isInvited) {
        if (isInvited.blocked) {
            await interaction.editReply(':no_entry: Der Member möchte keine weiteren Einladungen von diesem Team erhalten.');
            return;
        }

        await interaction.editReply(':no_entry: Du hast dem Member bereits eine Einladung geschickt.');
        return;
    }

    data.invite = await TeamInvites.create(teamInvite);

    return data;
}

async function getinviteMessage(data) {
    if (!data || !data.interaction || !data.team || !data.invite) return;

    const { interaction, team, invite } = data;
    const { guild } = interaction;
    const guildIcon = await guild.iconURL({ dynamic: true });

    const embeds = [new EmbedBuilder()
        .setColor(colors.success)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(':envelope: Neue Teameinladung')
        .setDescription(`Du wurdest von <@${team.leader_id}> in das Team **${team.name}** eingeladen.`)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon })];

    const components = [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`teamInviteAccept-${invite.id}`)
                    .setLabel('Akzeptieren')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`teamInviteDeny-${invite.id}`)
                    .setLabel('Ablehnen')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`teamInviteBlock-${invite.id}`)
                    .setLabel('Blockieren')
                    .setStyle(ButtonStyle.Secondary))];

    return { embeds: embeds, components: components };
}

async function sendInvite(data) {
    if (!data || !data.interaction || !data.team) return;

    const { interaction, member } = data;

    await member.createDM()
        .then(async dm => await dm.send(await getinviteMessage(data)))
        .then(async () => {
            await interaction.editReply(`:white_check_mark: Es wurde eine Einladung an <@${member.id}> geschickt.`);
            return;
        })
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es konnte keine Einladung an den Member gesendet werden. Wahrscheinlich blockiert der Member Privatnachrichten.');
            return;
        });
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.options.getMember('member');

    getUser({ interaction, member })
        .then(data => checkIfFull(data))
        .then(data => getTeam(data))
        .then(data => checkReciever(data))
        .then(data => updateTeamInvites(data))
        .then(data => sendInvite(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};