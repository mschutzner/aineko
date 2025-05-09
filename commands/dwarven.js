const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { randInt } = require('../utils.js');


function getEmoji(emojis, name){
    try{
        return emojis.find(e => e.name === name).toString();
    } catch(e){
        console.error(`Emoji ${name} not found`);
        return name;
    }
}

function getD6Emoji(value, emojis){
    return getEmoji(emojis, ['d6_1', 'd6_2', 'd6_3', 'd6_4', 'd6_5', 'd6_6'][value-1]);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dwarven')
        .setDescription('Play Dwarven Dice - a game of chance that uses d6 dice (bones)!')
		.addSubcommand(subcommand =>
			subcommand
            .setName('dice')
            .setDescription('Play Dwarven Dice - a game of chance that uses d6 dice (bones)!')
            .addIntegerOption(option =>
                option.setName('buyin')
                    .setDescription('Amount of scritch bucks to enter the game (minimum 25)')
                    .setRequired(true)
                    .setMinValue(1))
            .addIntegerOption(option =>
                option.setName('bones')
                    .setDescription('Number of d6 dice (bones) to roll (1-9)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(9))),
    catId: 11, // Urist
    game: true,
    help: `## 🎲 Dwarven Dice
A game of chance where players and the houseroll d6 dice (bones) and try to get the highest total without rolling any 1s.
### How to Play
1. The host starts a game with \`/dwarven\` setting:
   - \`buyin\` - Amount of scritch bucks to enter (minimum 25)
   - \`bones\` - Number of d6 dice to roll (1-9)
2. The house always rolls 5 bones
3. Other players can join within one minuteand choose their own number of bones.
4. When the game starts, each player rolls their bones:
   - The goal is to get the highest total
   - Rolling a 1 on any die is a **BUST** - you lose!
   - If everyone busts, all players get their Buy-In back
5. Winning:
   - Player(s) with the highest total (who didn't bust) win
   - The pot is split evenly between winners
   - If there's an odd amount to split, the last winner gets the extra scritch buck
   - The house always wins if everyone busts
### Example
> Player 1 rolls 3 bones: 6, 4, 5 = 15
> Player 2 rolls 2 bones: 6, 1 = BUST
> Player 3 rolls 4 bones: 2, 6, 4 = 12

Player 1 wins with a total of 15!
### Strategy
- More bones = higher potential total but greater risk of rolling a 1
- Fewer bones = lower potential total but safer
- Choose your bones wisely!`,
    async execute(interaction, pool, emojis) {
        const buyin = interaction.options.getInteger('buyin');
        const bones = interaction.options.getInteger('bones');
        const channel = interaction.channel;

        if(buyin < 25) {
            return interaction.reply({
                content: "The minimum buy-in is 25 scritch bucks.",
                ephemeral: true
            });
        }

        // Get database connection
        const conn = await pool.getConnection();

        try {
            // Get user's current scritch bucks
            const userDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [interaction.member.id]);
            if(userDB[0].length === 0) {
                return interaction.reply({
                    content: "You don't exist in the database.",
                    ephemeral: true
                });
            }
            if(buyin > userDB[0][0].scritch_bucks) {
                return interaction.reply({
                    content: "You don't have enough scritch bucks.",
                    ephemeral: true
                });
            }

            // Add game to database
            await conn.query('INSERT INTO `game` (channel_id, game) VALUES (?, "dwarven dice");', [channel.id]);

            // Create buttons
            const joinButton = new ButtonBuilder()
                .setCustomId('join')
                .setLabel('Join')
                .setStyle(ButtonStyle.Primary);

            const startButton = new ButtonBuilder()
                .setCustomId('start')
                .setLabel('Start')
                .setStyle(ButtonStyle.Success);

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(joinButton, startButton, cancelButton);

            // Initial reply to start the game
            const startTime = Date.now();
            await interaction.reply({
                content: `🎲 **${interaction.member.toString()}** is starting a game of Dwarven Dice!\n` +
                    `Buy-In: ฅ${buyin}\n` +
                    `Pot: ฅ${buyin * 2}\n` +
                    `Game starts <t:${Math.ceil(startTime/1000)+62}:R> or when the host starts it\n` +
                    `## Players\n` +
                    `House 5 bones\n` +
                    `${interaction.member.toString()} ${bones} ${bones > 1 ? 'bones' : 'bone'}`,
                components: [row]
            });

            // Take Buy-In from initiator
            await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', 
                [buyin, interaction.member.id]);

            // Collection to store players
            const players = new Map();
            
            // Add house as a player with a special ID
            players.set('house', {
                member: {
                    id: 'house',
                    toString: () => '**House**',
                    user: { username: 'House' }
                },
                bones: 5
            });

            players.set(interaction.member.id, {
                member: interaction.member,
                bones: bones
            });
            

            // Create button collector
            const message = await interaction.fetchReply();
            const collector = message.createMessageComponentCollector({ 
                componentType: 2, // Button
                time: 60000 
            });

            collector.on('collect', async (i) => {                
                if (i.customId === 'cancel') {
                    // Only host can cancel
                    if (i.member.id !== interaction.member.id) {
                        i.reply({ 
                            content: "Only the host can cancel the game!", 
                            ephemeral: true 
                        });
                        return;
                    }
                    collector.stop('cancelled');
                    return;
                }
                
                if (i.customId === 'join') {
                    // Check if collector is still active
                    if (collector.ended) {
                        i.reply({ 
                            content: "It be too late to join!", 
                            ephemeral: true 
                        });
                        return;
                    }

                    // Check if player is host
                    if (i.member.id === interaction.member.id) {
                        i.reply({ 
                            content: "Ye already be the host!", 
                            ephemeral: true 
                        });
                        return;
                    }

                    // Check if already joined
                    if (players.has(i.member.id)) {
                        i.reply({ 
                            content: "Ye already be in the game!", 
                            ephemeral: true 
                        });
                        return;
                    }

                    // Create the modal
                    const modal = new ModalBuilder()
                        .setCustomId(`bones_modal-${i.id}`)
                        .setTitle('Choose Your Bones');

                    // Create the text input component
                    const bonesInput = new TextInputBuilder()
                        .setCustomId('bones_input')
                        .setLabel('How many bones will ye roll?')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('1-9')
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(1);

                    // Add the text input to the modal
                    const firstActionRow = new ActionRowBuilder().addComponents(bonesInput);
                    modal.addComponents(firstActionRow);

                    // Show the modal
                    await i.showModal(modal);

                    try {
                        const modalResponse = await i.awaitModalSubmit({
                            time: 60000,
                            filter: j => j.customId === `bones_modal-${i.id}`
                        }).catch(() => null);
                        
                        if (!modalResponse) return;

                        // Check again if collector is still active
                        if (collector.ended) {
                            await modalResponse.reply({ 
                                content: "It be too late to join!", 
                                ephemeral: true 
                            });
                            return;
                        }

                        const playerBones = parseInt(modalResponse.fields.getTextInputValue('bones_input'));
                        
                        if (isNaN(playerBones) || playerBones < 1 || playerBones > 9) {
                            await modalResponse.reply({ 
                                content: 'Ye must choose between 1 and 9 bones!', 
                                ephemeral: true 
                            });
                            return;
                        }

                        // Check if player has enough scritch bucks
                        const joinUserDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [i.member.id]);
                        if(joinUserDB[0].length === 0) {
                            i.reply({ 
                                content: "Ye don't exist in the database.", 
                                ephemeral: true 
                            });
                            return;
                        }
                        if(buyin > joinUserDB[0][0].scritch_bucks) {
                            i.reply({ 
                                content: "Ye don't have enough scritch bucks to join!", 
                                ephemeral: true 
                            });
                            return;
                        }

                        await modalResponse.deferUpdate();

                        // Take Buy-In from player
                        await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', 
                            [buyin, i.member.id]);

                        players.set(i.member.id, {
                            member: i.member,
                            bones: playerBones
                        });
                        
                        // Update the message with new player
                        await message.edit({
                            content: `🎲 **${interaction.member.toString()}** is starting a game of Dwarven Dice!\n` +
                                `Buy-In: ฅ${buyin}\n` +
                                `Pot: ฅ${buyin * players.size}\n` +
                                `Game starts <t:${Math.ceil(startTime/1000)+62}:R> or when the host starts it\n` +
                                `## Players\n` +
                                `${Array.from(players.values()).map(p => `${p.member.toString()} ${p.bones} bones`).join('\n')}`,
                            components: [row]
                        });

                        await channel.send(`${i.member.toString()} joins the game with ${playerBones} bones!`);
                    } catch (error) {
                        console.error('Modal interaction error:', error);
                    }
                }

                if (i.customId === 'start') {
                    // Only host can start
                    if (i.member.id !== interaction.member.id) {
                        i.reply({ 
                            content: "Only the host can start the game!", 
                            ephemeral: true 
                        });
                        return;
                    }

                    if (players.size < 2) {
                        i.reply({ 
                            content: "Need at least 2 players to start!", 
                            ephemeral: true 
                        });
                        return;
                    }

                    await i.deferUpdate();
                    collector.stop();
                    return;
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'cancelled') {
                    // Update original message
                    await message.edit({
                        content: `🎲 **${interaction.member.toString()}**'s game of Dwarven Dice was cancelled!\n` +
                            `## Players\n` +
                            `${Array.from(players.values()).map(p => `${p.member.toString()} ฅ${buyin} (refunded)`).join('\n')}`,
                        components: []
                    });

                    // Refund all players
                    for (const [userId, participant] of players) {
                        if(userId === 'house') continue;
                        const refundUserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [userId]);
                        const newAmount = refundUserDB[0][0].scritch_bucks + buyin;
                        const highestScritchBucks = Math.max(newAmount, refundUserDB[0][0].scritch_bucks_highscore);
                        
                        // Update scritch_bucks and record transaction
                        await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                            [newAmount, highestScritchBucks, userId]);
                        await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                            [userId, newAmount, participant.member.user.username]);
                    }

                    await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);

                    await channel.send('Game cancelled by host. All Buy-Ins have been refunded.');
                    return;
                }

                // ... continue with game logic ...
                const pot = buyin * players.size; // Include dealer's contribution
                let results = [];

                // Roll dice for each player
                for (const [userId, player] of players) {
                    const rolls = Array(player.bones).fill(0).map(() => randInt(6, 1));
                    const rollEmojis = rolls.map((roll, index) => {
                        const emoji = getD6Emoji(roll, emojis);
                        // Add line break after every 3 dice
                        return (index + 1) % 3 === 0 && index < rolls.length - 1 ? emoji + '\n' : emoji + ' ';
                    }).join('');
                    const total = rolls.reduce((sum, roll) => sum + roll, 0);
                    const hasOne = rolls.includes(1);

                    results.push({
                        userId,
                        member: player.member,
                        rolls,
                        rollEmojis,
                        total,
                        hasOne
                    });
                }

                // Filter out players who rolled ones
                const validResults = results.filter(r => !r.hasOne);

                // Find winners
                let winners = [];
                if (validResults.length > 0) {
                    const highestTotal = Math.max(...validResults.map(r => r.total));
                    winners = validResults.filter(r => r.total === highestTotal);
                }

                // Build results message
                await channel.send("## 🎲 The bones have been cast!");
                for (const r of results) {
                    await channel.send(`${r.member.toString()}:\n${r.rollEmojis}\n**Total:** ${r.total}${r.hasOne ? ' (busted)' : ''}`);
                }

                let roundUp = false;
                if (winners.length > 0) {
                    await channel.send(`${winners.map((w, i) => {
                        // Don't show winnings for dealer, but mention house contribution
                        if (w.userId === 'house') return `## The house won ฅ${roundUp ? Math.floor(pot / winners.length) : Math.ceil(pot / winners.length)}.`;
                        return `## ${w.member.toString()} won ฅ${roundUp ? Math.floor(pot / winners.length) : Math.ceil(pot / winners.length)}.`;
                        roundUp = !roundUp;
                    }).join('\n')}`);


                    // Distribute winns
                    roundUp = false;
                    for (const [userId, player] of players) {
                        if(winners.some(w => w.userId === userId)) {
                            if (userId === 'house'){
                                roundUp = !roundUp;
                            } else {
                                const winnerDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [userId]);
                                const newAmount = roundUp ? winnerDB[0][0].scritch_bucks + Math.ceil(pot / winners.length) : winnerDB[0][0].scritch_bucks + Math.floor(pot / winners.length);
                                const highestScritchBucks = Math.max(newAmount, winnerDB[0][0].scritch_bucks_highscore);
                                
                                roundUp = !roundUp;

                                // Update scritch_bucks and record transaction
                                await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                                    [newAmount, highestScritchBucks, userId]);
                                await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                                    [userId, newAmount, player.member.user.username]);
                            }
                        } else {
                            if(userId === 'house') continue;
                            const loserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [userId]);
                            await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                                [userId, loserDB[0][0].scritch_bucks, player.member.user.username]);
                        }
                    }
                } else {
                    await channel.send(`## Everyone rolled a one so the house wins ฅ${pot}.`);

                    // Refund all players except dealer
                    for (const [userId, player] of players) {
                        if (userId === 'house') continue; // Skip house
                        const loserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [userId]);
                        await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                            [userId, loserDB[0][0].scritch_bucks, player.member.user.username]);
                    }
                }

                // Update the final game message
                roundUp = false;
                await message.edit({
                    content: `🎲 **${interaction.member.toString()}**'s game of Dwarven Dice has ended!\n` +
                        `## Players\n` +
                        `${Array.from(players.values()).map(p => {
                            const result = results.find(r => r.member.id === p.member.id);
                            let status = '';
                            if (winners.length > 0) {
                                if (result.hasOne) status = ' (busted)';
                                else if (winners.some(w => w.userId === result.userId)) {
                                    const win = roundUp ? Math.ceil(pot / winners.length) : Math.floor(pot / winners.length);
                                    if (result.userId === 'house') {
                                        status = ` (House wins ฅ${win})`;
                                    } else {
                                        status = ` (Won ฅ${win})`;
                                    }
                                    roundUp = !roundUp;
                                }
                            } else {
                                status = result.userId === 'house' ? ` (House wins ฅ${pot})` : ' (busted)';
                            }
                            // Always show dealer first
                            return `${p.member.toString()} ${p.bones} bones${status}`;
                        }).sort((a, b) => a.includes('House') ? -1 : b.includes('House') ? 1 : 0).join('\n')}`,
                    components: []
                });

                for(const player of validResults) {
                    if(player.member.id === 'house') continue;
                    if(player.total > 36) {
                        const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
                            [player.member.id, 13, player.member.displayName, 'Quixote']);
                        if(userCatDB[0].affectedRows){
                            await channel.send({content: `${player.member.toString()} just gained ownership of Quixote by rolling more than 36 without busting! This unlocks the \`/swords\` command.`, files: ['images/cats/Quixote.jpg']});
                        }
                    }
                }

                await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id])
                    .catch(console.error);
            });
        } catch(err) {
            console.error('Dwarven dice command error:', err);
            await interaction.editReply({ 
                content: "An error occurred while running the game. Please try again."
            }).catch(console.error);

            await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id])
                .catch(console.error);
            throw err;
        } finally {
            conn.release();
        }
    }
};
