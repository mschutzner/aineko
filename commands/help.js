const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const utils = require('../utils.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows a list of available commands')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('Get detailed information about a specific command')
                .setRequired(false)),
    help: `Displays information about available commands.
    
Usage:
\`/help\` - Shows a list of all available commands
\`/help <command>\` - Shows detailed information about a specific command

The command list is paginated if there are many commands. Use the Previous/Next buttons to navigate through pages.`,
    async execute(interaction, pool) {
        const commandName = interaction.options.getString('command');
        const commands = interaction.client.commands;

        // If a specific command is requested
        if (commandName) {
            const command = commands.get(commandName);
            
            if (!command) {
                return interaction.reply({ 
                    content: `❌ Command \`${commandName}\` not found.`, 
                    ephemeral: true 
                });
            }

            const commandEmbed = {
                color: 0x0099FF,
                title: `Command: /${command.data.name}`,
                description: command.help || command.data.description || 'No description available',
                fields: [],
                footer: {
                    text: 'Use / followed by the command name to execute a command'
                }
            };

            // Add image if it exists
            if (command.image) {
                commandEmbed.image = {
                    url: command.image
                };
            }

            // Add cat information if it exists
            if (command.catId) {
                const conn = await pool.getConnection();
                try {
                    const [catRows] = await conn.query('SELECT * FROM `cat` WHERE `_id` = ?;', [command.catId]);
                    conn.release();
                    
                    if (catRows.length > 0) {
                        commandEmbed.fields.push({
                            name: 'Required Cat',
                            value: catRows[0].name,
                            inline: true
                        });
                    }
                } catch (error) {
                    console.error('Error fetching cat information:', error);
                }
            }

            // Add cooldown information if it exists
            if (command.cooldown) {
                commandEmbed.fields.push({
                    name: 'Cooldown',
                    value: utils.formatDuration(command.cooldown),
                    inline: true
                });
            }

            const embeds = [commandEmbed];

            // Get command options and subcommands
            const options = command.data.options;
            if (options?.length > 0) {
                const subcommands = options.filter(opt => !opt.hasOwnProperty('type'));
                const regularOptions = options.filter(opt => opt.hasOwnProperty('type'));

                // Handle subcommands if they exist
                if (subcommands.length > 0) {
                    const subcommandsEmbed = {
                        color: 0x0099FF,
                        title: 'Subcommands',
                        fields: []
                    };

                    subcommands.forEach(subcmd => {
                        let subcommandDetails = '';
                        
                        // Format usage
                        subcommandDetails += `**Usage:** \`/${command.data.name} ${subcmd.name}\`\n`;
                        subcommandDetails += `**Description:** ${subcmd.description}\n`;

                        // Add subcommand options if they exist
                        if (subcmd.options?.length > 0) {
                            subcommandDetails += '\n**Parameters:**\n' + subcmd.options
                                .map(opt => `• \`${opt.name}\` - ${opt.description}${opt.required ? ' (Required)' : ''}`)
                                .join('\n');
                        }

                        subcommandsEmbed.fields.push({
                            name: subcmd.name,
                            value: subcommandDetails,
                            inline: false
                        });
                    });

                    embeds.push(subcommandsEmbed);
                }

                // Handle regular options if they exist
                if (regularOptions.length > 0) {
                    const optionsEmbed = {
                        color: 0x0099FF,
                        title: 'Options',
                        fields: []
                    };

                    regularOptions.forEach(option => {
                        let optionDetails = '';
                        
                        // Add basic option info
                        optionDetails += `Required: ${option.required ? 'Yes' : 'No'}\n`;
                        
                        // Add min/max if they exist
                        if (option.min_value !== undefined) {
                            optionDetails += `Minimum: ${option.min_value}\n`;
                        }
                        if (option.max_value !== undefined) {
                            optionDetails += `Maximum: ${option.max_value}\n`;
                        }
                        
                        // Add choices if they exist
                        if (option.choices?.length > 0) {
                            optionDetails += `**Choices:**\n${option.choices
                                .map(choice => `• ${choice.name}`)
                                .join('\n')}`;
                        }

                        optionsEmbed.fields.push({
                            name: `${option.name}`,
                            value: `${option.description}\n${optionDetails}`,
                            inline: false
                        });
                    });

                    embeds.push(optionsEmbed);
                }
            }

            return interaction.reply({ embeds: embeds });
        }

        // For listing all commands with pagination
        const commandList = Array.from(commands.values())
            .filter(command => {
                // Skip commands that require ManageGuild permission
                const permissions = command.data.default_member_permissions;
                return !permissions || !(BigInt(permissions) & BigInt(0x20)); // 0x20 is ManageGuild permission
            })
            .map(command => `**/${command.data.name}** - ${command.data.description}`);
        
        const itemsPerPage = 10;
        const pages = [];
        
        // Split commands into pages
        for (let i = 0; i < commandList.length; i += itemsPerPage) {
            pages.push(commandList.slice(i, i + itemsPerPage).join('\n'));
        }

        let currentPage = 0;

        const botInfoEmbed = {
            color: 0x0099FF,
            title: '🐱 Say hello to Aineko!',
            description: 'Collect cats, earn scritch bucks (represented by ฅ), play casino games, and more! Administrators can go to [Aineko.gg](https://aineko.gg) for a control panel to manage the bot.',
        };

        const commandsEmbed = (page) => ({
            color: 0x0099FF,
            title: '📚 Available Commands',
            description: 'Use `/help <command>` for detailed information about a specific command.',
            fields: [{
                name: `Commands (Page ${page + 1}/${pages.length})`,
                value: pages[page]
            }],
            footer: {
                text: 'Use / followed by the command name to execute a command'
            }
        });

        // Create navigation buttons
        const getButtons = (currentPage) => {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === pages.length - 1)
            );
            return row;
        };

        const response = await interaction.reply({
            embeds: [botInfoEmbed, commandsEmbed(currentPage)],
            components: pages.length > 1 ? [getButtons(currentPage)] : []
        });

        // Only create collector if there are multiple pages
        if (pages.length > 1) {
            const collector = response.createMessageComponentCollector({ 
                filter: i => i.user.id === interaction.user.id 
            });

            collector.on('collect', async i => {
                if (i.customId === 'prev') {
                    currentPage--;
                } else if (i.customId === 'next') {
                    currentPage++;
                }

                await i.update({
                    embeds: [botInfoEmbed, commandsEmbed(currentPage)],
                    components: [getButtons(currentPage)]
                });
            });

            collector.on('end', async () => {
                // Remove buttons when collector expires
                await interaction.editReply({
                    components: []
                }).catch(() => {});
            });
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const commands = interaction.client.commands;
        const choices = Array.from(commands.keys());
        
        const filtered = choices.filter(choice => 
            choice.toLowerCase().startsWith(focusedValue.toLowerCase())
        );
        
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice })).slice(0, 25)
        );
    }
};
