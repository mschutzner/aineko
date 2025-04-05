const { SlashCommandBuilder } = require('@discordjs/builders');
const { getEmojiIdByNumber, getEmojiByNumber, getNumberByEmoji, shuffle } = require("../utils.js");
const { cardBuy, cardSell, cardMultiplier } = require("../config.json");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function shuffleDeck() {
    let deck = [];
    // Create one deck of 52 cards
    // j represents suit (0-3: hearts, diamonds, clubs, spades)
    // k represents value (1-13: Ace through King)
    for(let j = 0; j < 4; j++){
        for(let k = 1; k <= 13; k++){
            deck.push([j,k]);
        }
    }
    return shuffle(deck);
}

const challengeLengths = [2, 2, 3, 3, 3, 4, 4, 5];

function shufflePack(suit) {
    let deck = [];
    if(suit === 4){
        for(let j = 0; j < 4; j++){
            for(let k = 1; k <= 13; k++){
                deck.push([j,k]);
            }
        }
        // add two jokers
        deck.push([4,0], [4,0]);
        return shuffle(deck);
    } else {
        for(let i = 1; i <= 13; i++){
            deck.push([suit,i], [suit,i]);
        }
        // add a joker
        deck.push([4,0]);
        return shuffle(deck);
    }
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
    const valueString = [
        'joker', 
        'ace', 
        '2', 
        '3', 
        '4', 
        '5', 
        '6', 
        '7', 
        '8', 
        '9', 
        '10', 
        'jack', 
        'queen', 
        'king'
    ][value];
    return getEmoji(emojis, prefix + valueString);
}

function getSuitEmoji(suit, emojis){
    return getEmoji(emojis, [
        'hearts_suit', 
        'diamonds_suit', 
        'clubs_suit', 
        'spades_suit', 
        'joker_bottom', 
        'scritch_card'
    ][suit]);
}

const valueFaces = ['Joker', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];

function getScritchValue(value){
    return Math.ceil(cardSell * Math.pow(cardMultiplier, value - 1) / 50) * 50;
}


async function validateCards(cards, member, pool) {
    const [userDB] = await pool.query('SELECT digica_hand FROM `user` WHERE `user_id` = ?;', [member.id]);
    if (!userDB?.[0]?.digica_hand) return false;

    const dbCards = userDB[0].digica_hand.split(';').map(card => {
        const [suit, value] = card.split(',').map(Number);
        return [suit, value];
    });

    if (dbCards.length !== cards.length) return false;

    // Sort both arrays to compare them properly
    const sortedCards = [...cards].sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
    const sortedDBCards = [...dbCards].sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);

    return sortedCards.every((card, i) => 
        card[0] === sortedDBCards[i][0] && card[1] === sortedDBCards[i][1]
    );
}

async function validateChallenge(challengeCards, guildId, pool) {
    const [guildDB] = await pool.query('SELECT digica_challenge FROM `guild` WHERE `guild_id` = ?;', [guildId]);
    if (!guildDB?.[0]?.digica_challenge) return false;

    const dbCards = guildDB[0].digica_challenge.split(';').map(card => {
        const [suit, value] = card.split(',').map(Number);
        return [suit, value];
    });

    if (dbCards.length !== challengeCards.length) return false;

    // Sort both arrays to compare them properly
    const sortedCards = [...challengeCards].sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
    const sortedDBCards = [...dbCards].sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);

    return sortedCards.every((card, i) => 
        card[0] === sortedDBCards[i][0] && card[1] === sortedDBCards[i][1]
    );
}

async function nextChallenge(
    winner, 
    winnerDB, 
    winnerCards, 
    rewardCard, 
    channel, 
    emojis, 
    pool, 
    blankEmoji
){
    // Create play button
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('play_challenge')
                .setLabel('Play Cards')
                .setStyle(ButtonStyle.Primary)
        );

    // Generate new challenge
    const deck = shuffleDeck();
    const numCards = challengeLengths[Math.floor(Math.random() * challengeLengths.length)];
    const challengeCards = deck.slice(0, numCards);
    const challenge = challengeCards.map(card => `${card[0]},${card[1]}`).join(';');
    // We'll define the new reward card as  [5, challengeCards.length].
    const newRewardCard = [5, challengeCards.length];

    // Update the guild's challenge in the DB
    await pool.query('UPDATE `guild` SET `digica_challenge` = ? WHERE `guild_id` = ?;', 
        [challenge, channel.guildId]
    );

    // Show the player's new hand, plus the reward card they just earned
    const message = await channel.send({
        content: `### <@${winner.id}> completed the challenge! <@${winner.id}>'s new hand:
${winnerCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ${getValueEmoji(rewardCard[0], rewardCard[1], emojis)}
${winnerCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')} ${getSuitEmoji(rewardCard[0], emojis)}
## New Challenge:
${challengeCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ➡️ ${getValueEmoji(newRewardCard[0], newRewardCard[1], emojis)}
${challengeCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')} ➡️ ${getSuitEmoji(newRewardCard[0], emojis)}`,
        components: [row]
    });
            
    // Check if the user has completed 3 challenges (the current is the new one after adding +1)
    if (winnerDB[0].challenges_completed >= 2) {
        // Insert cat record if not owned
        const [userCatDB] = await pool.query(
            'INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
            [winner.id, 12, winner.username, 'Jinx']
        );
        if(userCatDB.affectedRows){
            await channel.send({
                content: `<@${winner.id}> just gained ownership of Jinx by completing three Digica challenges! This unlocks the \`/tarot\` command.`,
                files: ['images/cats/Jinx.jpg']
            });
        }
    }

    // Add reward card to winner's hand
    winnerCards.push(rewardCard);
    const newHand = winnerCards.map(card => `${card[0]},${card[1]}`).join(';');

    // Increment their completed challenge count and update the DB
    await pool.query(
        'UPDATE `user` SET `digica_hand` = ?, `challenges_completed` = ? WHERE `user_id` = ?;',
        [newHand, winnerDB[0].challenges_completed + 1, winner.id]
    );

    // Now set up a collector on the new message
    const collector = message.createMessageComponentCollector();

    collector.on('collect', async i => {     
        try {
            // Validate challenge hasn't changed
            const stillValid = await validateChallenge(challengeCards, channel.guildId, pool);
            if (!stillValid) {
                await channel.send("The challenge has changed since you started. Please check the new challenge.");
                collector.stop();
                return;
            }

            // Get user's hand
            const [dbRows] = await pool.query(
                'SELECT digica_hand, challenges_completed FROM `user` WHERE `user_id` = ?;',
                [i.user.id]
            );
            if (!dbRows?.[0]?.digica_hand) {
                await channel.send(`<@${i.user.id}> doesn't have any cards!`);
                return;
            }

            const playerCards = dbRows[0].digica_hand.split(';').map(card => {
                const [suit, value] = card.split(',').map(Number);
                return [suit, value];
            });

            // Check if player has all required cards
            const remainingChallengeCards = [...challengeCards];
            const remainingPlayerCards = [...playerCards];
            
            // First pass: exact matches
            for (let idx = remainingChallengeCards.length - 1; idx >= 0; idx--) {
                const challengeCard = remainingChallengeCards[idx];
                const exactMatchIndex = remainingPlayerCards.findIndex(playerCard => 
                    playerCard[0] === challengeCard[0] && playerCard[1] === challengeCard[1]
                );
                if (exactMatchIndex !== -1) {
                    remainingChallengeCards.splice(idx, 1);
                    remainingPlayerCards.splice(exactMatchIndex, 1);
                }
            }
            
            // Second pass: use jokers for any leftover challenge card
            const hasAllCards = remainingChallengeCards.every(challengeCard => {
                const jokerIndex = remainingPlayerCards.findIndex(playerCard => playerCard[0] === 4);
                if (jokerIndex !== -1) {
                    remainingPlayerCards.splice(jokerIndex, 1);
                    return true;
                }
                return false;
            });

            if (!hasAllCards) {
                await channel.send(`<@${i.user.id}> doesn't have all the required cards!`);
                return;
            }

            // They do have all required cards. Remove them from the player's hand
            // so we can pass the leftover cards along to nextChallenge.
            playerCards.length = 0;
            playerCards.push(...remainingPlayerCards);

            // Update the challenge message so it doesn't look "still open"
            await message.edit({
                content: `### Previous challenge completed by <@${i.user.id}>:
${challengeCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ➡️ ${getValueEmoji(newRewardCard[0], newRewardCard[1], emojis)}
${challengeCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')} ➡️ ${getSuitEmoji(newRewardCard[0], emojis)}`,
                components: []
            });

            // Pass on to a new challenge for that user
            await nextChallenge(i.user, dbRows, playerCards, newRewardCard, channel, emojis, pool, blankEmoji);

        } catch (error) {
            console.error('Error processing challenge:', error);
            await channel.send('An error occurred while processing the challenge.');
            collector.stop('error');
        }
    });
}

async function handleNextMerge(cards, member, channel, emojis, pool, blankEmoji) {
    // Check for any more possible merges
    let hasMergeable = false;
    for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
            if (
                (cards[i][0] === 4 && cards[j][0] === 4) || // Two jokers
                (cards[i][0] === 5 && cards[j][0] === 5 && cards[i][1] === cards[j][1]) || // Same level scritch
                (cards[i][0] === cards[j][0] && cards[i][0] !== 5) // Same suit non-scritch
            ) {
                hasMergeable = true;
                break;
            }
        }
        if (hasMergeable) break;
    }

    if (!hasMergeable || cards.length < 2) {
        return channel.send(`### <@${member.id}>'s Hand (no mergeable cards):
${cards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
    }

    // Show the user's new hand with a blank in between the last card
    const msg = await channel.send(
        `### <@${member.id}>'s New Hand (Merge Again?):
${cards.slice(0, -1).map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ${blankEmoji} ${getValueEmoji(cards[cards.length-1][0], cards[cards.length-1][1], emojis)} 
${cards.slice(0, -1).map(card => getSuitEmoji(card[0], emojis)).join(' ')} ${blankEmoji} ${getSuitEmoji(cards[cards.length-1][0], emojis)}
${cards.slice(0, -1).map((_, i) => getEmojiIdByNumber(i+1)).join(' ')} ${blankEmoji} ${getEmojiIdByNumber(cards.length)}`
    );
    // Add number reactions
    for (let i = 1; i <= cards.length; i++) {
        await msg.react(getEmojiByNumber(i));
    }

    const collector = msg.createReactionCollector({ dispose: true });
    let selectedIndices = [];

    return new Promise((resolve) => {
        collector.on('collect', async (reaction, user) => {
            if(user.bot) return;

            if (user.id !== member.id) {
                await reaction.users.remove(user);
                return;
            }

            // Validate the user's current hand in DB
            const stillValid = await validateCards(cards, member, pool);
            if (!stillValid) {
                await channel.send(
                    "Your hand has changed since starting the merge. Please try again."
                );
                return;
            }

            const index = getNumberByEmoji(reaction.emoji.name) - 1;
            if (index >= 0 && index < cards.length && !selectedIndices.includes(index)) {
                selectedIndices.push(index);
            }

            if (selectedIndices.length !== 2) return;

            // Merge logic
            const [card1, card2] = [
                cards[selectedIndices[0]],
                cards[selectedIndices[1]]
            ];
            let newCard;
            if(card1[0] !== card2[0]){
                await channel.send(
                    "Cards must be two cards of the same suit or both scritch cards of the same value."
                );
                // reset the user's reaction picks
                await msg.reactions.cache.forEach(async r => await r.users.remove(user.id));
                selectedIndices = [];
                return;
            } else if (card1[1] === 13 || card2[1] === 13) {
                // King merge with same suit - let user choose new suit
                let newValue = card1[1] === 13 ? card2[1] : card1[1];

                // Create suit selection buttons
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('suit_hearts')
                            .setLabel('Hearts')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('suit_diamonds')
                            .setLabel('Diamonds')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('suit_clubs')
                            .setLabel('Clubs')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('suit_spades')
                            .setLabel('Spades')
                            .setStyle(ButtonStyle.Secondary)
                    );

                const suitMessage = await channel.send({
                    content: `### Choose a suit for your merged card (${valueFaces[newValue]}):`,
                    components: [row]
                });

                const suitCollector = suitMessage.createMessageComponentCollector();

                suitCollector.on('collect', async i => {
                    i.deferUpdate();

                    if (i.user.id !== member.id) return;                    

                    let newSuit;
                    switch (i.customId) {
                        case 'suit_hearts': newSuit = 0; break;
                        case 'suit_diamonds': newSuit = 1; break;
                        case 'suit_clubs': newSuit = 2; break;
                        case 'suit_spades': newSuit = 3; break;
                    }

                    newCard = [newSuit, newValue];
                
                    if(card1[1] === 13 && card2[1] === 13){
                        const userCatDB = await pool.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
                            [member.id, 14, member.displayName, 'Kane']);
                        if(userCatDB[0].affectedRows){
                            await channel.send({content: `<@${member.id}> just gained ownership of Kane by merging two Kings! This unlocks the \`/poster\` command.`, files: ['images/cats/Kane.jpg']});
                        }
                    }

                    // Remove them from the array, add new card
                    cards.splice(Math.max(selectedIndices[0], selectedIndices[1]), 1);
                    cards.splice(Math.min(selectedIndices[0], selectedIndices[1]), 1);
                    cards.push(newCard);

                    // Update DB
                    const newHand = cards.map(card => `${card[0]},${card[1]}`).join(';');
                    await pool.query(
                        'UPDATE `user` SET `digica_hand` = ? WHERE `user_id` = ?;',
                        [newHand, member.id]
                    );

                    // Remove the bot's reactions
                    collector.stop();

                    suitMessage.delete();

                    // Check if further merges are possible
                    await handleNextMerge(cards, member, channel, emojis, pool, blankEmoji);
                    resolve();
                });
            } else {
                if(card1[0] === 4){
                    // Two Jokers => level 2 scritch
                    newCard = [5, 2];
                } else if (card1[0] === 5) {
                    if(card1[1] !== card2[1]){
                        await channel.send(
                            "Cards must be two cards of the same suit or both scritch cards of the same value."
                        );
                        // reset the user's reaction picks
                        await msg.reactions.cache.forEach(async r => await r.users.remove(user.id));
                        selectedIndices = [];
                        return;
                    } else {
                        // Same-level scritch => next level
                        newCard = [5, card1[1] + 1];
                    }
                } else {
                    // Same suit => add values
                    let newValue = card1[1] + card2[1];
                    if (newValue > 13) newValue -= 13;
                    newCard = [card1[0], newValue];
                }

                // Remove them from the array, add new card
                cards.splice(Math.max(selectedIndices[0], selectedIndices[1]), 1);
                cards.splice(Math.min(selectedIndices[0], selectedIndices[1]), 1);
                cards.push(newCard);

                // Update DB
                const newHand = cards.map(card => `${card[0]},${card[1]}`).join(';');
                await pool.query(
                    'UPDATE `user` SET `digica_hand` = ? WHERE `user_id` = ?;',
                    [newHand, member.id]
                );

                collector.stop();

                // Check if further merges are possible
                await handleNextMerge(cards, member, channel, emojis, pool, blankEmoji);
                resolve();
            }
        });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('digica')
        .setDescription('Play Digica card game.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('challenge')
                .setDescription('Show or play the challenge for the current server.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('buy')
                .setDescription('Buy card packs.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('hand')
                .setDescription('Show your current hand.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('merge')
                .setDescription('Merge two cards in your hand.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('discard')
                .setDescription('Discard cards from your hand. Scritch cards give scritch bucks.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('trade')
                .setDescription('Trade cards with other players.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('give')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to give cards to.')
                        .setRequired(true))
                .setDescription('Give cards to another players.')),
    help: `Digica is a card game where players collect and merge cards to complete challenges and earn rewards.

**Basic Concepts:**
- Players can hold up to 6 cards in their hand
- Cards have suits (hearts, diamonds, clubs, spades) and values (Ace through King)
- Special cards include Jokers and Scritch cards
- Buy card packs to build your hand

**Card Packs:**
- Each pack contains up to 3 Digica cards up to the max of 6 cards in your hand
- Card packs give a random card from the suit of that pack
- All packs have a chance of giving a Joker card

**Commands:**
- \`/digica challenge\` - View or play the current server challenge
- \`/digica buy\` - Buy card packs
- \`/digica hand\` - View your current hand
- \`/digica merge\` - Merge two compatible cards
- \`/digica discard\` - Discard cards (Scritch cards give scritch bucks)
- \`/digica trade\` - Trade cards with other players
- \`/digica give\` - Give cards to another players

**Merging Rules:**
- Same suit cards: Values are added (if sum > 13, subtract 13)
- Aces are low (value 1)
- Kings instead let you choose a new suit for your merged card
- Two Jokers: Creates a level 2 Scritch card
- Same level Scritch cards: Creates next level Scritch card
- Cards must be of the same suit or both be Scritch cards of same level

**Challenge System:**
- Each server has an active challenge showing required cards
- Match the challenge cards exactly or use Jokers as wildcards
- Completing a challenge earns a Scritch card

**Scritch Card Discard Values:**
- Level 2: ฅ${getScritchValue(2)}
- Level 3: ฅ${getScritchValue(3)}
- Level 4: ฅ${getScritchValue(4)}
- Level 5: ฅ${getScritchValue(5)}
- Level 6: ฅ${getScritchValue(6)}`,
    
    async execute(interaction, pool, emojis) {
        const subcommand = interaction.options.getSubcommand();
        const member = interaction.member;
        const channel = interaction.channel;
        const blankEmoji = getEmoji(emojis, 'blank');

            if (subcommand === 'hand') {
                const [[userRecord]] = await pool.query(
                    'SELECT digica_hand FROM `user` WHERE `user_id` = ?;',
                    [member.id]
                );
                if (!userRecord?.digica_hand) {
                    return interaction.reply(
                    "You don't have any cards in your hand! Use \`/digica buy\` to buy some cards."
                    );
                }

                const cards = userRecord.digica_hand.split(';').map(card => {
                    const [suit, value] = card.split(',').map(Number);
                    return [suit, value];
                });
                const response = `### Your Hand (${cards.length}/6):
${cards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`;

                await interaction.reply(response);

            } else if (subcommand === 'challenge') {
                // Fetch the guild challenge
                let challengeCards;
                const [[guildRecord]] = await pool.query(
                    'SELECT digica_challenge FROM `guild` WHERE `guild_id` = ?;',
                    [interaction.guildId]
                );

                if (!guildRecord?.digica_challenge) {
                    // No challenge => generate one
                    const deck = shuffleDeck();
                    const numCards = challengeLengths[Math.floor(Math.random() * challengeLengths.length)];
                    challengeCards = deck.slice(0, numCards);
                    const challenge = challengeCards.map(card => `${card[0]},${card[1]}`).join(';');

                    await pool.query(
                        'UPDATE `guild` SET `digica_challenge` = ? WHERE `guild_id` = ?;',
                        [challenge, interaction.guildId]
                    );
                } else {
                    challengeCards = guildRecord.digica_challenge.split(';').map(card => {
                        const [suit, value] = card.split(',').map(Number);
                        return [suit, value];
                    });
                }

                const rewardCard = [5, challengeCards.length];

                // Create a "play" button
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('play_challenge')
                            .setLabel('Play Cards')
                            .setStyle(ButtonStyle.Primary)
                    );

                const message = await interaction.reply({
                    content: `## Current Server Challenge:
${challengeCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ➡️ ${getValueEmoji(rewardCard[0], rewardCard[1], emojis)}
${challengeCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')} ➡️ ${getSuitEmoji(rewardCard[0], emojis)}`,
                    components: [row],
                    fetchReply: true
                });

                const collector = message.createMessageComponentCollector();

                collector.on('collect', async i => {
                    try {
                        // Has the challenge changed?
                        const stillValid = await validateChallenge(challengeCards, interaction.guildId, pool);
                        if (!stillValid) {
                            await channel.send(
                                "The challenge has changed since you started. Please check the new challenge."
                            );
                            collector.stop();
                            return;
                        }

                        // Fetch player's hand
                        const [[dbUser]] = await pool.query(
                            'SELECT digica_hand, challenges_completed FROM `user` WHERE `user_id` = ?;',
                            [i.user.id]
                        );
                        if (!dbUser?.digica_hand) {
                            await channel.send(`<@${i.user.id}> doesn't have any cards!`);
                            return;
                        }

                        const playerCards = dbUser.digica_hand.split(';').map(card => {
                            const [suit, value] = card.split(',').map(Number);
                            return [suit, value];
                        });

                        // Check if the user has all required cards
                        const remainingChallengeCards = [...challengeCards];
                        const remainingPlayerCards = [...playerCards];

                        // First pass: exact matches
                        for (let idx = remainingChallengeCards.length - 1; idx >= 0; idx--) {
                            const challengeCard = remainingChallengeCards[idx];
                            const exactMatchIndex = remainingPlayerCards.findIndex(playerCard =>
                                playerCard[0] === challengeCard[0] && playerCard[1] === challengeCard[1]
                            );
                            if (exactMatchIndex !== -1) {
                                remainingChallengeCards.splice(idx, 1);
                                remainingPlayerCards.splice(exactMatchIndex, 1);
                            }
                        }

                        // Second pass: jokers
                        const hasAllCards = remainingChallengeCards.every(c => {
                            const jokerIndex = remainingPlayerCards.findIndex(pc => pc[0] === 4);
                            if (jokerIndex !== -1) {
                                remainingPlayerCards.splice(jokerIndex, 1);
                                return true;
                            }
                            return false;
                        });

                        if (!hasAllCards) {
                            await channel.send(`<@${i.user.id}> doesn't have all the required cards!`);
                            return;
                        }

                        // If valid, remove them from the player's hand
                        playerCards.length = 0;
                        playerCards.push(...remainingPlayerCards);

                        // Mark the challenge as completed in our displayed message
                        await interaction.editReply({
                            content: `### Completed by <@${i.user.id}>:
${challengeCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ➡️ ${getValueEmoji(rewardCard[0], rewardCard[1], emojis)}
${challengeCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')} ➡️ ${getSuitEmoji(rewardCard[0], emojis)}`,
                            components: []
                        }).catch(() => {});

                        // Next challenge
                        await nextChallenge(i.user, [dbUser], playerCards, rewardCard, channel, emojis, pool, blankEmoji);

                    } catch (error) {
                        console.error('Error processing challenge:', error);
                        await channel.send('An error occurred while processing the challenge.');
                        collector.stop('error');
                    }
                });

        } else if (subcommand === 'buy') {
            const maxCards = 6;
                        
            // Create buttons for different pack types
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pack_hearts')
                        .setLabel('Hearts Pack')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('pack_diamonds')
                        .setLabel('Diamonds Pack')
                        .setStyle(ButtonStyle.Danger)
                );
                
            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pack_clubs')
                        .setLabel('Clubs Pack')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('pack_spades')
                        .setLabel('Spades Pack')
                        .setStyle(ButtonStyle.Secondary)
                );
                
            const row3 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pack_random')
                        .setLabel('Random Pack')
                        .setStyle(ButtonStyle.Primary)
                );
            
            // Show the buttons
            const message = await interaction.reply({
                content: `### Buy a Card Pack for ฅ${cardBuy}`,
                components: [row1, row2, row3],
                fetchReply: true
            });
            
            const collector = message.createMessageComponentCollector();
            
            collector.on('collect', async i => {                
                // Check if user still has enough scritch bucks
                const [[latestUserRecord]] = await pool.query(
                    'SELECT scritch_bucks, digica_hand FROM `user` WHERE `user_id` = ?;',
                    [i.user.id]
                );
                
                // Check if user exists in the database
                if (!latestUserRecord) {
                    await i.reply({ content: "You don't seem to have a user profile! Try interacting in the server more.", ephemeral: true });
                    return;
                }
                
                if (latestUserRecord.scritch_bucks < cardBuy) {
                    await i.reply({ 
                        content: `You don't have enough scritch bucks to buy a card pack! You need ฅ${cardBuy}, but you only have ฅ${latestUserRecord.scritch_bucks}.`, 
                        ephemeral: true
                    });
                    return;
                }
                
                // Parse latest hand
                let currentCards = [];
                if (latestUserRecord.digica_hand) {
                    currentCards = latestUserRecord.digica_hand.split(';').map(card => {
                        const [suit, value] = card.split(',').map(Number);
                        return [suit, value];
                    });
                }
                
                // Check if hand still has space
                const cardsCanAdd = maxCards - currentCards.length;
                if (cardsCanAdd <= 0) {
                    await i.reply({ 
                        content: `Your hand is already full (${currentCards.length}/${maxCards} cards)! Use \`/digica merge\` or \`/digica discard\` to make room for new cards.`, 
                        ephemeral: true
                    });
                    return;
                }
                
                // Acknowledge the button press
                await i.deferUpdate();
                
                // Determine which pack was chosen
                let packSuit;
                switch (i.customId) {
                    case 'pack_hearts': packSuit = 0; break;
                    case 'pack_diamonds': packSuit = 1; break;
                    case 'pack_clubs': packSuit = 2; break;
                    case 'pack_spades': packSuit = 3; break;
                    case 'pack_random': packSuit = 4; break;
                }
                
                // Draw cards from the pack
                const pack = shufflePack(packSuit);
                const numToDraw = Math.min(3, cardsCanAdd); // Draw up to 3 cards, but no more than we have space for
                const newCards = pack.slice(0, numToDraw);
                
                // Add new cards to hand
                const updatedHand = [...currentCards, ...newCards];
                const handString = updatedHand.map(card => `${card[0]},${card[1]}`).join(';');
                
                // Update user's scritch bucks and hand
                await pool.query(
                    'UPDATE `user` SET `scritch_bucks` = scritch_bucks - ?, `digica_hand` = ? WHERE `user_id` = ?;',
                    [cardBuy, handString, i.user.id]
                );
                
                // Show the new cards and updated hand
                await channel.send({
                    content: `### <@${i.user.id}> bought a ${packSuit === 4 ? 'Random' : ['Hearts', 'Diamonds', 'Clubs', 'Spades'][packSuit]} Pack for ฅ${cardBuy}!
 New cards: 
 ${newCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
 ${newCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
 Your updated hand (${updatedHand.length}/${maxCards}):
 ${updatedHand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
 ${updatedHand.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
 Your new balance: ฅ${latestUserRecord.scritch_bucks - cardBuy}`
                });
            });
            } else if (subcommand === 'merge') {
                // Show user's hand and let them pick two to merge
                const [[rowUser]] = await pool.query(
                    'SELECT digica_hand FROM `user` WHERE `user_id` = ?;',
                    [member.id]
                );
                if (!rowUser?.digica_hand) {
                    return interaction.reply(
                    "You don't have any cards to merge! Use \`/digica buy\` to buy some cards."
                    );
                }

                const cards = rowUser.digica_hand.split(';').map(card => {
                    const [suit, value] = card.split(',').map(Number);
                    return [suit, value];
                });

                if (cards.length < 2) {
                    return interaction.reply(`### <@${member.id}>'s Hand (no mergeable cards):
${cards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
                }

                // Check if we have any mergeable pair
                let hasMergeable = false;
                for (let i = 0; i < cards.length; i++) {
                    for (let j = i + 1; j < cards.length; j++) {
                        if (
                            (cards[i][0] === 4 && cards[j][0] === 4) ||
                            (cards[i][0] === 5 && cards[j][0] === 5 && cards[i][1] === cards[j][1]) ||
                            (cards[i][0] === cards[j][0] && cards[i][0] !== 5)
                        ) {
                            hasMergeable = true;
                            break;
                        }
                    }
                    if (hasMergeable) break;
                }
                
                if (!hasMergeable) {
                    return interaction.reply(`### <@${member.id}>'s Hand (no mergeable cards):
${cards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
                }

                // Present the user's hand and let them pick two
                const msg = await interaction.reply({ 
                    content: `### Select two cards to merge by reacting with their numbers:
${cards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
${cards.map((_, i) => getEmojiIdByNumber(i+1)).join(' ')}`,
                    fetchReply: true 
                });

                // Add number reactions
                for (let i = 1; i <= cards.length; i++) {
                    msg.react(getEmojiByNumber(i));
                }

                // Create collector
                const collector = msg.createReactionCollector({ dispose: true });
                let selectedIndices = [];

                collector.on('collect', async (reaction, user) => {
                    if(user.bot) return;

                    if (user.id !== member.id) {
                        await reaction.users.remove(user);
                        return;
                    }

                    // Validate the user's current hand in DB
                    const stillValid = await validateCards(cards, member, pool);
                    if (!stillValid) {
                        await channel.send(
                            "Your hand has changed since starting the merge. Please try again."
                        );
                        return;
                    }

                    const index = getNumberByEmoji(reaction.emoji.name) - 1;
                    if (index >= 0 && index < cards.length && !selectedIndices.includes(index)) {
                        selectedIndices.push(index);
                    }

                    if (selectedIndices.length !== 2) return;

                    // Merge logic
                    const [card1, card2] = [
                        cards[selectedIndices[0]],
                        cards[selectedIndices[1]]
                    ];
                    let newCard;
                    if(card1[0] !== card2[0]){
                        await channel.send(
                            "Cards must be two cards of the same suit or both scritch cards of the same value."
                        );
                        // reset the user's reaction picks
                        await msg.reactions.cache.forEach(async r => await r.users.remove(user.id));
                        selectedIndices = [];
                        return;
                    } else if (card1[1] === 13 || card2[1] === 13) {
                        // King merge with same suit - let user choose new suit
                        let newValue = card1[1] === 13 ? card2[1] : card1[1];

                        // Create suit selection buttons
                        const row = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('suit_hearts')
                                    .setLabel('Hearts')
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId('suit_diamonds')
                                    .setLabel('Diamonds')
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId('suit_clubs')
                                    .setLabel('Clubs')
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('suit_spades')
                                    .setLabel('Spades')
                                    .setStyle(ButtonStyle.Secondary)
                            );

                        const suitMessage = await channel.send({
                            content: `### Choose a suit for your merged card (${valueFaces[newValue]}):`,
                            components: [row]
                        });

                        const suitCollector = suitMessage.createMessageComponentCollector();

                        suitCollector.on('collect', async i => {
                            i.deferUpdate();

                            if (i.user.id !== member.id) return; 

                            let newSuit;
                            switch (i.customId) {
                                case 'suit_hearts': newSuit = 0; break;
                                case 'suit_diamonds': newSuit = 1; break;
                                case 'suit_clubs': newSuit = 2; break;
                                case 'suit_spades': newSuit = 3; break;
                            }

                            newCard = [newSuit, newValue];
                        
                            if(card1[1] === 13 && card2[1] === 13){
                                const userCatDB = await pool.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
                                    [member.id, 14, member.displayName, 'Kane']);
                                if(userCatDB[0].affectedRows){
                                    await channel.send({content: `<@${member.id}> just gained ownership of Kane by merging two Kings! This unlocks the \`/poster\` command.`, files: ['images/cats/Kane.jpg']});
                                }
                            }

                            // Remove them from the array, add new card
                            cards.splice(Math.max(selectedIndices[0], selectedIndices[1]), 1);
                            cards.splice(Math.min(selectedIndices[0], selectedIndices[1]), 1);
                            cards.push(newCard);

                            // Update DB
                            const newHand = cards.map(card => `${card[0]},${card[1]}`).join(';');
                            await pool.query(
                                'UPDATE `user` SET `digica_hand` = ? WHERE `user_id` = ?;',
                                [newHand, member.id]
                            );

                            collector.stop()

                            suitMessage.delete();

                            // Check if further merges are possible
                            await handleNextMerge(cards, member, channel, emojis, pool, blankEmoji);
                        });
                    } else {
                        if(card1[0] === 4){
                            // Two Jokers => level 2 scritch
                            newCard = [5, 2];
                        } else if (card1[0] === 5) {
                            if(card1[1] !== card2[1]){
                                await channel.send(
                                    "Cards must be two cards of the same suit or both scritch cards of the same value."
                                );
                                // reset the user's reaction picks
                                await msg.reactions.cache.forEach(async r => await r.users.remove(user.id));
                                selectedIndices = [];
                                return;
                            } else {
                                // Same-level scritch => next level
                                newCard = [5, card1[1] + 1];
                            }
                        } else {
                            // Same suit => add values
                            let newValue = card1[1] + card2[1];
                            if (newValue > 13) newValue -= 13;
                            newCard = [card1[0], newValue];
                        }

                        // Remove them from the array, add new card
                        cards.splice(Math.max(selectedIndices[0], selectedIndices[1]), 1);
                        cards.splice(Math.min(selectedIndices[0], selectedIndices[1]), 1);
                        cards.push(newCard);

                        // Update DB
                        const newHand = cards.map(card => `${card[0]},${card[1]}`).join(';');
                        await pool.query(
                            'UPDATE `user` SET `digica_hand` = ? WHERE `user_id` = ?;',
                            [newHand, member.id]
                        );

                        // Remove the bot's reactions
                        collector.stop();

                        // Check if further merges are possible
                        await handleNextMerge(cards, member, channel, emojis, pool, blankEmoji);
                    }
                });

                collector.on('remove', (reaction, user) => {
                    const index = getNumberByEmoji(reaction.emoji.name) - 1;
                    selectedIndices = selectedIndices.filter(i => i !== index);
                });
            } else if (subcommand === 'discard') {
                try {
                    // Let user discard cards from their hand
                    const [[uRecord]] = await pool.query(
                        'SELECT digica_hand FROM `user` WHERE `user_id` = ?;',
                        [member.id]
                    );
                    if (!uRecord?.digica_hand) {
                        return interaction.reply("You don't have any cards to discard!");
                    }

                    const cards = uRecord.digica_hand.split(';').map(card => {
                        const [suit, value] = card.split(',').map(Number);
                        return [suit, value];
                    });

                    const message = await interaction.reply({
                        content: `### Select cards to discard (react with ✅ to apply or ❌ to cancel):
${cards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
${cards.map((_, i) => getEmojiIdByNumber(i+1)).join(' ')}`,
                        fetchReply: true
                    });

                    // Add number reactions for card selection
                    for (let i = 1; i <= cards.length; i++) {
                        message.react(getEmojiByNumber(i));
                    }
                    // Add apply/decline reactions
                    message.react('✅');
                    message.react('❌');

                    const collector = message.createReactionCollector({ dispose: true });
                    let selectedIndices = [];

                    collector.on('collect', async (reaction, user) => {
                        if(user.bot) return;

                        // Only allow the command user to interact
                        if (user.id !== member.id) {
                            await reaction.users.remove(user);
                            return;
                        }

                        // Validate the user's current hand in DB
                        const stillValid = await validateCards(cards, member, pool);
                        if (!stillValid) {
                            await interaction.editReply("Your hand has changed since starting the discard. Please try again.").catch(() => {});
                            await message.reactions?.removeAll().catch(() => {});
                            return;
                        }

                        // Handle apply/decline reactions
                        if (reaction.emoji.name === '✅') {
                            if (selectedIndices.length === 0) {
                                await channel.send("Please select at least one card to discard!");
                                return;
                            }

                            // Calculate total scritch bucks gained
                            let totalScritchBucks = 0;
                            const discardedCards = selectedIndices.map(i => cards[i]);
                            discardedCards.forEach(card => {
                                if (card[0] === 5) {
                                    totalScritchBucks += getScritchValue(card[1]);
                                }
                            });

                            // Remove selected cards from the array
                            selectedIndices.sort((a, b) => b - a); // Sort in descending order to remove from end
                            selectedIndices.forEach(index => cards.splice(index, 1));

                            // Update DB
                            const [[userDB]] = await pool.query(
                                'SELECT scritch_bucks, scritch_bucks_highscore FROM `user` WHERE `user_id` = ?;',
                                [member.id]
                            );
                            const newScritchBucks = userDB.scritch_bucks + totalScritchBucks;
                            const highestScritchBucks = Math.max(newScritchBucks, userDB.scritch_bucks_highscore);
                            const newHand = cards.length > 0 ? cards.map(card => `${card[0]},${card[1]}`).join(';') : null;

                            await pool.query(
                                'UPDATE `user` SET `digica_hand` = ?, `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                                [newHand, newScritchBucks, highestScritchBucks, member.id]
                            );

                            // If they gained scritch bucks
                            if(totalScritchBucks > 0) {
                                await channel.send(
                                    `### Gained ฅ${totalScritchBucks} from discarding scritch cards`
                                );
                                await pool.query(
                                    'INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
                                    [member.id, newScritchBucks, member.username]
                                );
                            }

                            // Show the new hand
                            await interaction.editReply(
                                `### ${cards.length > 0 ? 'Your new hand:' : 'Your hand is now empty!'}
${cards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`
                            ).catch(() => {});
                            await message.reactions?.removeAll().catch(() => {});
                            collector.stop();
                        } else if (reaction.emoji.name === '❌') {
                            // Show the current hand without changes
                            await interaction.editReply(
                                `### Your hand (no changes):
${cards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`
                            ).catch(() => {});
                            await message.reactions?.removeAll().catch(() => {});
                            collector.stop();
                        } else {
                            // Handle number reactions for card selection
                            const index = getNumberByEmoji(reaction.emoji.name) - 1;
                            if (index >= 0 && index < cards.length) {
                                if (!selectedIndices.includes(index)) {
                                    selectedIndices.push(index);
                                } else {
                                    selectedIndices = selectedIndices.filter(i => i !== index);
                                }
                            }
                        }
                    });

                    collector.on('remove', (reaction, user) => {
                        if (user.bot) return;
                        if (reaction.emoji.name !== '✅' && reaction.emoji.name !== '❌') {
                            const index = getNumberByEmoji(reaction.emoji.name) - 1;
                            selectedIndices = selectedIndices.filter(i => i !== index);
                        }
                    });
                } catch (error) {
                    console.error("Error in discard command:", error);
                    await interaction.editReply("An error occurred while processing your request.").catch(() => {});
                }
        } else if (subcommand === 'give') {
            const targetUser = interaction.options.getUser('user');
                
            // Check if the target user is valid (not a bot, not the same as the giver)
            if (targetUser.bot) {
                return interaction.reply("You can't give cards to a bot!");
            }
            
            if (targetUser.id === member.id) {
                return interaction.reply("You can't give cards to yourself!");
            }
            
            try {
                // Get giver's hand
                const [[giverRecord]] = await pool.query(
                    'SELECT digica_hand FROM `user` WHERE `user_id` = ?;',
                    [member.id]
                );
                
                if (!giverRecord?.digica_hand) {
                    return interaction.reply("You don't have any cards to give!");
                }
                
                const giverCards = giverRecord.digica_hand.split(';').map(card => {
                    const [suit, value] = card.split(',').map(Number);
                    return [suit, value];
                });
                
                // Get recipient's hand
                const [[recipientRecord]] = await pool.query(
                    'SELECT digica_hand FROM `user` WHERE `user_id` = ?;',
                    [targetUser.id]
                );
                
                let recipientCards = [];
                if (recipientRecord?.digica_hand) {
                    recipientCards = recipientRecord.digica_hand.split(';').map(card => {
                        const [suit, value] = card.split(',').map(Number);
                        return [suit, value];
                    });
                }
                
                // Check if recipient has room in their hand
                const maxCards = 6;
                const availableSpace = maxCards - recipientCards.length;
                
                if (availableSpace <= 0) {
                    return interaction.reply(`${targetUser.username}'s hand is already full (6/6 cards)! They need to make room before you can give them cards.`);
                }
                
                // Display giver's hand and let them select cards to give
                const message = await interaction.reply({
                    content: `### Select cards to give to ${targetUser.username} (react with ✅ to confirm or ❌ to cancel):
${giverCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${giverCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
${giverCards.map((_, i) => getEmojiIdByNumber(i+1)).join(' ')}
${targetUser.username} has ${recipientCards.length}/${maxCards} cards (space for ${availableSpace} more)`,
                    fetchReply: true
                });
                
                // Add number reactions for card selection
                for (let i = 1; i <= giverCards.length; i++) {
                    message.react(getEmojiByNumber(i));
                }
                
                // Add confirm/cancel reactions
                message.react('✅');
                message.react('❌');
                
                const collector = message.createReactionCollector({ dispose: true });
                let selectedIndices = [];
                
                collector.on('collect', async (reaction, user) => {
                    if (user.bot) return;
                    
                    // Only the command user can interact
                    if (user.id !== member.id) {
                        await reaction.users.remove(user);
                        return;
                    }
                    
                    // Validate the user's current hand hasn't changed
                    const stillValid = await validateCards(giverCards, member, pool);
                    if (!stillValid) {
                        await interaction.editReply("Your hand has changed since starting the give process. Please try again.").catch(() => {});
                        await message.reactions?.removeAll().catch(() => {});
                        return;
                    }
                    
                    // Handle confirm/cancel
                    if (reaction.emoji.name === '✅') {
                        if (selectedIndices.length === 0) {
                            await channel.send("Please select at least one card to give!");
                            return;
                        }
                        
                        if (selectedIndices.length > availableSpace) {
                            await channel.send(`You can only give ${availableSpace} card${availableSpace > 1 ? 's' : ''} to ${targetUser.username}!`);
                            return;
                        }
                        
                        // Get the most up-to-date recipient hand to ensure they still have space
                        const [[latestRecipient]] = await pool.query(
                            'SELECT digica_hand FROM `user` WHERE `user_id` = ?;',
                            [targetUser.id]
                        );
                        
                        let currentRecipientCards = [];
                        if (latestRecipient?.digica_hand) {
                            currentRecipientCards = latestRecipient.digica_hand.split(';').map(card => {
                                const [suit, value] = card.split(',').map(Number);
                                return [suit, value];
                            });
                        }
                        
                        const currentSpace = maxCards - currentRecipientCards.length;
                        if (currentSpace < selectedIndices.length) {
                            await interaction.editReply(`${targetUser.username}'s hand is too full now! They only have space for ${currentSpace} more cards.`).catch(() => {});
                            await message.reactions?.removeAll().catch(() => {});
                            return;
                        }
                        
                        // Get the cards being given
                        const cardsToGive = selectedIndices.map(index => giverCards[index]);
                        
                        // Remove the selected cards from giver's hand
                        selectedIndices.sort((a, b) => b - a); // Sort in descending order to remove from end
                        const updatedGiverCards = [...giverCards];
                        selectedIndices.forEach(index => updatedGiverCards.splice(index, 1));
                        
                        // Add the cards to recipient's hand
                        const updatedRecipientCards = [...currentRecipientCards, ...cardsToGive];
                        
                        // Update both users in the database
                        const newGiverHand = updatedGiverCards.length > 0 ? 
                            updatedGiverCards.map(card => `${card[0]},${card[1]}`).join(';') : null;
                        
                        const newRecipientHand = updatedRecipientCards.map(card => `${card[0]},${card[1]}`).join(';');
                        
                        await Promise.all([
                            pool.query(
                                'UPDATE `user` SET `digica_hand` = ? WHERE `user_id` = ?;',
                                [newGiverHand, member.id]
                            ),
                            pool.query(
                                'UPDATE `user` SET `digica_hand` = ? WHERE `user_id` = ?;',
                                [newRecipientHand, targetUser.id]
                            )
                        ]);
                        
                        // Show the result
                        await interaction.editReply({
                            content: `### You gave ${cardsToGive.length} card${cardsToGive.length > 1 ? 's' : ''} to ${targetUser.username}!
Cards given:
${cardsToGive.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cardsToGive.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
Your new hand (${updatedGiverCards.length}/${maxCards}):
${updatedGiverCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${updatedGiverCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`,
                            components: []
                        }).catch(() => {});
                        
                        // Notify the recipient 
                        try {
                            await channel.send({
                                content: `### <@${targetUser.id}>, <@${member.id}> gave you ${cardsToGive.length} card${cardsToGive.length > 1 ? 's' : ''}!
<@${member.id}>'s new hand (${updatedGiverCards.length}/${maxCards}):
${updatedGiverCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${updatedGiverCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
<@${targetUser.id}> new hand (${updatedRecipientCards.length}/${maxCards}):
${updatedRecipientCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${updatedRecipientCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`
                            });
        } catch (error) {
                            console.error("Error notifying recipient:", error);
                        }
                        
                        await message.reactions?.removeAll().catch(() => {});
                        collector.stop();
                        
                    } else if (reaction.emoji.name === '❌') {
                        // Cancel the giving process
                        await interaction.editReply({
                            content: `### Giving canceled - your hand remains unchanged:
${giverCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${giverCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`,
                            components: []
                        }).catch(() => {});
                        
                        await message.reactions?.removeAll().catch(() => {});
                        collector.stop();
                        
                    } else {
                        // Handle number reactions for card selection
                        const index = getNumberByEmoji(reaction.emoji.name) - 1;
                        if (index >= 0 && index < giverCards.length) {
                            if (!selectedIndices.includes(index)) {
                                selectedIndices.push(index);
                            } else {
                                selectedIndices = selectedIndices.filter(i => i !== index);
                            }
                        }
                    }
                });
                
                collector.on('remove', (reaction, user) => {
                    if (user.bot) return;
                    if (reaction.emoji.name !== '✅' && reaction.emoji.name !== '❌') {
                        const index = getNumberByEmoji(reaction.emoji.name) - 1;
                        selectedIndices = selectedIndices.filter(i => i !== index);
                    }
                });
            } catch (error) {
                console.error("Error in give command:", error);
            return interaction.reply("An error occurred while processing your request.");
            }
        } else if (subcommand === 'trade') {
            try {
                // Get trader's hand
                const [[traderRecord]] = await pool.query(
                    'SELECT digica_hand FROM `user` WHERE `user_id` = ?;',
                    [member.id]
                );
                
                if (!traderRecord?.digica_hand) {
                    return interaction.reply("You don't have any cards to trade!");
                }
                
                const traderCards = traderRecord.digica_hand.split(';').map(card => {
                    const [suit, value] = card.split(',').map(Number);
                    return [suit, value];
                });
                
                // Display trader's hand and let them select cards to trade
                const message = await interaction.reply({
                    content: `### Select cards to offer for trade (react with ✅ to confirm or ❌ to cancel):
${traderCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${traderCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
${traderCards.map((_, i) => getEmojiIdByNumber(i+1)).join(' ')}`,
                    fetchReply: true
                });
                
                // Add number reactions for card selection
                for (let i = 1; i <= traderCards.length; i++) {
                    message.react(getEmojiByNumber(i));
                }
                
                // Add confirm/cancel reactions
                message.react('✅');
                message.react('❌');
                
                const collector = message.createReactionCollector({ dispose: true });
                let selectedIndices = [];
                
                collector.on('collect', async (reaction, user) => {
                    if (user.bot) return;
                    
                    // Only the command user can interact
                    if (user.id !== member.id) {
                        await reaction.users.remove(user);
                        return;
                    }
                    
                    // Validate the user's current hand hasn't changed
                    const stillValid = await validateCards(traderCards, member, pool);
                    if (!stillValid) {
                        await interaction.editReply("Your hand has changed since starting the trade. Please try again.").catch(() => {});
                        await message.reactions?.removeAll().catch(() => {});
                        collector.stop();
                        return;
                    }
                    
                    // Handle confirm/cancel
                    if (reaction.emoji.name === '✅') {
                        if (selectedIndices.length === 0) {
                            await channel.send("Please select at least one card to offer!");
                            return;
                        }
                        
                        // Get the cards being offered
                        const cardsToOffer = selectedIndices.map(index => traderCards[index]);
                        
                        // Create "Offer Trade" button for others to respond with
                        const offerRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('trade_offer')
                                    .setLabel('Offer Your Cards')
                                    .setStyle(ButtonStyle.Primary)
                            );
                            
                        // Show the trade offer
                        await interaction.editReply({
                            content: `### <@${member.id}> is offering ${cardsToOffer.length} card${cardsToOffer.length > 1 ? 's' : ''} for trade:
${cardsToOffer.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cardsToOffer.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
Click the button below to offer your cards in exchange!`,
                            components: [offerRow]
                        }).catch(() => {});
                        
                        await message.reactions?.removeAll().catch(() => {});
                        collector.stop();
                        
                        // Create collector for trade offers
                        // Track users who are currently making offers
                        const activeOffers = new Set();
                        
                        const offerCollector = message.createMessageComponentCollector();
                        
                        offerCollector.on('collect', async i => {
                            // Don't allow the original trader to respond
                            if (i.user.id === member.id) {
                                await i.reply({ content: "You can't trade with yourself!", ephemeral: true });
                                return;
                            }
                            
                            // Check if the user is already making an offer
                            if (activeOffers.has(i.user.id)) {
                                await i.reply({ content: "You already have a pending counter-offer for this trade. Please complete or cancel it first.", ephemeral: true });
                                return;
                            }
                            
                            // Get responder's hand
                            const [[responderRecord]] = await pool.query(
                                'SELECT digica_hand FROM `user` WHERE `user_id` = ?;',
                                [i.user.id]
                            );
                            
                            if (!responderRecord?.digica_hand) {
                                await i.reply({ content: "You don't have any cards to trade!", ephemeral: true });
                                return;
                            }
                            
                            const responderCards = responderRecord.digica_hand.split(';').map(card => {
                                const [suit, value] = card.split(',').map(Number);
                                return [suit, value];
                            });
                            
                            // Validate that the original trader still has their cards
                            const traderHandStillValid = await validateCards(traderCards, member, pool);
                            if (!traderHandStillValid) {
                                await i.reply({ content: "The trader's cards have changed. This trade is no longer valid.", ephemeral: true });
                                await interaction.editReply({ components: [] }).catch(() => {});
                                offerCollector.stop();
                                return;
                            }
                            
                            // Verify the original trader has enough space for a potential trade
                            const maxCards = 6;
                            const traderSpace = maxCards - (traderCards.length - cardsToOffer.length);
                            
                            if (traderSpace <= 0) {
                                await i.reply({ content: `${member.user.username} wouldn't have enough space for your cards after the trade.`, ephemeral: true });
                                return;
                            }
                            
                            // Add user to active offers
                            activeOffers.add(i.user.id);
                            
                            i.deferUpdate();

                            // Create a new message for the responder to select their cards
                            const responderMsg = await channel.send({
                                content: `### Select cards to offer to <@${member.id}> by reacting with their numbers:
Select cards and then react with ✅ to confirm your offer or ❌ to cancel.
Your hand:
${responderCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${responderCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
${responderCards.map((_, i) => getEmojiIdByNumber(i+1)).join(' ')}
<@${i.user.id}> can offer up to ${Math.min(responderCards.length, traderSpace)} card(s).`
                            });
                            
                            // Add number reactions for card selection
                            for (let i = 1; i <= responderCards.length; i++) {
                                responderMsg.react(getEmojiByNumber(i));
                            }
                            
                            // Add confirm/cancel reactions
                            await responderMsg.react('✅');
                            await responderMsg.react('❌');
                            
                            // Create collector for the responder's emoji reactions
                            const responderCollector = responderMsg.createReactionCollector({ 
                                filter: (reaction, user) => !user.bot && user.id === i.user.id,
                                dispose: true
                            });
                            
                            let selectedIndices = [];
                            
                            responderCollector.on('collect', async (reaction, user) => {
                                // Handle confirm/cancel reactions
                                if (reaction.emoji.name === '✅') {
                                    // Validate the selection
                                    if (selectedIndices.length === 0) {
                                        await channel.send(`<@${i.user.id}>, please select at least one card to offer!`);
                                        return;
                                    }
                                    
                                    if (selectedIndices.length > traderSpace) {
                                        await channel.send(`<@${i.user.id}>, you selected too many cards! You can only offer up to ${traderSpace} card(s).`);
                                        return;
                                    }
                                  
                                    // Get the cards being offered by the responder
                                    const cardsOfferedByResponder = selectedIndices.map(index => responderCards[index]);
                                  
                                    // Recheck that the original trader's cards are still valid
                                    const traderStillValid = await validateCards(traderCards, member, pool);
                                    if (!traderStillValid) {
                                        await channel.send(`<@${i.user.id}>, the trader's cards have changed. This trade is no longer valid.`);
                                        await interaction.editReply({ components: [] }).catch(() => {});
                                        offerCollector.stop();
                                        return;
                                    }
                                  
                                    // Create accept/decline buttons for the original trader
                                    const acceptRow = new ActionRowBuilder()
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setCustomId('accept_trade')
                                                .setLabel('Accept Trade')
                                                .setStyle(ButtonStyle.Success),
                                            new ButtonBuilder()
                                                .setCustomId('decline_trade')
                                                .setLabel('Decline Trade')
                                                .setStyle(ButtonStyle.Danger)
                                        );
                                    
                                    // Show the trade offer to everyone in the channel
                                    const tradeOfferMsg = await channel.send({
                                        content: `### Trade Offer
<@${member.id}> is offering:
${cardsToOffer.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cardsToOffer.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
<@${i.user.id}> is offering:
${cardsOfferedByResponder.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cardsOfferedByResponder.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
<@${member.id}>, do you accept this trade?`,
                                        components: [acceptRow]
                                    });
                                    
                                    // Update responder message to show it's completed
                                    await responderMsg.edit({
                                        content: `### Trade offer sent to <@${member.id}>:
${cardsOfferedByResponder.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cardsOfferedByResponder.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
Waiting for <@${member.id}> to respond...`
                                    });
                                    
                                    // Stop collecting reactions on the responder message
                                    responderCollector.stop();
                                    await responderMsg.reactions.removeAll().catch(() => {});
                                    
                                    // Create collector for the accept/decline buttons
                                    const decisionCollector = tradeOfferMsg.createMessageComponentCollector({
                                        filter: buttonInteraction => 
                                            (buttonInteraction.customId === 'accept_trade' || buttonInteraction.customId === 'decline_trade') && 
                                            buttonInteraction.user.id === member.id,
                                    });
                                    
                                    decisionCollector.on('collect', async buttonInteraction => {
                                        if (buttonInteraction.customId === 'accept_trade') {
                                            // Check one more time that both users still have the cards
                                            const [[latestTraderRecord]] = await pool.query(
                                                'SELECT digica_hand FROM `user` WHERE `user_id` = ?;',
                                                [member.id]
                                            );
                                            
                                            const [[latestResponderRecord]] = await pool.query(
                                                'SELECT digica_hand FROM `user` WHERE `user_id` = ?;',
                                                [i.user.id]
                                            );
                                            
                                            if (!latestTraderRecord?.digica_hand || !latestResponderRecord?.digica_hand) {
                                                await channel.send("One of the traders no longer has cards!");
                                                await buttonInteraction.update({
                                                    content: "Trade cancelled - one of the traders no longer has cards!",
                                                    components: []
                                                });
                                                return;
                                            }
                                            
                                            const latestTraderCards = latestTraderRecord.digica_hand.split(';').map(card => {
                                                const [suit, value] = card.split(',').map(Number);
                                                return [suit, value];
                                            });
                                            
                                            const latestResponderCards = latestResponderRecord.digica_hand.split(';').map(card => {
                                                const [suit, value] = card.split(',').map(Number);
                                                return [suit, value];
                                            });
                                            
                                            // Verify all cards from both users are still in their hands
                                            const traderHasCards = cardsToOffer.every(card => 
                                                latestTraderCards.some(c => c[0] === card[0] && c[1] === card[1])
                                            );
                                            
                                            const responderHasCards = cardsOfferedByResponder.every(card => 
                                                latestResponderCards.some(c => c[0] === card[0] && c[1] === card[1])
                                            );
                                            
                                            if (!traderHasCards || !responderHasCards) {
                                                await channel.send("Some cards are no longer available for trade!");
                                                await buttonInteraction.update({
                                                    content: "Trade cancelled - some cards are no longer available!",
                                                    components: []
                                                });
                                                return;
                                            }
                                            
                                            // Remove the traded cards from each user's hand
                                            const updatedTraderCards = latestTraderCards.filter(card => 
                                                !cardsToOffer.some(c => c[0] === card[0] && c[1] === card[1])
                                            );
                                            
                                            const updatedResponderCards = latestResponderCards.filter(card => 
                                                !cardsOfferedByResponder.some(c => c[0] === card[0] && c[1] === card[1])
                                            );
                                            
                                            // Add the received cards to each user's hand
                                            updatedTraderCards.push(...cardsOfferedByResponder);
                                            updatedResponderCards.push(...cardsToOffer);
                                            
                                            // Update both users in the database
                                            const newTraderHand = updatedTraderCards.map(card => `${card[0]},${card[1]}`).join(';');
                                            const newResponderHand = updatedResponderCards.map(card => `${card[0]},${card[1]}`).join(';');
                                            
                                            await Promise.all([
                                                pool.query(
                                                    'UPDATE `user` SET `digica_hand` = ? WHERE `user_id` = ?;',
                                                    [newTraderHand, member.id]
                                                ),
                                                pool.query(
                                                    'UPDATE `user` SET `digica_hand` = ? WHERE `user_id` = ?;',
                                                    [newResponderHand, i.user.id]
                                                )
                                            ]);
                                            
                                            // Notify both users of the successful trade
                                            await buttonInteraction.update({
                                                content: '### Trade Completed!',
                                                components: []
                                            });
                                            
                                            // Notify both users of the successful trade
                                            await channel.send(`### Trade Completed!
<@${member.id}> traded:
${cardsToOffer.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cardsToOffer.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
<@${i.user.id}> traded:
${cardsOfferedByResponder.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${cardsOfferedByResponder.map(card => getSuitEmoji(card[0], emojis)).join(' ')}
The trade was successful!`);
                                            
                                            // Update the original message to prevent further offers
                                            await interaction.editReply({ components: [] }).catch(() => {});
                                            offerCollector.stop();
                                            
                                            // Remove user from active offers
                                            activeOffers.delete(i.user.id);
                                            
                                        } else {
                                            // Trade declined
                                            await buttonInteraction.update({
                                                content: `### Trade Declined
<@${member.id}> has declined the trade offer from <@${i.user.id}>.`,
                                                components: []
                                            });
                                            
                                            // Remove user from active offers
                                            activeOffers.delete(i.user.id);
                                        }
                                    });
                                } else if (reaction.emoji.name === '❌') {                                   
                                    // Update responder message to show it's canceled
                                    await responderMsg.edit({
                                        content: `### Counter offer canceled by <@${i.user.id}>:
${responderCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${responderCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`
                                    });
                                    
                                    // Clean up collectors and reactions
                                    responderCollector.stop();
                                    await responderMsg.reactions.removeAll().catch(() => {});
                                    await message.reactions?.removeAll().catch(() => {});
                                    
                                    // Remove user from active offers
                                    activeOffers.delete(i.user.id);
                                } else {
                                    // Handle number reactions for card selection
                                    const index = getNumberByEmoji(reaction.emoji.name) - 1;
                                    if (index >= 0 && index < responderCards.length && !selectedIndices.includes(index)) {
                                        selectedIndices.push(index);
                                    }
                                }
                            });
                            
                            responderCollector.on('remove', (reaction, user) => {
                                const index = getNumberByEmoji(reaction.emoji.name) - 1;
                                selectedIndices = selectedIndices.filter(i => i !== index);
                            });
                        });
                        
                    } else if (reaction.emoji.name === '❌') {
                        // Cancel the trade
                        await interaction.editReply({
                            content: `### Trade canceled - your hand remains unchanged:
${traderCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${traderCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`,
                            components: []
                        }).catch(() => {});
                        
                        await message.reactions?.removeAll().catch(() => {});
                        collector.stop();
                        
                    } else {
                        // Handle number reactions for card selection
                        const index = getNumberByEmoji(reaction.emoji.name) - 1;
                        if (index >= 0 && index < traderCards.length) {
                            if (!selectedIndices.includes(index)) {
                                selectedIndices.push(index);
                            } else {
                                selectedIndices = selectedIndices.filter(i => i !== index);
                            }
                        }
                    }
                });
                
                collector.on('remove', (reaction, user) => {
                    if (user.bot) return;
                    if (reaction.emoji.name !== '✅' && reaction.emoji.name !== '❌') {
                        const index = getNumberByEmoji(reaction.emoji.name) - 1;
                        selectedIndices = selectedIndices.filter(i => i !== index);
                    }
                });
                
            } catch (error) {
                console.error("Error in trade command:", error);
                return interaction.reply("An error occurred while processing your request.");
            }
        }
    }
};
