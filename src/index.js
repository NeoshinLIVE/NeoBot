require('dotenv').config();
const path = require('node:path');
const recursive = require('recursive-readdir');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { ready, interactionCreate, guildMemberUpdate } = require('./client-events');
const { DISCORD_BOT_TOKEN } = process.env;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildBans] });

function onlyJsFiles(file) {
    return !file.endsWith('.js');
}

function prepareClient() {
    // Preparing commands
    client.commands = new Collection();
    recursive(path.join(__dirname, 'commands'), [onlyJsFiles], (err, files) => {
        if (err) {
            console.log(err);
            return;
        }

        files.map(filepath => {
            const command = require(filepath);
            client.commands.set(command.data.name, command);
        });
    });

    // Preparing interaction for buttons
    client.buttons = new Collection();
    recursive(path.join(__dirname, 'interactions/buttons'), (err, files) => {
        if (err) {
            console.log(err);
            return;
        }

        files.map(filepath => {
            const button = require(filepath);
            client.buttons.set(button.data.customId, button);
        });
    });

    // Preparing interaction for select menus
    client.selectMenus = new Collection();
    recursive(path.join(__dirname, 'interactions/select-menus'), (err, files) => {
        if (err) {
            console.log(err);
            return;
        }

        files.map(filepath => {
            const selectMenu = require(filepath);
            client.selectMenus.set(selectMenu.data.customId, selectMenu);
        });
    });
}

prepareClient();

client.on('ready', () => ready(client));
client.on('interactionCreate', async interaction => interactionCreate(client, interaction));
client.on('guildMemberUpdate', async (oldMember, newMember) => guildMemberUpdate(client, oldMember, newMember));

client.login(DISCORD_BOT_TOKEN);