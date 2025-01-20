const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { sleep, shuffle } = require("../utils.js");

function getEmoji(emojis, name){
    try{
        return emojis.find(e => e.name === name).toString();
    } catch(e){
        console.error(`Emoji ${name} not found`);
        return name;
    }
}

function getValueEmoji(suit, value, emojis) {
    const prefix = suit === 0 || suit === 1 ? 'red_' : 'black_';
    const valueString = ['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'][value - 1];
    return getEmoji(emojis, prefix + valueString);
}

function getSuitEmoji(suit, emojis){
    return getEmoji(emojis, ['hearts_suit', 'diamonds_suit', 'clubs_suit', 'spades_suit'][suit]);
}

function createBlackjackButtons(canDoubleDown, canSurrender, canSplit) {
    const hit = new ButtonBuilder()
        .setCustomId('hit')
        .setLabel('Hit')
        .setStyle(ButtonStyle.Primary);

    const stand = new ButtonBuilder()
        .setCustomId('stand')
        .setLabel('Stand')
        .setStyle(ButtonStyle.Primary);

    const doubleDown = new ButtonBuilder()
        .setCustomId('double_down')
        .setLabel('Double Down')
        .setStyle(ButtonStyle.Success)
		.setDisabled(!canDoubleDown);

    const surrender = new ButtonBuilder()
        .setCustomId('surrender')
        .setLabel('Surrender')
        .setStyle(ButtonStyle.Danger)
		.setDisabled(!canSurrender);

	const split = new ButtonBuilder()
		.setCustomId('split')
		.setLabel('Split')
		.setStyle(ButtonStyle.Success)
		.setDisabled(!canSplit);

	const rows = []
    if (canSplit) {
        rows.push(new ActionRowBuilder().addComponents(hit, stand, split));
		if (canSurrender) {
			if(canDoubleDown) {
				rows.push(new ActionRowBuilder().addComponents(doubleDown, surrender));
			} else {
				rows.push(new ActionRowBuilder().addComponents(surrender));
			}
		}
    } else {
		if (canSurrender) {
			if(canDoubleDown) {
				rows.push(new ActionRowBuilder().addComponents(hit, stand, doubleDown, surrender));
			} else {
				rows.push(new ActionRowBuilder().addComponents(hit, stand, surrender));
			}
		} else {
			rows.push(new ActionRowBuilder().addComponents(hit, stand));
		}
	}

    return rows;
}

function createLobbyButtons() {
    const join = new ButtonBuilder()
        .setCustomId('join')
        .setLabel('Join Game')
        .setStyle(ButtonStyle.Success);

    const start = new ButtonBuilder()
        .setCustomId('start')
        .setLabel('Start Game')
        .setStyle(ButtonStyle.Primary);

    const cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel Game')
        .setStyle(ButtonStyle.Danger);

    return new ActionRowBuilder().addComponents(join, start, cancel);
}

function isSoftHand(hand) {
    let total = 0;
    let hasAce = false;
    
    for(const card of hand) {
        if(card[1] === 1) {
            hasAce = true;
            total += 11;
        } else if(card[1] > 10) {
            total += 10;
        } else {
            total += card[1];
        }
    }
    
    // If we have an ace and the total is over 21, we're not soft
    if(hasAce && total > 21) {
        return false;
    }
    
    return hasAce && total <= 21;
}

function formatCards(hand, emojis) {
    return `${hand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${hand.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`;
}

function addCards(hand){
    let total = 0;
    let aces = 0;

    for(const card of hand){
        if(card[1] == 1) aces++;
    }

    for(const card of hand){
        switch(card[1]){
            case 1:
                total += 11;
            break;
            case 11:
            case 12:
            case 13:
                total += 10;
            break;
            default:
                total += card[1];
            break;
        }
    }
    if(total > 21 && aces){
        for(let i = 0; i < aces; i++){
            total -= 10;
            if(total <= 21) break;
        }
    }
    return total;
}

function formatDealerHand(hand, hideSecond, emojis) {
    if (hideSecond) {
        const blankCard = getEmoji(emojis, 'blank_card');
        const blankSuit = getEmoji(emojis, 'blank_suit');
        return `${getValueEmoji(hand[0][0], hand[0][1], emojis)} ${blankCard}
${getSuitEmoji(hand[0][0], emojis)} ${blankSuit}`;
    }
    return formatCards(hand, emojis);
}

async function turn(deck, channel, player, conn, emojis, dealerHand) {
    let handIndex = 0;
    while (handIndex < player.hands.length) {
        const currentHand = player.hands[handIndex];
        if(currentHand.hand.length == 2){
            // Check for blackjack first
            if(currentHand.value === 21) {
                await channel.send(`## ${player.toString()} got blackjack${player.hands.length > 1 ? ` on Hand ${handIndex + 1}` : ''}!
${formatCards(currentHand.hand, emojis)}`);
                handIndex++;
                continue;
            }

            const userDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [player.id]);
            const canDoubleDown = userDB[0][0].scritch_bucks >= currentHand.wager;
            // Check if hand can be split (same value cards and less than 4 total hands)
            const canSplit = currentHand.hand[0][1] === currentHand.hand[1][1] && 
                           userDB[0][0].scritch_bucks >= currentHand.wager && 
                           player.hands.length < 4;
            const turnTime = Date.now();
            
            let message = await channel.send({ 
                content: `It is ${player.toString()}'s turn${player.hands.length > 1 ? ` (Hand ${handIndex + 1})` : ''}.
This turn expires <t:${Math.ceil(turnTime/1000)+32}:R>
Dealer's Hand:
${formatDealerHand(dealerHand, true, emojis)}
${player.toString()}'s Hand (${currentHand.value}):
${formatCards(currentHand.hand, emojis)}`,
                components: createBlackjackButtons(canDoubleDown, true, canSplit)
            });

            try {
                while(currentHand.value < 21) {
                    const collector = message.createMessageComponentCollector({ 
                        time: 30000,
                        max: 1
                    });

                    const result = await new Promise((resolve) => {
                        collector.on('collect', async i => {
                            if (i.user.id !== player.id) {
                                await i.reply({ content: "It's not your turn!", ephemeral: true });
                                return;
                            }

                            await i.deferUpdate();
                            await message.edit({ components: [] });

                            if (i.customId === 'split') {
                                // Take additional wager
                                await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', 
                                    [currentHand.wager, player.id]);
                                
                                // Create new hand
                                const newHand = {
                                    hand: [currentHand.hand.pop()],
                                    value: 0,
                                    wager: currentHand.wager
                                };
                                
                                // Deal one card to each hand
                                currentHand.hand.push(deck.splice(0, 1)[0]);
                                newHand.hand.push(deck.splice(0, 1)[0]);
                                
                                // Calculate new values
                                currentHand.value = addCards(currentHand.hand);
                                newHand.value = addCards(newHand.hand);
                                
                                // Insert new hand after current hand
                                player.hands.splice(handIndex + 1, 0, newHand);
                                
                                await channel.send(`${player.toString()} split their hand and wagered ฅ${currentHand.wager}.
${player.hands.map(h => `Hand ${player.hands.indexOf(h)+1}: (${h.value})${h.surrendered ? ' (surrendered)' : h.busted ? ' (busted)' : ''}
${formatCards(h.hand, emojis)}`).join('\n')}`);

                                // Check for blackjack on current hand
                                if (currentHand.value === 21) {
                                    await channel.send(`## ${player.toString()} got blackjack on Hand ${handIndex + 1}!
${formatCards(currentHand.hand, emojis)}`);
                                    resolve('end');
                                    return;
                                }

                                const userDB2 = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [player.id]);
                                const canDoubleDown2 = userDB2[0][0].scritch_bucks >= currentHand.wager;
                                const canSplit2 = currentHand.hand[0][1] === currentHand.hand[1][1] && 
                                                userDB2[0][0].scritch_bucks >= currentHand.wager && 
                                                player.hands.length < 4;

                                // Create new message for continuing with current hand
                                message = await channel.send({ 
                                    content: `${player.toString()}'s turn continues with Hand ${handIndex + 1}:
Hand ${handIndex + 1} (${currentHand.value}):
${formatCards(currentHand.hand, emojis)}`,
                                    components: createBlackjackButtons(canDoubleDown2, true, canSplit2)
                                });
                                
                                resolve('continue');
                            } else if (i.customId === 'surrender') {
                                currentHand.surrendered = true;
                                await channel.send(`${player.toString()} has surrendered${player.hands.length > 1 ? ` Hand ${handIndex + 1}` : ''}.`);
                                resolve('end');
                            } else if (i.customId === 'double_down') {
                                await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', 
                                    [currentHand.wager, player.id]);
                                currentHand.wager *= 2;

                                currentHand.hand.push(deck.splice(0, 1)[0]);
                                currentHand.value = addCards(currentHand.hand);
                                
                                if(currentHand.value === 20){
                                    const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
                                        [player.id, 4, player.displayName, 'Murphy']);
                                    if(userCatDB[0].affectedRows){
                                        await channel.send({content: `<@${player.id}> just gained ownership of Murphy by doubling down on 20 in blackjack! This unlocks the \`/beg\` command.`, files: ['images/cats/Murphy.jpg']});
                                    }
                                }

                                const handMsg = player.hands.length > 1 ? ` (Hand ${handIndex + 1})` : '';
                                if(currentHand.value == 21){
                                    await channel.send(`## ${player.toString()} has doubled down and got blackjack${handMsg}!
${player.toString()}'s Hand (${currentHand.value}):
${formatCards(currentHand.hand, emojis)}`);
                                } else if(currentHand.value > 21){
                                    currentHand.busted = true;
                                    await channel.send(`## ${player.toString()} has doubled down and busted${handMsg}.
${player.toString()}'s Hand (${currentHand.value}):
${formatCards(currentHand.hand, emojis)}`);
                                } else {
                                    await channel.send(`${player.toString()} has doubled down${handMsg}.
${player.toString()}'s Hand (${currentHand.value}):
${formatCards(currentHand.hand, emojis)}`);
                                }
                                resolve('end');
                            } else if (i.customId === 'hit') {
                                currentHand.hand.push(deck.splice(0, 1)[0]);
                                currentHand.value = addCards(currentHand.hand);
                                
                                if(currentHand.value === 20){
                                    const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
                                        [player.id, 4, player.displayName, 'Murphy']);
                                    if(userCatDB[0].affectedRows){
                                        await channel.send({content: `<@${player.id}> just gained ownership of Murphy by hitting on 20 in blackjack! This unlocks the \`/beg\` command.`, files: ['images/cats/Murphy.jpg']});
                                    }
                                }

                                const handMsg = player.hands.length > 1 ? ` (Hand ${handIndex + 1})` : '';
                                message = await channel.send({ 
                                    content: `${player.toString()} hit${handMsg}.
${player.toString()}'s Hand (${currentHand.value}):
${formatCards(currentHand.hand, emojis)}`,
                                    components: createBlackjackButtons(false, false)
                                });

                                if(currentHand.value == 21){
                                    await message.edit({ components: [] });
                                    await channel.send(`## ${player.toString()} got blackjack${handMsg}!
${formatCards(currentHand.hand, emojis)}`);
                                    resolve('end');
                                } else if(currentHand.value > 21){
                                    await message.edit({ components: [] });
                                    currentHand.busted = true;
                                    await channel.send(`## ${player.toString()} busted${handMsg}.`);
                                    resolve('end');
                                } else {
                                    resolve('continue');
                                }
                            } else if (i.customId === 'stand') {
                                const handMsg = player.hands.length > 1 ? ` (Hand ${handIndex + 1})` : '';
                                await channel.send(`${player.toString()} stood${handMsg}.`);
                                resolve('end');
                            }
                        });

                        collector.on('end', (collected, reason) => {
                            if (reason === 'time') {
                                message.edit({ components: [] });
                                const handMsg = player.hands.length > 1 ? ` (Hand ${handIndex + 1})` : '';
                                channel.send(`${player.toString()} took too long and stood${handMsg}.`);
                                resolve('end');
                            }
                        });
                    });

                    if (result === 'end') break;
                }
            } catch(err) {
                console.error('Error handling button interaction:', err);
                throw err;
            }
        }
        handIndex++;
    }
    return { deck, player };
}

async function dealerTurn(deck, dealerHand, channel, emojis) {
    while (addCards(dealerHand) < 17) {
        dealerHand.push(deck.splice(0, 1)[0]);
    }
    return dealerHand;
}


module.exports = {
	data: new SlashCommandBuilder()
		.setName('blackjack')
		.setDescription('Starts a game of blackjack.')
		.addIntegerOption(option =>
			option.setName('wager')
				.setDescription("The amount of scritch bucks you'd like to wager.")
				.setRequired(true)),
	game: true,
	help: `Blackjack is a casino card game where players compete against the dealer to get closest to 21 without going over.
## Rules:
- Each player places a wager before receiving cards
- Players are dealt 2 cards face up, dealer gets one face up and one face down
- Card values: Ace = 1 or 11, Face cards = 10, Number cards = face value
- Blackjack (21) pays 3:2
- Otherwise, beating the dealer pays 1:1
## Player Actions:
- Hit - Take another card
- Stand - Keep current hand
- Double Down - Double wager and take exactly one more card (only on first turn)
- Surrender - Give up half the wager and fold (only on first turn)
- Split - Bet your initial wager again to split your hand into two separate hands (only if you have two cards of the same value and up to 4 hands)
- Insurance - Bet half your wager against dealer blackjack (only when dealer shows Ace) pays 2:1
## Additional Rules:
- Dealer must hit on 16 or less and stand on 17
- If dealer and players have the same hand, the player pushes and gets their wager back`,
	async execute(interaction, pool, emojis) {
		const channel = interaction.channel;
		const wager = interaction.options.getInteger('wager');
		const startTime = Date.now();
		
		if(wager <= 0) return interaction.reply({ 
			content: "Wager must be positive.",
			ephemeral: true 
		});

		const players = [interaction.member];
		players[0].wager = wager;
		players[0].hands = [{
			hand: [],
			value: 0,
			wager: wager
		}];

		const conn = await pool.getConnection();
		try {
			const userDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [interaction.member.id]);
			if(userDB[0].length === 0) throw("That user does not exist in the database.");
			if(wager > userDB[0][0].scritch_bucks) return interaction.reply({content: "You don't have enough scritch bucks.", ephemeral: true});

			await conn.query('INSERT INTO `game` (channel_id, game) VALUES (?, "blackjack");', [channel.id]);

			// Take additional wager
			await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', 
				[wager, interaction.member.id]);

			const message = await interaction.reply({ 
				content: `${interaction.member.toString()} has started a game of blackjack with a wager of ฅ${wager}!
The game will start <t:${Math.ceil(startTime/1000)+62}:R> or when the host starts it.
## Players:
${interaction.member.toString()} ฅ${wager}`,
				components: [createLobbyButtons()],
				fetchReply: true
			});
    
			let deck = [];
			for(let i = 0; i < 6; i++){
				for(let j = 0; j < 4; j++){
					for(let k = 1; k <= 13; k++){
						deck.push([j,k]);
					}
				}
			}
			deck = shuffle(deck);
    
			const collector = message.createMessageComponentCollector({
				componentType: ComponentType.Button,
				time: 60000
			});

			collector.on('collect', async i => {
				try {
					if (i.customId === 'join') {
						// Check if player is already in game
						if (players.some(p => p.id === i.user.id)) {
							await i.reply({ content: "You're already in the game.", ephemeral: true });
							return;
						}

						// Create modal for wager input
						const modal = new ModalBuilder()
							.setCustomId(`wager_modal-${i.id}`)
							.setTitle('Place your wager');

						const wagerInput = new TextInputBuilder()
							.setCustomId('wager_input')
							.setLabel('How much would you like to wager?')
							.setStyle(TextInputStyle.Short)
							.setPlaceholder('Enter amount')
							.setRequired(true);

						const actionRow = new ActionRowBuilder().addComponents(wagerInput);
						modal.addComponents(actionRow);

						await i.showModal(modal);

						try {
                            const modalSubmit = await i.awaitModalSubmit({
                                time: 30000,
                                filter: j => j.customId === `wager_modal-${i.id}`
                            });

							if(!modalSubmit) return;

							const joinWager = parseInt(modalSubmit.fields.getTextInputValue('wager_input'));

							// Check again if collector is still active
							if (collector.ended) {
								await modalResponse.reply({ 
									content: "It's too late to join.", 
									ephemeral: true 
								});
								return;
							}

							if (isNaN(joinWager) || joinWager <= 0) {
								await modalSubmit.reply({ content: "Please enter a valid positive number.", ephemeral: true });
								return;
							}

							const joinUserDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [i.user.id]);
							if(joinUserDB[0].length === 0) {
								await modalSubmit.reply({ content: "You don't exist in the database.", ephemeral: true });
								return;
							}
							if(joinWager > joinUserDB[0][0].scritch_bucks) {
								await modalSubmit.reply({ content: "You don't have enough scritch bucks.", ephemeral: true });
								return;
							}

							// Take additional wager
							await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', 
								[joinWager, o.user.id]);

							players.push(i.member);
							players[players.length-1].wager = joinWager;
							players[players.length-1].hands = [{
								hand: [],
								value: 0,
								wager: joinWager
							}];

                            await modalSubmit.deferUpdate();

							await channel.send(`${i.user.toString()} has joined the game with a wager of ฅ${joinWager}!`);
							await message.edit({
								content: `${interaction.member.toString()} has started a game of blackjack!
The game will start <t:${Math.ceil(startTime/1000)+62}:R> or when the host starts it.
## Players:
${players.map(p => `**${p.toString()}** ฅ${p.wager}`).join('\n')}`,
								components: [createLobbyButtons()]
							});
						} catch (err) {
							// console.error('Modal error:', err);
						}
					} else if (i.customId === 'start' || i.customId === 'cancel') {
						if (i.user.id !== interaction.member.id) {
							await i.reply({ content: "Only the game host can do that!", ephemeral: true });
							return;
						}

						if (i.customId === 'start') {
							await i.deferUpdate();
							collector.stop('started');
						} else {
							await i.deferUpdate();
							collector.stop('cancelled');
						}
					}
				} catch (error) {
					console.error('Button interaction error:', error);
					await i.reply({ content: "An error occurred while processing your action.", ephemeral: true }).catch(console.error);
				}
			});

			collector.on('end', async (collected, reason) => {
				try {
					if (reason === 'cancelled') {
						// Refund all players
						for await (const player of players) {
							const refundUserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', 
								[player.id]);
							const newAmount = refundUserDB[0][0].scritch_bucks + player.hands.reduce((sum, hand) => sum + hand.wager, 0);
							const highestScritchBucks = Math.max(newAmount, refundUserDB[0][0].scritch_bucks_highscore);
							await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
								[newAmount, highestScritchBucks, player.id]);
						}

						await message.edit({
							content: `Game cancelled by host. All players have been refunded.
${players.map(p => `${p.toString()} ฅ${p.hands.reduce((sum, hand) => sum + hand.wager, 0)} (refunded)`).join('\n')}`,
							components: []
						});
						await channel.send('Game cancelled by host. All players have been refunded.');
						await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);
						return;
					}

					// Continue with game...
					await message.edit({
						content: `${interaction.member.toString()} has started a game of blackjack!
## Players:
${players.map(p => `${p.toString()} ฅ${p.wager}`).join('\n')}`,
						components: []
					});

					// Deal initial cards
					let dealerHand = [];
					for await (const player of players) {
						player.hands[0].hand.push(deck.splice(0, 1)[0]);
						// player.hands[0].hand.push([0,1]);
					}
					dealerHand.push(deck.splice(0, 1)[0]);

					for await (const player of players) {
						player.hands[0].hand.push(deck.splice(0, 1)[0]);
						// player.hands[0].hand.push([1,1]);
						player.hands[0].value = addCards(player.hands[0].hand);
					}
					dealerHand.push(deck.splice(0, 1)[0]);

					// Show initial game state
					await channel.send(`## Game Started!
## Dealer's Hand:
${formatDealerHand(dealerHand, true, emojis)}
## Player Hands`);

					//show player hands
					for await (const player of players) {
						await channel.send(`${player.toString()}'s Hand (${player.hands[0].value}):
${formatCards(player.hands[0].hand, emojis)}`);
					}

					// Add blackjack check before player turns
					for await (const player of players) {
						// Check for initial blackjack
						if (player.hands[0].value === 21) {
							await channel.send(`## ${player.toString()} got blackjack!
${formatCards(player.hands[0].hand, emojis)}`);
							continue;
						}

						if (dealerHand[0][1] === 1) {
							const insuranceTime = Date.now();
							const insuranceMsg = await channel.send({ 
								content: `${player.toString()}, would you like insurance for ฅ${Math.ceil(player.wager/2)}?
This option expires <t:${Math.ceil(insuranceTime/1000)+22}:R>`,
								components: [new ActionRowBuilder()
									.addComponents(
										new ButtonBuilder()
											.setCustomId('yes')
											.setLabel('Yes')
											.setStyle(ButtonStyle.Success),
										new ButtonBuilder()
											.setCustomId('no')
											.setLabel('No')
											.setStyle(ButtonStyle.Danger)
									)]
							});

							try {
								const insuranceCollector = insuranceMsg.createMessageComponentCollector({ 
									time: 20000,
									max: 1
								});

								const insuranceResponse = await new Promise(resolve => {
									insuranceCollector.on('collect', async i => {
										if (i.user.id !== player.id) {
											await i.reply({ content: "This insurance option isn't for you!", ephemeral: true });
											return;
										}

										await i.deferUpdate();
										resolve(i.customId === 'yes');
									});

									insuranceCollector.on('end', collected => {
										if (collected.size === 0) resolve(false);
									});
								});

								await insuranceMsg.delete();

								if (insuranceResponse) {
									player.insurance = Math.ceil(player.wager/2);
									await channel.send(`${player.toString()} has opted for insurance and put forward ฅ${player.insurance}.`);
									await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', 
										[player.insurance, player.id]);
								}
							} catch (err) {
								console.error('Insurance error:', err);
							}
						}

						const obj = await turn(deck, channel, player, conn, emojis, dealerHand);
						Object.assign(deck, obj.deck);
						Object.assign(player, obj.player);
					}

					//reveale dealer hand
					let dealerValue = addCards(dealerHand);
					if(dealerValue < 17) {
						dealerHand = await dealerTurn(deck, dealerHand, channel, emojis);
					}
					dealerValue = addCards(dealerHand);
					await channel.send(`## Dealer's Final Hand (${dealerValue}${dealerValue > 21 ? ' busted' : ''}):
${formatCards(dealerHand, emojis)}
## Final Player Hands`);

					for (const player of players) {
						if(player.hands.length > 1){
							await channel.send(`${player.toString()}'s Hands:`);
							for(const hand of player.hands){
								await channel.send(`Hand ${player.hands.indexOf(hand)+1}: (${hand.value})${hand.surrendered ? ' (surrendered)' : hand.busted ? ' (busted)' : hand.value == dealerValue ? ' (pushed)' : ''}
${formatCards(hand.hand, emojis)}`);
							}
						} else {
							const hand = player.hands[0];
							await channel.send(`${player.toString()}'s Hand: (${hand.value})${hand.surrendered ? ' (surrendered)' : hand.busted ? ' (busted)' : hand.value == dealerValue ? ' (pushed)' : ''}
${formatCards(hand.hand, emojis)}`);
						}
					}

					let resultMsg = '';
					let roundUp = true;
					// Show individual results
					for (const player of players){
						let win = 0;
						for (const hand of player.hands){
							if(hand.busted) {
								win -= hand.wager;
								continue;
							}
							if(hand.surrendered){
								win -= roundUp ? Math.ceil(hand.wager/2) : Math.floor(hand.wager/2);
								roundUp = !roundUp;
							} else if(addCards(dealerHand) > 21 || hand.value > addCards(dealerHand)){
								win += (hand.value == 21) ? Math.ceil(hand.wager*3/2) : hand.wager;
							} else if(hand.value == dealerValue){
								win += 0; // Push
							} else {
								win -= hand.wager;
							}
						}
						
						const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [player.id]);
						
						if(win < 0){
							resultMsg += `## ${player.toString()} lost ฅ${Math.abs(win)}.\n`;
							conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
								[player.id, userDB[0][0].scritch_bucks, player.user.username]);
						} else if(win === 0){
							resultMsg += `## ${player.toString()} broke even.\n`;
							await conn.query('UPDATE `user` SET `scritch_bucks` = ? WHERE `user_id` = ?;', 
								[userDB[0][0].scritch_bucks, player.id]);
						} else if(win > 0){
							resultMsg += `## ${player.toString()} won ฅ${win}.\n`;
							const newScritchBucks = userDB[0][0].scritch_bucks + player.wager * player.hands.length + win;
							const highestScritchBucks = Math.max(newScritchBucks, userDB[0][0].scritch_bucks_highscore);
							await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
								[newScritchBucks, highestScritchBucks, player.id]);
							conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
								[player.id, newScritchBucks, player.user.username]);
						}
					}
					await channel.send(resultMsg);

					await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);
				} catch (err) {
					console.error('Game error:', err);
					// Try to refund players if there's an error
					try {
						for await (const player of players) {
							const refundUserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', 
								[player.id]);
							const newAmount = refundUserDB[0][0].scritch_bucks + player.wager * player.hands.reduce((sum, hand) => sum + hand.wager, 0);
							const highestScritchBucks = Math.max(newAmount, refundUserDB[0][0].scritch_bucks_highscore);
							await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
								[newAmount, highestScritchBucks, player.id]);
						}
						
						await message.edit({
							content: `Game cancelled due to an error. All wagers have been refunded.
${players.map(p => `${p.toString()} ฅ${p.hands.reduce((sum, hand) => sum + hand.wager, 0)} (refunded)`).join('\n')}`,
							components: []
						});
					} catch (refundErr) {
						console.error('Error while refunding:', refundErr);
						await message.edit({
							content: 'An error occurred. Please contact an administrator to check if refunds are needed.',
							components: []
						});
					}
					await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);
					throw err;
				}
			});
		} catch(err){              
			await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);
			throw err;
		} finally{
			conn.release();
		}
	},
}