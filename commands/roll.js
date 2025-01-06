const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll one or more dice with modifiers')
        .addStringOption(option =>
            option.setName('dice')
                .setDescription('Dice notation (e.g., 2d6+5, 1d20+2d4-3)')
                .setRequired(true)),

    async execute(interaction) {
        let diceNotation = interaction.options.getString('dice').toLowerCase().replace(/\s+/g, '');
        
        // Handle starting with a negative
        if (diceNotation.startsWith('-')) {
            diceNotation = '0' + diceNotation;
        }
        
        // Split the input into parts (dice sets and modifiers)
        const parts = diceNotation.split(/([+-])/);
        let total = 0;
        const rollResults = [];

        // Process each part
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            const operator = i > 0 ? parts[i - 1] : '+';

            if (part === '+' || part === '-') continue;
            if (part === '0' && i === 0) continue; // Skip the added leading zero

            // Check if it's a dice roll or a static modifier
            const diceRegex = /^(\d+)d(\d+)$/;
            const match = part.match(diceRegex);

            if (match) {
                // Handle dice roll
                const numberOfDice = parseInt(match[1]);
                const numberOfSides = parseInt(match[2]);

                if (numberOfDice < 1 || numberOfSides < 2) {
                    return interaction.reply({
                        content: 'Invalid dice values! You need at least 1 die with 2 or more sides.',
                        ephemeral: true
                    });
                }

                // Roll the dice
                const rolls = [];
                let subtotal = 0;

                for (let j = 0; j < numberOfDice; j++) {
                    const roll = Math.floor(Math.random() * numberOfSides) + 1;
                    rolls.push(roll);
                    subtotal += roll;
                }

                rollResults.push({
                    notation: part,
                    rolls,
                    subtotal,
                    operator
                });

                total += (operator === '+' ? subtotal : -subtotal);
            } else if (/^\d+$/.test(part)) {
                // Handle static modifier
                const modifier = parseInt(part);
                rollResults.push({
                    notation: part,
                    modifier: true,
                    operator
                });
                total += (operator === '+' ? modifier : -modifier);
            } else {
                return interaction.reply({
                    content: 'Invalid dice notation! Please use format: `XdY±Z` (e.g., 2d6+5 or 1d20+2d4-3)',
                    ephemeral: true
                });
            }
        }

        // Format the response
        let displayNotation = diceNotation;
        if (displayNotation.startsWith('0-')) {
            displayNotation = displayNotation.substring(1);
        }
        
        // Add spaces around operators in display notation
        displayNotation = displayNotation.replace(/([+-])/g, ' $1 ').trim();
        
        let response = `## 🎲 Rolling ${displayNotation}:\n`;
        
        // Add detailed breakdown
        rollResults.forEach((result, index) => {
            if (result.modifier) {
                response += `${index === 0 && result.operator === '+' ? '' : result.operator}${result.notation}\n`;
            } else {
                response += `${index === 0 && result.operator === '+' ? '' : result.operator}${result.notation}: ${index === 0 && result.operator === '+' ? '' : result.operator}${result.subtotal}\n`;
            }
        });

        response += `## Total: ${total}`;

        await interaction.reply(response);
    },
};
