require('dotenv').config();
const { Client } = require("discord.js");
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [] });

// Function to get all command data
function getAllCommands() {
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    return commandFiles
        .map(file => {
            const command = require(path.join(commandsPath, file));
            // Skip commands that require ManageGuild permission
            if (command.data.default_member_permissions === '32') {
                return null;
            }
            return command.data.toJSON();
        })
        .filter(cmd => cmd !== null); // Remove null entries
}

client.once("ready", async () => {
    const commands = getAllCommands();
    
    try {
        // Deploy globally
        console.log('Deploying commands globally...');
        await client.application.commands.set(commands);
        console.log('Global deployment complete!');

        // Deploy to test guild
        console.log('Deploying commands to test guild...');
        const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID);
        await guild.commands.set(commands);
        console.log('Guild deployment complete!');

        // Undeploy from test guild
        console.log('Undeploying commands from test guild...');
        await guild.commands.set([]);
        console.log('Guild undeploy complete!');

    } catch (error) {
        console.error('Error during deployment:', error);
    }

    console.log('All operations complete!');
    process.exit(0);
});

client.login(process.env.TOKEN);