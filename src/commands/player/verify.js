require('dotenv').config();
const jsonBig = require('json-bigint');
const axios = require('axios');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ComponentType } = require('discord-api-types/v10');
const { APEXSTATUS_API_KEY } = process.env;
const { Users } = require('../../database');
const { roles } = require('../../../config.json');

async function checkUser(interaction) {
    if (interaction.member.roles.cache.get(roles.verified)) {
        await interaction.editReply(':no_entry: Du hast deinen Apex Legends Account bereits verifiziert.');
        return;
    }

    const data = {
        interaction,
        platform: interaction.options.getString('platform'),
        name: interaction.options.getString('name'),
    };

    return data;
}

async function getApexPlayer(data) {
    if (!data || !data.interaction || !data.name || !data.platform) return;

    const { interaction, name, platform } = data;
    const url = `https://api.mozambiquehe.re/bridge?auth=${APEXSTATUS_API_KEY}&player=${name}&platform=${platform}`;
    const apexPlayer = await axios.get(url, { transformResponse: res => { return jsonBig().parse(res); } })
        .catch(() => { return false; });

    if (!apexPlayer || apexPlayer.data.Error) {
        await interaction.editReply(':no_entry: Der Apex Legends Account konnte nicht gefunden werden.');
        return;
    }

    data.apex = apexPlayer.data;

    return data;
}

async function checkIfTaken(data) {
    if (!data || !data.apex) return;

    const { interaction, apex: { global: apex } } = data;
    const isTaken = await Users.findOne({ where: { apex_uid: apex.uid.toString() } }).catch(() => { return false; });

    if (isTaken) {
        await interaction.editReply(':no_entry: Der Apex Legends Account wurde schon mit einem anderen Server Member verknüpft.');
        return;
    }

    return data;
}

function getLegendsOrder(data) {
    if (!data || !data.apex) return;

    let legendOrder = ['Bloodhound', 'Gibraltar', 'Lifeline', 'Pathfinder', 'Wraith', 'Bangalore'];
    const { selectedLegend } = data.apex.realtime;

    legendOrder.splice(legendOrder.indexOf(selectedLegend), 1);
    legendOrder = legendOrder.sort(() => Math.random() - 0.5).slice(0, 3);

    data.verification = {
        legendOrder,
        selectedLegend,
        step: 0,
    };

    return data;
}

async function sendStepMessage(data) {
    if (!data || !data.interaction || !data.apex) return;

    const { interaction, verification: { selectedLegend, legendOrder, step } } = data;

    const components = [];

    if (step < 2) {
        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('check')
                        .setLabel(`Weiter (${step + 1}/2)`)
                        .setStyle(ButtonStyle.Primary)),
        );
    }

    if (step === 2) {
        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('check')
                        .setLabel('Verifizierung abschließen')
                        .setStyle(ButtonStyle.Success)),
        );
    }

    data.interaction.message = await interaction.editReply({ content: `:twisted_rightwards_arrows: Du hast gerade **${selectedLegend}** ausgewählt, bitte wechsle zu **${legendOrder[step]}**.`, components: components }).then(msg => { return msg; });

    return data;
}

async function createUser(data) {
    if (!data || !data.apex) return;

    const { interaction: { user }, apex: { global: apex } } = data;

    const newUser = await Users.create({
        id: user.id,
        name: user.tag,
        apex_uid: apex.uid.toString(),
        apex_name: apex.name,
        apex_platform: apex.platform,
        apex_level: apex.level,
        apex_prestige: apex.levelPrestige ? apex.levelPrestige : null,
        apex_rank_br: apex.rank.rankName,
        apex_rank_arena: apex.arena.rankName,
    });

    return newUser;
}

async function updateMember(data) {
    if (!data || !data.interaction || !data.apex) return;

    const { interaction: { member }, apex: { global: apex } } = data;

    const flooredLevel = (Math.floor(apex.level / 100) * 100);
    const levelRoleName = flooredLevel > 500 ? '500' : flooredLevel.toString();
    const brRank = apex.rank.rankName.toLowerCase();
    const arenaRank = apex.arena.rankName.toLowerCase();
    const memberRoles = [roles.apex_delimeter, roles.verified, roles.level[levelRoleName], roles.platforms[apex.platform]];

    if (brRank !== 'unranked') memberRoles.push(roles.br_ranks[brRank]);
    if (arenaRank !== 'unranked') memberRoles.push(roles.arena_ranks[arenaRank]);
    if (apex.levelPrestige) memberRoles.push(roles.prestige[apex.levelPrestige]);

    return await member.roles.add(Object.values(memberRoles));
}

async function checkIfDone(data) {
    if (!data || !data.interaction || !data.verification) return;

    const { interaction, verification: { step } } = data;

    if (step > 0 && step < 3) {
        await sendStepMessage(data);
        await verifyAccount(data);
    }

    if (step > 2) {
        await createUser(data);
        await updateMember(data);
        await interaction.editReply({ content: ':white_check_mark: Dein Apex Legends Account wurde erfolgreich verifiziert.', components: [] });
        return;
    }

    return data;
}

async function checkLegend(data) {
    if (!data || !data.verification || !data.apex) return;

    const { verification: { selectedLegend, legendOrder, step }, apex: { realtime } } = data;

    if (realtime.selectedLegend === selectedLegend) {
        verifyAccount(data);
        return;
    }

    data.verification.selectedLegend = realtime.selectedLegend;

    if (realtime.selectedLegend !== legendOrder[step]) {
        await sendStepMessage(data).then(newData => verifyAccount(newData));
        return;
    }

    data.verification.step++;
    checkIfDone(data);

    return;
}

async function verifyAccount(data) {
    if (!data || !data.interaction || !data.apex) return;

    const { interaction } = data;
    const { message, user } = interaction;
    const filter = i => i.user.id === user.id;

    await message.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 2 * 60 * 1000 })
        .then(i => {
            i.deferUpdate();
            data.interaction = i;
        })
        .then(() => getApexPlayer(data))
        .then(newData => checkLegend(newData))
        .catch(async () => {
            await interaction.editReply({ content: ':alarm_clock: Die Zeit für die Antwort ist abgelaufen. Bitte versuche es erneut.', embeds: [], components: [] });
            return;
        });
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    checkUser(interaction)
        .then(data => getApexPlayer(data))
        .then(data => checkIfTaken(data))
        .then(data => getLegendsOrder(data))
        .then(data => sendStepMessage(data))
        .then(data => verifyAccount(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};