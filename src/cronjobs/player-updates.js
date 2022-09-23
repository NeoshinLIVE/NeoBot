require('dotenv').config();
const axios = require('axios');
const { roles } = require('../../config.json');
const { Users } = require('../database');
const { DISCORD_GUILD_ID, APEXSTATUS_API_KEY } = process.env;

module.exports = async function(client) {
    const guild = client.guilds.cache.find(g => g.id === DISCORD_GUILD_ID);

    await Users.findAll().then(users => {
        users.forEach((user, i) => {
            setTimeout(async () => {
                const { id, apex_uid, apex_platform, apex_level, apex_prestige, apex_rank_br, apex_rank_arena } = user;
                const member = await guild.members.fetch(id).catch(() => { return false; });

                if (!member) return;

                await axios.get(`https://api.mozambiquehe.re/bridge?auth=${APEXSTATUS_API_KEY}&uid=${apex_uid}&platform=${apex_platform}`)
                    .then(async res => {
                        const { name, level, rank, arena } = res.data.global;
                        let update = false;
                        const removeRoles = [];
                        const addRoles = [];
                        let prestige = 0;

                        if (user.name != member.user.tag) update = true;

                        // Check if BR rank changed
                        if (rank.rankName !== apex_rank_br) {
                            update = true;
                            removeRoles.push(roles.br_ranks[apex_rank_br.toLowerCase()]);
                            addRoles.push(roles.br_ranks[rank.rankName.toLowerCase()]);
                        }

                        // Check if Arena rank changed
                        if (arena.rankName !== apex_rank_arena) {
                            update = true;
                            removeRoles.push(roles.arena_ranks[apex_rank_arena.toLowerCase()]);
                            addRoles.push(roles.arena_ranks[arena.rankName.toLowerCase()]);
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

                            if (res.data.global.levelPrestige && apex_prestige < res.data.global.levelPrestige) {
                                prestige = res.data.global.levelPrestige;
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

                            console.log(`[${i}] Updated ${member.user.tag}`);
                            return member;
                        }
                    })
                    .catch(err => console.log(err));
            }, 5000 * i);
        });
    });
};