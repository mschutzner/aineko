const args = process.argv.slice(2);
if(!args[0]) throw('No arguments found. Please supply a command name and deploy type to deploy.');
if(!args[1]) throw('Argument two must be either "global" or "guild".');

const commandName = args[0].toLowerCase();
const deployType = args[1].toLowerCase();

if(deployType !== "global" && deployType !== "guild" && deployType !== "domain") throw('Argument two must be either "global", "guild", ir "domain".');

require('dotenv').config();
const { Client } = require("discord.js");
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [] });

// Function to get all command names
function getAllCommandNames() {
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    return commandFiles
        .map(file => {
            const command = require(path.join(commandsPath, file));
            // Skip commands that require ManageGuild permission
            if (command.data.default_member_permissions === '32') {
                return null;
            }
            return path.parse(file).name;
        })
        .filter(name => name !== null); // Remove null entries
}

// If commandName is "help", we'll modify the command to include choices
let command;
if (commandName === "help") {
    command = require(`../commands/${commandName}.js`);
    const choices = getAllCommandNames().map(name => ({
        name: name,
        value: name
    }));
    command.data.options[0].addChoices(...choices);
} else {
    command = require(`../commands/${commandName}.js`);
}

if(!command) throw('Command not found.');

client.once("ready", async () => {
    if(deployType === "domain"){
        const guild = await client.guilds.fetch('515742178216116226');
        await guild.commands.create(command.data.toJSON());
    } else if(deployType === "guild"){
        const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID);
        guild.commands.create(command.data.toJSON());
    } else if(deployType === "global"){
        client.application.commands.create(command.data.toJSON());
    }
    console.log('done');
});

client.login(process.env.TOKEN);