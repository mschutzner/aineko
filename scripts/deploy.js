const args = process.argv.slice(2);
if(!args[0]) throw('No arguments found. Please supply a command name and deploy type to deploy.');
if(!args[1]) throw('Argument two must be either "global" or "guild".');

const commandName = args[0].toLowerCase();
const deployType = args[1].toLowerCase();

if(deployType !== "global" && deployType !== "guild") throw('Argument two must be either "global" or "guild".')

require('dotenv').config();
const { Client } = require("discord.js");

const client = new Client({ intents: [] });

const command = require(`../commands/${commandName}.js`);
if(!command) throw('Command not found.');

client.once("ready", async () => {
    if(deployType === "guild"){
        const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID);
        guild.commands.create(command.data.toJSON());
    } else if(deployType === "global"){
        client.application.commands.create(command.data.toJSON());
    }
});

client.login(process.env.TOKEN);