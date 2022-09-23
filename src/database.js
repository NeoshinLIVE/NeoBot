const Sequelize = require('sequelize');
const sequelize = new Sequelize('database', 'user', 'password', {
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    storage: 'database.sqlite',
});

const Users = sequelize.define('users', {
    id: {
        type: Sequelize.STRING,
        unique: true,
        primaryKey: true,
    },
    name: Sequelize.STRING,
    apex_uid: Sequelize.STRING,
    apex_name: Sequelize.STRING,
    apex_platform: Sequelize.STRING,
    apex_level: Sequelize.INTEGER,
    apex_prestige: Sequelize.INTEGER,
    apex_rank_br: Sequelize.STRING,
    apex_rank_arena: Sequelize.STRING,
    team_id: Sequelize.STRING,
    block_id: Sequelize.STRING,
    blacklist_id: Sequelize.STRING,
});

/**
 * Status
 * OPEN     - The team is open and in active use
 * BLOCKED  - The team and it's channels are hidden, but can be reactivated (can't attend events)
 * CLOSED   - The team was closed by an admin or the team owner but can be reactivated (channels are deleted)
 *
 * Team Type
 * TEMP     - A temporary team that can be created only for a single event and will expire after it
 * PERM     - A permanent team that can be created only by a user that boosted the server and will expire 7 days after the user revoked the boost
 */
const Teams = sequelize.define('teams', {
    id: {
        type: Sequelize.INTEGER,
        unique: true,
        primaryKey: true,
        autoIncrement: true,
    },
    status: {
        type: Sequelize.STRING,
        defaultValue: 'OPEN',
    },
    type: Sequelize.STRING,
    name: Sequelize.STRING,
    description: Sequelize.STRING,
    logo_url: Sequelize.STRING,
    leader_id: Sequelize.STRING,
    members: Sequelize.STRING,
    text_id: Sequelize.STRING,
    voice_id: Sequelize.STRING,
    events_planed: Sequelize.STRING,
    events_history: Sequelize.STRING,
    block_id: Sequelize.STRING,
    expires: Sequelize.DATE,
});

const TIEDate = new Date();
TIEDate.setDate(TIEDate.getDate() + 7);
const TeamInvites = sequelize.define('team_invites', {
    id: {
        type: Sequelize.INTEGER,
        unique: true,
        primaryKey: true,
        autoIncrement: true,
    },
    uid: Sequelize.STRING,
    team_id: Sequelize.INTEGER,
    inviter_uid: Sequelize.STRING,
    blocked: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    expires: {
        type: Sequelize.DATE,
        defaultValue: TIEDate,
    },
});

/**
 * Event Status
 * DRAFT    - Only visible to Admins/Mods (Teams can't register)
 * PUBLIC   - Public and visible by everyone (Teams can register)
 * CANCELED - Tournament was canceled
 * ENDED    - The Tournament has ended
 */
const Events = sequelize.define('events', {
    id: {
        type: Sequelize.INTEGER,
        unique: true,
        primaryKey: true,
        autoIncrement: true,
    },
    status: {
        type: Sequelize.STRING,
        defaultValue: 'DRAFT',
    },
    name: Sequelize.STRING,
    price: Sequelize.STRING,
    format: Sequelize.STRING,
    description: Sequelize.TEXT,
    banner_url: Sequelize.STRING,
    start_date: Sequelize.DATE,
    teams_list: Sequelize.STRING,
    max_teams: Sequelize.INTEGER,
    channel_id: Sequelize.STRING,
    message_id: Sequelize.STRING,
    guild_event_id: Sequelize.STRING,
});

const Blocklist = sequelize.define('blocklist', {
    id: {
        type: Sequelize.INTEGER,
        unique: true,
        primaryKey: true,
        autoIncrement: true,
    },
    uid: Sequelize.STRING,
    team_id: Sequelize.STRING,
    duration: Sequelize.DATE,
    reason: Sequelize.STRING,
    admin_uid: Sequelize.STRING,
});

const Blacklist = sequelize.define('blacklist', {
    id: {
        type: Sequelize.INTEGER,
        unique: true,
        primaryKey: true,
        autoIncrement: true,
    },
    uid: Sequelize.STRING,
    reason: Sequelize.STRING,
    admin_uid: Sequelize.STRING,
});

module.exports.Users = Users;
module.exports.Teams = Teams;
module.exports.TeamInvites = TeamInvites;
module.exports.Events = Events;
module.exports.syncTables = () => {
    Users.sync();
    Teams.sync();
    TeamInvites.sync();
    Events.sync();
    Blocklist.sync();
    Blacklist.sync();
};