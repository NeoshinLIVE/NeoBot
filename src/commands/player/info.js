const { inlineCode } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { APEXSTATUS_API_KEY } = process.env;
const { Users, Teams } = require('../../database');
const { roles, emoji, colors, max_team_size, invite_url } = require('../../../config.json');

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

async function getUser(data) {
    if (!data || !data.interaction || !data.member) return;

    const { interaction, member } = data;
    const user = await Users.findOne({ where: { id: member.id } }).catch(() => { return false; });

    if (!user) {
        const content = member.id === interaction.member.id
            ? `:no_entry: Du hast deinen Apex Legends Account noch nicht verifiziert.\nDu kannst mit dem Befehl ${inlineCode('/player verify')} deinen Apex Legends Account verifizieren.`
            : ':no_entry: Der Member hat seinen Apex Legends Account noch nicht verifiziert.';
        await interaction.editReply({ content: content, ephemeral: true });
        return;
    }

    data.user = user;

    return data;
}

async function getPlayerData(data) {
    if (!data || !data.user) return;

    const { apex_uid, apex_platform } = data.user;
    data.player = await axios.get(`https://api.mozambiquehe.re/bridge?auth=${APEXSTATUS_API_KEY}&uid=${apex_uid}&platform=${apex_platform}&enableClubsBeta=true`);

    return data;
}

async function updateUser(data) {
    if (!data || !data.interaction || !data.member || !data.user || !data.player) return;

    const { member, user, player } = data;
    const { apex_level, apex_prestige, apex_rank_br, apex_rank_arena } = user;
    const { name, level, rank, arena } = player.data.global;
    let update = false;
    const removeRoles = [];
    const addRoles = [];
    let prestige = 0;

    if (user.name !== member.user.tag) update = true;

    // Check if BR rank changed
    if (rank.rankName !== apex_rank_br) {
        removeRoles.push(roles.br_ranks[apex_rank_br.toLowerCase()]);
        addRoles.push(roles.br_ranks[rank.rankName.toLowerCase()]);

        update = true;
    }

    // Check if Arena rank changed
    if (arena.rankName !== apex_rank_arena) {
        removeRoles.push(roles.arena_ranks[apex_rank_arena.toLowerCase()]);
        addRoles.push(roles.arena_ranks[arena.rankName.toLowerCase()]);

        update = true;
    }

    // Check if saved level is different to current level
    if (apex_level != level) {
        const flooredPrevLevel = (Math.floor(apex_level / 100) * 100);
        const flooredNewLevel = (Math.floor(level / 100) * 100);
        const prevLevelRoleName = flooredPrevLevel > 500 ? '500' : flooredPrevLevel.toString();
        const newLevelRoleName = flooredNewLevel > 500 ? '500' : flooredNewLevel.toString();

        if (prevLevelRoleName !== newLevelRoleName) {
            removeRoles.push(roles.level[prevLevelRoleName]);
            addRoles.push(roles.level[newLevelRoleName]);
        }

        if (player.data.global.levelPrestige && apex_prestige < player.data.global.levelPrestige) {
            prestige = player.data.global.levelPrestige;
        }

        update = true;
    }

    if (update) {
        if (removeRoles.length > 0 || addRoles.length > 0) {
            // Update discord member roles
            await member.roles.remove(removeRoles).then(() => member.roles.add(addRoles));
        }

        // Update user in database
        await Users.update({
            name: member.user.tag,
            apex_name: name,
            apex_level: level,
            apex_prestige: prestige,
            apex_rank_br: rank.rankName,
            apex_rank_arena: arena.rankName,
        }, { where: { id: member.id } });

        console.log(`Updated ${member.user.tag}`);
    }

    return data;
}

async function getTeam(data) {
    if (!data || !data.interaction || !data.user) return;
    if (!data.user.team_id) return data;

    data.team = await Teams.findOne({ where: { id: data.user.team_id } }).catch(() => { return false; });

    return data;
}

async function getEmbed(data) {
    if (!data || !data.interaction || !data.member || !data.player) return;

    const platform = {
        PC: 'PC',
        X1: 'XBOX',
        PS4: 'PlayStation',
    };
    const { interaction, member, player } = data;
    const { global, realtime, legends } = player.data;
    const { guild } = interaction;
    const { emojis } = guild;
    const guildIcon = await guild.iconURL({ dynamic: true });
    const avatar = await member.user.avatarURL();
    let description = ':red_circle: Offline';
    const prestige = global.levelPrestige ? ` - Prestige ${global.levelPrestige}` : '';

    if (realtime.isOnline) {
        description = ':green_circle: Online - ';

        if (realtime.isInGame) {
            description += realtime.currentStateAsText !== 'Offline' ? realtime.currentStateAsText : 'In Match';
        } else {
            description += 'In Lobby';
        }
    }

    let brRank = 'Unranked';
    let arenaRank = 'Unranked';

    if (global.rank.rankName !== 'Unranked') {
        const brRankName = global.rank.rankName.toLowerCase();
        let brRankEmoji = await emojis.fetch(emoji.ranks[brRankName]);
        brRankEmoji = brRankEmoji === undefined ? '' : brRankEmoji;
        brRank = `${brRankEmoji} ${global.rank.rankName} ${global.rank.rankDiv} - ${numberWithCommas(global.rank.rankScore)}`;
    }

    if (global.arena.rankName !== 'Unranked') {
        const arenaRankName = global.arena.rankName.toLowerCase();
        let arenaRankEmoji = await emojis.fetch(emoji.ranks[arenaRankName]);
        arenaRankEmoji = arenaRankEmoji === undefined ? '' : arenaRankEmoji;
        arenaRank = `${arenaRankEmoji} ${global.arena.rankName} ${global.arena.rankDiv} - ${numberWithCommas(global.arena.rankScore)}`;
    }

    const fields = [
        { name: 'Apex Name', value: global.name, inline: true },
        { name: 'Plattform', value: platform[global.platform], inline: true },
        { name: 'Level', value: `${numberWithCommas(global.level)} (${global.toNextLevelPercent}%)${prestige}`, inline: true },
        { name: 'Battle Royale Rang', value: brRank, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'Arena Rang', value: arenaRank, inline: true },
    ];

    if (player.data.club && player.data.club.name) {
        const { club } = player.data;
        const club_leader = club.members.filter(m => { return m.roleId === 0; });

        fields.push({ name: `Club [${club.groupSize}/30]`, value: club.name, inline: true });
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
        fields.push({ name: 'Club Leader', value: club_leader[0].name, inline: true });
    }

    if (data.team && data.team.status === 'OPEN') {
        const { team } = data;
        const members = team.members ? JSON.parse(team.members) : [];

        fields.push({ name: `Team [${members.length + 1}/${max_team_size}]`, value: team.name, inline: true });
        fields.push({ name: '\u200B', value: '\u200B', inline: true });
        fields.push({ name: 'Team Leader', value: `<@${team.leader_id}>`, inline: true });
    }

    fields.push({ name: 'Ausgewählter Legend', value: legends.selected.LegendName });

    const embed = new EmbedBuilder()
        .setColor(colors.info)
        .setAuthor({ name: guild.name, iconURL: guildIcon, url: invite_url })
        .setTitle(`${member.user.tag} - Spielerprofil`)
        .setDescription(description)
        .setThumbnail(avatar)
        .addFields(fields)
        .setImage(legends.selected.ImgAssets.banner)
        .setFooter({ text: 'Bei Problemen wende dich an einen Admin.', iconURL: guildIcon });

    return embed;
}

async function replyPlayerInfo(data) {
    if (!data || !data.interaction) return;

    const { interaction } = data;

    const embeds = [await getEmbed(data)];

    await interaction.editReply({ embeds: embeds });
}

module.exports = async function(interaction) {
    await interaction.deferReply();

    const { options } = interaction;
    const member = options.getMember('member') ? options.getMember('member') : interaction.member;

    getUser({ interaction, member })
        .then(data => getPlayerData(data))
        .then(data => updateUser(data))
        .then(data => getTeam(data))
        .then(data => replyPlayerInfo(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply({ content: ':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.', ephemeral: true });
            return;
        });
};