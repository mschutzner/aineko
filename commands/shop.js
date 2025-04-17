const { SlashCommandBuilder } = require('@discordjs/builders');
const { getEmojiIdByNumber, getEmojiByNumber, getNumberByEmoji, shuffle } = require("../utils.js");
const { cardBuy, cardSell, cardMultiplier } = require("../config.json");

function shuffleSuit(suit) {
    let deck = [];
    // Create one deck of 26 cards of the same suit
    // suit is preresnted by (0-3: hearts, diamonds, clubs, spades)
    // i represents value (1-13: Ace through King)
	for(let i = 1; i <= 13; i++){
		deck.push([suit,i], [suit,i]);
	}
	// add a joker
	deck.push([4,0]);
    return shuffle(deck);
}

function shuffleDeck(suit) {
	let deck = [];
	for(let j = 0; j < 4; j++){
		for(let k = 1; k <= 13; k++){
			deck.push([j,k]);
		}
	}
	// add two jokers
	deck.push([4,0], [4,0]);
    return shuffle(deck);
}

function getEmoji(emojis, name){
    try{
        return emojis.find(e => e.name === name).toString();
    } catch(e){
        console.error(`Emoji ${name} not found`);
        return name;
    }
}

function getValueEmoji(suit, value, emojis) {
    if(suit === 4) return getEmoji(emojis, 'joker_top');
    const prefix = suit === 0 || suit === 1 ? 'red_' : 'black_';
    const valueString = ['joker', 'ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'][value];
    return getEmoji(emojis, prefix + valueString);
}

const suitName = ['hearts', 'diamonds', 'clubs', 'spades'];

function getSuitEmoji(suit, emojis){
    return getEmoji(emojis, ['hearts_suit', 'diamonds_suit', 'clubs_suit', 'spades_suit', 'joker_bottom', 'scritch_card'][suit]);
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shop')
		.setDescription('Buy cats.'),
	help: 'React with the number emojis to purchase cats with scritch bucks (ฅ). Some cats unlock special commands when purchased.',
    async execute(interaction, pool, emojis) { 
		const conn = await pool.getConnection();
		try{
			const member = interaction.member;
			const channel = interaction.channel;
			const catDB = await conn.query('SELECT * FROM `cat` WHERE `price` IS NOT NULL LIMIT 5;');

			const blankEmoji = getEmoji(emojis, 'blank');

			let msg = '';
			for (let i = 1; i <= catDB[0].length; i++){
				msg += `${getEmojiIdByNumber(i)} ${catDB[0][i-1].name}, Cost: ฅ${catDB[0][i-1].price}, ${catDB[0][i-1].description}\n`;
			}

			// msg += `${getEmojiIdByNumber(catDB[0].length+1)} Heart Card Pack, Cost: ฅ${cardBuy}, Up to 3 Digica cards.\n`;
			// msg += `${getEmojiIdByNumber(catDB[0].length+2)} Diamond Card Pack, Cost: ฅ${cardBuy}, Up to 3 Digica cards.\n`;
			// msg += `${getEmojiIdByNumber(catDB[0].length+3)} Clubs Card Pack, Cost: ฅ${cardBuy}, Up to 3 Digica cards.\n`;
			// msg += `${getEmojiIdByNumber(catDB[0].length+4)} Spades Card Pack, Cost: ฅ${cardBuy}, Up to 3 Digica cards.\n`;
			// msg += `${getEmojiIdByNumber(catDB[0].length+5)} Random Card Pack, Cost: ฅ${cardBuy}, Up to 3 Digica cards.\n`;

			const shop = await interaction.reply({ content: `**React with a number below to make a purchase.**\n${msg}`,
				fetchReply: true
			});

			const filter = (reaction, user) => !user.bot;

			const collector = shop.createReactionCollector({filter, time: 300000});
			
			collector.on('collect', async (reaction, user) => {
				reaction.users.remove(user.id);
				
				const index = getNumberByEmoji(reaction.emoji.name);

				if(index <= catDB[0].length){
					const cat = catDB[0][index-1];
					const userCatDB = await conn.query('SELECT * FROM `user_cat` WHERE `user_id` = ? AND `cat_id` = ?;', [user.id, cat._id]);
					if(userCatDB[0].length > 0){
						return channel.send(`<@${user.id}> already owns ${cat.name}.`);
					}
					const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [user.id]);
					if(userDB[0][0].scritch_bucks < cat.price){
						return channel.send(`<@${user.id}> does not have enough scritch bucks to buy ${cat.name}.`);
					}
					await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
						[user.id, cat._id, user.username, cat.name]);
	
					const newScritchBucks = userDB[0][0].scritch_bucks - cat.price;
					const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
					await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
						[newScritchBucks, highestScritchBucks, user.id]);
					conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
						[user.id, newScritchBucks, user.username]);
	
					if(cat.command){
						channel.send({content: `<@${user.id}> has bought ${cat.name} for ฅ${cat.price}. This unlocks the \`/${cat.command}\` command.`, files: [`images/cats/${cat.name}.jpg`]});
					} else {
						channel.send({content: `<@${user.id}> has bought ${cat.name} for ฅ${cat.price}.`, files: [`images/cats/${cat.name}.jpg`]});
					}
				}
// 				} else if(index === catDB[0].length+5){					
// 					const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [user.id]);
// 					if(userDB[0][0].scritch_bucks < cardBuy){
// 						return channel.send(`<@${user.id}> does not have enough scritch bucks to buy more cards.`);
// 					}

// 					// Check current hand size
// 					const currentHand = userDB[0][0].digica_hand || '';
// 					const currentCards = !currentHand ? [] :userDB[0][0].digica_hand.split(';').map(card => {
// 						const [suit, value] = card.split(',').map(Number);
// 						return [suit, value];
// 					});

// 					const numCardsToBuy = Math.min(6 - currentCards.length, 3);

// 					if (numCardsToBuy <= 0) {
// 						return channel.send(`<@${user.id}> already has the maximum of 6 cards in their hand.`);
// 					}

// 					const deck = shuffleDeck();
// 					const cards = deck.slice(0, numCardsToBuy);
					
// 					const newCards = cards.map(card => `${card[0]},${card[1]}`).join(';');
// 					const newHand = currentHand ? `${currentHand};${newCards}` : newCards;

// 					if(currentCards.length > 0){
// 						channel.send(`<@${user.id}> has bought ${numCardsToBuy} random Digica card${numCardsToBuy > 1 ? 's' : ''} for ฅ${cardBuy}.
// ${currentCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ${blankEmoji} ${cards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
// ${currentCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')} ${blankEmoji} ${cards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
// 					} else {
// 						channel.send(`<@${user.id}> has bought ${numCardsToBuy} random Digica card${numCardsToBuy > 1 ? 's' : ''} for ฅ${cardBuy}.
// ${cards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
// ${cards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
// 					}
	
// 					const newScritchBucks = userDB[0][0].scritch_bucks - cardBuy;
// 					const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
// 					await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ?, `digica_hand` = ? WHERE `user_id` = ?;',
// 						[newScritchBucks, highestScritchBucks, newHand, user.id]);
// 					conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
// 						[user.id, newScritchBucks, user.username]);
// 				} else {
// 					const suit = index - catDB[0].length - 1;
					
// 					const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [user.id]);
// 					if(userDB[0][0].scritch_bucks < cardBuy){
// 						return channel.send(`<@${user.id}> does not have enough scritch bucks to buy more cards.`);
// 					}

// 					// Check current hand size
// 					const currentHand = userDB[0][0].digica_hand || '';
// 					const currentCards = !currentHand ? [] :userDB[0][0].digica_hand.split(';').map(card => {
// 						const [suit, value] = card.split(',').map(Number);
// 						return [suit, value];
// 					});

// 					const numCardsToBuy = Math.min(6 - currentCards.length, 3);

// 					if (numCardsToBuy <= 0) {
// 						return channel.send(`<@${user.id}> already has the maximum of 6 cards in their hand.`);
// 					}

// 					const deck = shuffleSuit(suit);
// 					const cards = deck.slice(0, numCardsToBuy);
					
// 					const newCards = cards.map(card => `${card[0]},${card[1]}`).join(';');
// 					const newHand = currentHand ? `${currentHand};${newCards}` : newCards;

// 					if(currentCards.length > 0){
// 						channel.send(`<@${user.id}> has bought ${numCardsToBuy} ${suitName[suit]} Digica card${numCardsToBuy > 1 ? 's' : ''} for ฅ${cardBuy}.
// ${currentCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ${blankEmoji} ${cards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
// ${currentCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')} ${blankEmoji} ${cards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
// 					} else {
// 						channel.send(`<@${user.id}> has bought ${numCardsToBuy} ${suitName[suit]} Digica card${numCardsToBuy > 1 ? 's' : ''} for ฅ${cardBuy}.
// ${cards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
// ${cards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
// 					}
	
// 					const newScritchBucks = userDB[0][0].scritch_bucks - cardBuy;
// 					const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
// 					await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ?, `digica_hand` = ? WHERE `user_id` = ?;',
// 						[newScritchBucks, highestScritchBucks, newHand, user.id]);
// 					conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
// 						[user.id, newScritchBucks, user.username]);
// 				}
			});	

            collector.on('end', async () => {
                // Remove buttons when collector expires
				await shop.reactions?.removeAll().catch(() => {});
				await interaction.editReply(`**Shop has closed.**\n${msg}`);
            });

			// Limit total items to 9 (since we're using 1-9 reactions)
			const maxItems = Math.min(catDB[0].length, 9);
			
			for (let i = 1; i <= maxItems; i++){
				shop.react(getEmojiByNumber(i));
			}
		} finally{
			//release pool connection
			conn.release();
		}
	},
}