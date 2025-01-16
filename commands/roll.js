const { SlashCommandBuilder } = require('discord.js');

const DISCORD_LIMIT = 1900;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll dice using standard dice notation')
        .addStringOption(option =>
            option.setName('dice')
                .setDescription('Dice notation (e.g., 2d6+5, 1d20, [highest 1 of 2d20])')
                .setRequired(true)),
    help: `Roll dice using standard dice notation. Supports multiple expressions separated by commas.

Basic Usage:
- \`/roll 2d6\` - Roll two six-sided dice
- \`/roll 1d20+5\` - Roll one twenty-sided die and add 5
- \`/roll 4d6, 3d8\` - Roll multiple sets of dice

Advanced Features:
- Highest/Lowest: \`[highest N of X]\` or \`[lowest N of X]\`
  Examples:
  - \`/roll [lowest 1 of 2d20]\` - Roll with disadvantage
  - \`/roll [highest 3 of 4d6]\` - Roll 4d6 drop the lowest
  - \`/roll [highest 2 of 2d8, 2d12, 2d20]\` - Roll all three and keep the highest 2 totals
  - \`/roll [highest 1 of 1d20, 10]\` - Roll 1d20 with a minimum of 10

- Parentheses for order of operations:
  - \`/roll 2d6+3*2\` - Roll 2d6, add 6
  - \`/roll (2d6+3)*2\` - Roll 2d6, add 3, then multiply by 2

Notes:
- All decimal results are rounded down
- Results over 2,000 characters will be truncated
- Nested functions are not supported`,
    async execute(interaction, pool) {
        let diceNotation = interaction.options.getString('dice').toLowerCase();
        
        try {
            // Handle starting with a negative
            if (diceNotation.startsWith('-')) {
                diceNotation = '0' + diceNotation;
            }

            // Split by commas and evaluate each expression
            const splitExpressions = (input) => {
                const expressions = [];
                let currentExpr = '';
                let bracketDepth = 0;

                for (let i = 0; i < input.length; i++) {
                    const char = input[i];
                    
                    if (char === '[') bracketDepth++;
                    else if (char === ']') bracketDepth--;
                    
                    if (char === ',' && bracketDepth === 0) {
                        expressions.push(currentExpr.trim());
                        currentExpr = '';
                    } else {
                        currentExpr += char;
                    }
                }
                
                if (currentExpr) {
                    expressions.push(currentExpr.trim());
                }

                return expressions.filter(expr => expr.length > 0);
            };

            const expressions = splitExpressions(diceNotation);
            let finalResponse = `## Input: ${diceNotation}\n`;
            let grandTotal = 0;
            let isResponseTruncated = false;

            // Space needed for truncation message and grand total
            const truncationSpace = '\n\n[... more rolls truncated...]'.length;
            const grandTotalSpace = expressions.length > 1 ? '\n\n## Grand Total: 999999'.length : 0;
            const reservedSpace = truncationSpace + grandTotalSpace;
            
            // Process each expression
            let firstAdvOrDisadv = true;
            for (let i = 0; i < expressions.length; i++) {
                const expr = expressions[i] || '';
                const normalizedExpr = expr.startsWith('-') ? '0' + expr : expr;
                const result = await evaluateExpression(interaction, pool, normalizedExpr, firstAdvOrDisadv, Math.floor((DISCORD_LIMIT - reservedSpace) / expressions.length));
                firstAdvOrDisadv = result.firstAdvOrDisadv;

                // Check if adding this result would exceed the limit
                const newContent = result.response + 
                    (i < expressions.length - 1 ? '\n\n---\n' : '');

                if (!isResponseTruncated && 
                    (finalResponse.length + newContent.length + reservedSpace > DISCORD_LIMIT)) {
                    isResponseTruncated = true;
                    finalResponse += `\n\n[${expressions.length - i} more rolls truncated...]`;
                    break;
                }

                if (!isResponseTruncated) {
                    finalResponse += result.response;
                    grandTotal += result.total;

                    if (i < expressions.length - 1) {
                        finalResponse += '\n\n---\n';
                    }
                }
            }

            // Add grand total if there are multiple expressions
            if (expressions.length > 1) {
                finalResponse += `\n\n## Grand Total: ${grandTotal}`;
            }

            await interaction.reply(finalResponse);
        } catch (error) {
            await interaction.reply({
                content: `Error: ${error.message}`,
                ephemeral: true
            });
        }
    },
};

function getMaxRollsToShow(rolls, prefix, suffix, limit) {
    let str = prefix;
    let count = 0;
    
    // Always show at least 4 dice if we have them
    const minDice = Math.min(4, rolls.length);
    
    for (let i = 0; i < rolls.length; i++) {
        const nextNum = rolls[i].toString();
        const addition = (i === 0 ? '' : ', ') + nextNum;
        
        // If we haven't reached minimum dice, add regardless of space
        if (i < minDice) {
            str += addition;
            count++;
            continue;
        }
        
        // After minimum dice, only add if we have space
        if (str.length + addition.length + suffix.length > limit) {
            break;
        }
        
        str += addition;
        count++;
    }
    
    return count;
}

async function evaluateExpression(interaction, pool, expression, firstAdvOrDisadv, charLimit = DISCORD_LIMIT) {
    let total = 0;
    let response = '';
    const rollResults = [];

    // Handle parentheses first
    while (expression.includes('(')) {
        const lastOpenParen = expression.lastIndexOf('(');
        const nextCloseParen = expression.indexOf(')', lastOpenParen);
        if (nextCloseParen === -1) throw new Error('Mismatched parentheses');

        const subExpr = expression.substring(lastOpenParen + 1, nextCloseParen);
        const subResult = await evaluateExpression(pool, subExpr, firstAdvOrDisadv, Math.floor(charLimit / 8));
        firstAdvOrDisadv = subResult.firstAdvOrDisadv;
        
        expression = expression.substring(0, lastOpenParen) + 
                    subResult.total +
                    expression.substring(nextCloseParen + 1);
        
        // Add a concise version of the subexpression result
        const subResponse = subResult.response
            .replace(/^## 🎲 Rolling:\n/, '') // Remove the header
            .replace(/\n## Total: \d+$/, ''); // Remove the total line
        response += `(${subExpr}): ${subResponse}\n`;
    }

    // Handle highest/lowest selections
    const highLowRegex = /\[(highest|lowest)\s+(\d+)\s+of\s+([^\]]+)\]/g;
    let match;
    while ((match = highLowRegex.exec(expression)) !== null) {
        const type = match[1]; // 'highest' or 'lowest'
        const count = parseInt(match[2]); // The number of dice to keep
        const dice = match[3]; // The dice notation

        const result = rollHighLow(dice, type, count);

        // Check for advantage/disadvantage pattern (nd20 or multiple 1d20)
        const isAdvOrDisadv = (type === 'highest' || type === 'lowest') && 
                              (/[2-9]+d20/.test(dice) || // matches 2d20, 3d20, etc.
                               (dice.split(/\s*,\s*/).every(d => d.trim() === '1d20') && // all parts must be 1d20
                                dice.split(/\s*,\s*/).length >= 2)); // and there must be at least 2
        if (isAdvOrDisadv && firstAdvOrDisadv) {
            firstAdvOrDisadv = false;
            // Check for two natural 20s
            if (result.rolls.every(roll => roll === 20)) {
                const conn = await pool.getConnection();
                try {
                    // Give the Djinn cat to user
                    const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
                        [interaction.member.id, 10, interaction.member.displayName, 'Djinn']);
                    if (userCatDB[0].affectedRows) {
                        await interaction.channel.send({
                            content: `${interaction.member.toString()} just gained ownership of Djinn by getting all natural 20s on their first ${type === 'highest' ? 'advantage' : 'disadvantage'} roll! This unlocks the \`/wish\` command.`,
                            files: ['images/cats/Djinn.jpg']
                        });
                    }
                } finally {
                    // Release pool connection
                    conn.release();
                }
            }
        }

        response += result.breakdown + '\n';
        expression = expression.replace(match[0], result.total);
    }

    // Split by operators, preserving operators
    const parts = expression.split(/([+\-*/])/);
    
    // First pass: handle multiplication and division
    let mdParts = [];
    let currentTerm = null;
    let currentOperator = '+';

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (!part) continue;
        
        if (['+', '-'].includes(part)) {
            if (currentTerm !== null) {
                mdParts.push(currentTerm);
                mdParts.push(part);
                currentTerm = null;
            } else {
                mdParts.push(part);
            }
            continue;
        }

        if (['*', '/'].includes(part)) {
            currentOperator = part;
            continue;
        }

        // Process the number or dice roll
        let value;
        let rollText = '';
        
        const diceRegex = /^(\d+)d(\d+)$/;
        const match = part.match(diceRegex);

        if (match) {
            const result = rollDice(parseInt(match[1]), parseInt(match[2]));
            rollResults.push({ ...result, operator: currentOperator });
            value = result.subtotal;
            
            // Format rolls with maximum possible dice
            rollText = `${currentOperator === '+' && i === 0 ? '' : currentOperator}${part}: [`;
            const maxRolls = getMaxRollsToShow(
                result.rolls,
                rollText,
                `...] = ${result.subtotal}\n`,
                Math.floor(charLimit / 2)
            );
            
            rollText += result.rolls.slice(0, maxRolls).join(', ');
            if (maxRolls < result.rolls.length) {
                rollText += '...';
            }
            rollText += `] = ${result.subtotal}\n`;
        } else if (/^-?\d+\.?\d*$/.test(part)) {
            value = parseFloat(part);
            rollText = `${currentOperator === '+' && i === 0 ? '' : currentOperator}${part}\n`;
        } else {
            throw new Error('Invalid dice notation! Please use format: XdY±Z, [highest/lowest N of XdY], or (expression)');
        }

        response += rollText;

        if (currentTerm === null) {
            currentTerm = value;
        } else {
            currentTerm = calculateWithOperator(currentTerm, value, currentOperator);
        }
    }

    if (currentTerm !== null) {
        mdParts.push(currentTerm);
    }

    // Second pass: handle addition and subtraction
    total = mdParts[0] || 0;
    for (let i = 1; i < mdParts.length; i += 2) {
        const operator = mdParts[i];
        const value = mdParts[i + 1];
        total = calculateWithOperator(total, value, operator);
    }

    return {
        firstAdvOrDisadv,
        total,
        response: `## 🎲 Rolling:\n${response}---\n## Total: ${total}`
    };
}

function rollDice(count, sides) {
    if (count < 1 || sides < 2) {
        throw new Error('Invalid dice values! You need at least 1 die with 2 or more sides.');
    }

    const rolls = [];
    let subtotal = 0;

    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        subtotal += roll;
    }

    return { rolls, subtotal };
}

function rollHighLow(diceNotation, type, count) {
    // Remove any whitespace
    diceNotation = diceNotation.trim();
    
    // If there are no commas, treat as a single roll and select individual dice
    if (!diceNotation.includes(',')) {
        // Handle single number from nested evaluation
        if (/^-?\d+$/.test(diceNotation)) {
            const total = parseInt(diceNotation);
            return {
                total,
                breakdown: `[${type} ${count} of ${diceNotation}]:\n${diceNotation}\n`,
                rolls: [total] // Include the rolls for consistency
            };
        }

        // Parse single dice notation
        const match = diceNotation.match(/(\d+)d(\d+)/);
        if (!match) throw new Error('Invalid dice notation in highest/lowest selection');

        const diceCount = parseInt(match[1]);
        const sides = parseInt(match[2]);
        const result = rollDice(diceCount, sides);

        // Sort the individual dice rolls
        const sortedRolls = [...result.rolls].sort((a, b) => 
            type === 'highest' ? b - a : a - b
        );

        // If count exceeds available rolls, use all rolls
        const actualCount = Math.min(count, sortedRolls.length);
        const selectedRolls = sortedRolls.slice(0, actualCount);
        const total = selectedRolls.reduce((sum, roll) => sum + roll, 0);

        // Create breakdown
        let breakdown = `[${type} ${count} of ${diceNotation}]:\n`;
        breakdown += `Rolls: [${result.rolls.join(', ')}]\n`;
        breakdown += `Selected ${type}: [${selectedRolls.join(', ')}] = ${total}`;

        return { total, breakdown, rolls: result.rolls }; // Return the rolls
    }

    // Original logic for comma-separated expressions
    const diceExpressions = diceNotation.split(/\s*,\s*/);
    let allResults = [];
    let breakdown = `[${type} ${count} of ${diceNotation}]:\n`;
    let allRolls = []; // Array to hold all rolls from each expression

    // Roll each dice expression separately
    for (const expr of diceExpressions) {
        let total, rolls;
        
        // Check if it's a number (from a nested evaluation)
        if (/^-?\d+$/.test(expr)) {
            total = parseInt(expr);
            breakdown += `${expr}: ${total}\n`;
            allResults.push({
                total: total,
                source: expr
            });
            allRolls.push(total); // Add to all rolls
            continue;
        }

        // Otherwise, treat as dice notation
        const match = expr.match(/(\d+)d(\d+)/);
        if (!match) throw new Error('Invalid dice notation in highest/lowest selection');

        const diceCount = parseInt(match[1]);
        const sides = parseInt(match[2]);
        const result = rollDice(diceCount, sides);
        
        // Add to breakdown with dice type label
        breakdown += `${expr}: [`;
        const maxInitialRolls = getMaxRollsToShow(
            result.rolls,
            `${expr}: [`,
            `...] = ${result.subtotal}\n`,
            DISCORD_LIMIT / 4
        );
        
        breakdown += result.rolls.slice(0, maxInitialRolls).join(', ');
        if (maxInitialRolls < result.rolls.length) {
            breakdown += '...';
        }
        breakdown += `] = ${result.subtotal}\n`;

        // Store the total result for this expression
        allResults.push({
            total: result.subtotal,
            source: expr
        });
        allRolls.push(...result.rolls); // Add all rolls from this expression
    }

    if (count > allResults.length) {
        // Use all results instead of throwing error
        count = allResults.length;
    }

    // Sort the totals
    const sortedResults = [...allResults].sort((a, b) => 
        type === 'highest' ? b.total - a.total : a.total - b.total
    );

    // Select the specified number of results
    const selectedResults = sortedResults.slice(0, count);
    const total = selectedResults.reduce((sum, {total}) => sum + total, 0);

    // Add selected results to breakdown
    breakdown += `Selected ${type}: [`;
    const selectedStr = selectedResults.map(({total, source}) => `${total} (${source})`).join(', ');
    breakdown += `${selectedStr}] = ${total}`;

    return {
        total,
        breakdown,
        rolls: allRolls // Return all rolls from the comma-separated scenario
    };
}

function calculateWithOperator(current, value, operator) {
    let result;
    switch (operator) {
        case '+': result = current + value; break;
        case '-': result = current - value; break;
        case '*': result = current * value; break;
        case '/': result = current / value; break;
        default: throw new Error('Invalid operator');
    }
    // Round down any floating point results
    return Math.floor(result);
}
