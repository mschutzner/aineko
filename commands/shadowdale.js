const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { sleep, shuffle, randInt } = require("../utils.js");
require('dotenv').config();

function NPC(name, id){
    this.name = name;
    this.id = id;
}

NPC.prototype.toString = function npcToString() {
    return `${this.name} (NPC)`;
};

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

function getSuitEmoji(suit, emojis){
    return getEmoji(emojis, ['hearts_suit', 'diamonds_suit', 'clubs_suit', 'spades_suit', 'joker_bottom'][suit]);
}


function communityCardsString(communityCards, stage, emojis) { 
    const blackCard = getEmoji(emojis, 'blank_card');
    const blankSuit = getEmoji(emojis, 'blank_suit');
    switch(stage){
        case 0: // Pre-flop
            return `${blackCard} ${blackCard} ${blackCard} ${blackCard} ${blackCard}
${blankSuit} ${blankSuit} ${blankSuit} ${blankSuit} ${blankSuit}`;
        
        case 1: // Flop (first 3 cards)
            if(communityCards[4][0] === 4){ // joker river
                return `${communityCards.slice(0, 3).map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ${blackCard} ${getValueEmoji(4, 0, emojis)}
${communityCards.slice(0, 3).map(card => getSuitEmoji(card[0], emojis)).join(' ')} ${blankSuit} ${getSuitEmoji(4, emojis)}`;
            } else {
                return `${communityCards.slice(0, 3).map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ${blackCard} ${blackCard}
${communityCards.slice(0, 3).map(card => getSuitEmoji(card[0], emojis)).join(' ')} ${blankSuit} ${blankSuit}`;
            }
        case 2: // Turn (4 cards)
            if(communityCards[4][0] === 4){ // joker river
                return `${communityCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${communityCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`;
            } else {
                return `${communityCards.slice(0, 4).map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ${blackCard}
${communityCards.slice(0, 4).map(card => getSuitEmoji(card[0], emojis)).join(' ')} ${blankSuit}`;
            }        
        case 3: // River (all 5 cards)
        case 4: // Showdown (all 5 cards)
            return `${communityCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${communityCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`;
    }
}

function getD6Emoji(value, emojis){
    return getEmoji(emojis, ['d6_1', 'd6_2', 'd6_3', 'd6_4', 'd6_5', 'd6_6'][value-1]);
}

const wildMagicTable = [
    null,
    null,
    '### Shadow Trick (2): The main pot is reduced by half, and the other half is given to the dealer.',
    '### Chaotic Deal (3): All players still in the game discard their current hole cards and receive two new ones from the deck.',
    '### The Swap (4): Each player gives their hole cards to the next player.',
    '### Spread the Love (5): Every player still in the game draws a third hole card.',
    '### Split the Pot (6): At the showdown, the pots are split evenly between the players with the highest and lowest hands that are in each pot.',
    '### Wild River (7): The river card is replaced with a joker card that is a wild card.', 
    '### Modron Madness (8): A lawful nuertral NPC modron buys in at the start of the next round.',
    '### Random Reveal (9): A random player that has not folded must reveal their hole cards.',
    '### The Big Reveal (10): All players still in the game must reveal their hole cards.',
    '### Instant Showdown (11): The game skips straight to the Showdown.',
    '### Ultimate Showdown (12): The call ammount is raised by the bet limit. All players still in the game automatically call or go all-in and the game skips straight to the Showdown.'
]

const modronNames = [
    'C0g-1',
    'Br455',
    'G34r',
    'St34m',
    'B055',
    'TR3k',
    'R0N',
    'Pr0c',
    'L0g1c',
    'V4p0r',
    'Ur1st'
];

const fantasyNames = [
    'Skrimpy',
    'Thaelar',
    'Lyra',
    'Kaelon',
    'Zephyr',
    'Sylvaine',
    'Roran',
    'Astrild',
    'Eldred',
    'Nyra',
    'Thorne',
    'Varis',
    'Maeve',
    'Cyrus',
    'Elowen',
    'Isolde',
    'Thaddeus',
    'Ravenna',
    'Finn',
    'Aria'
];

async function applyWildMagic(deck, players, pots, communityCards, stage, buyIn, startingCallAmount, wildMagic, channel, emojis){
    switch(wildMagic){
        case 2: //shadow trick
            const halfAmount = Math.ceil(pots[0].amount / 2);
            pots[0].amount -= halfAmount;
            pots.push({
                wild: true,
                amount: halfAmount,
                players: [players[0]],
            });
            await channel.send(`## ${players[0].member.toString()} has won the wild pot!`);
            break;
        case 3: //chaotic deal
            for (const player of players){
                if(player.folded) continue;
                //replace each players hand with 2 newc ards
                player.hand = deck.splice(0, 2);
                // Sort the hand by card value, treating Aces as high
                player.hand.sort((a, b) => (b[1] === 1 ? 14 : b[1]) - (a[1] === 1 ? 14 : a[1]));

                if(!player.npc) await player.member.send(`**Your new hand:**
${player.hand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${player.hand.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
            }
            break;
        case 4: //the swap  
            let firstPlayerHand = players[players.length - 1].hand;
            for (let i = players.length - 1; i > 0; i--){
                //replace each players hand with the next players hand
                players[i].hand = players[i-1].hand;

                if(!players[i].npc) await players[i].member.send(`## ${players[i-1].member.toString()} gave you their hole cards.
**Your new hand:**
${players[i].hand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${players[i].hand.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
            }
            players[0].hand = firstPlayerHand;
            if(!players[0].npc) await players[0].member.send(`## ${players[players.length - 1].member.toString()} gave you their hole cards.
**Your new hand:**
${players[0].hand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${players[0].hand.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
            break;
        case 5: //spread the love
            for (const player of players){
                if(player.folded) continue;
                //replace each players hand with 2 newc ards
                player.hand.push(deck.splice(0, 1)[0]);
                // Sort the hand by card value, treating Aces as high
                player.hand.sort((a, b) => (b[1] === 1 ? 14 : b[1]) - (a[1] === 1 ? 14 : a[1]));
                if(!player.npc) await player.member.send(`**Your new hand:**
${player.hand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${player.hand.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
            }
            break;
        case 6: //split the pot (nothing happens until the pots are distributed)
            break;
        case 7: //wild river
            communityCards[4] = [4, 0];
            break;
        case 8: //modron madness
            if(players.length > 10){
                await channel.send('There are already to many players for the modron to join!');
                break;
            }
            let modronName;
            do {
                modronName = modronNames[Math.floor(Math.random() * modronNames.length)];
            } while (players.some(player => player.member && player.member.name === modronName));
            const highestId = players.reduce((max, player) => 
                player.npc ? Math.max(player.member.id, max) : max, 
                0
            );
            const modronId = highestId + 1;
            // Add the modron to the game
            players.push({
                npc: true,
                member: new NPC(modronName, modronId),
                intelligence: -5,
                wisdom: -5,
                charisma: -5,
                chips: buyIn,
                bet: 0,
                lost: 0,
                folded: true,
                hand: []
            });

            await channel.send(`${modronName} (NPC) has joined the game with a buy-in of ${buyIn} chips!`);
            break;
        case 9: //random reveal
            const nonFoldedPlayers   = players.filter(player => !player.folded);
            const player = nonFoldedPlayers[randInt(nonFoldedPlayers.length - 1)];
            await channel.send(`${player.member.toString()} reveals their hole cards!
${player.hand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${player.hand.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
            break;
        case 10: //the big reveal   
            for (const player of players) {
                await channel.send(`${player.member.toString()}'s hole cards
${player.hand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${player.hand.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
            }
            break;
        case 11: //instant showdown
            await channel.send("## Instant showdown!");
            stage = 4;
            break;
        case 12: //ultimate showdown
            //raise players to the bet limit
            const betLimit = stage < 2 ? startingCallAmount * 2 : startingCallAmount * 4;
            pots[0].callAmount += betLimit;
            let raiseMessage = `The call amount has been raised to ${pots[0].callAmount} chips.\n`;
            for(const currentPlayer of players){
                if(currentPlayer.folded || currentPlayer.allIn) continue;
                if(currentPlayer.bet + currentPlayer.chips <= pots[0].callAmount) {
                    // all in
                    let startingBet = currentPlayer.bet;
                    currentPlayer.bet += currentPlayer.chips;
                    pots[0].amount += currentPlayer.chips;
                    raiseMessage += `${currentPlayer.member.toString()} has gone all-in for ${currentPlayer.chips} chips.\n`;
                    //make the player all in
                    currentPlayer.chips = 0;
                    currentPlayer.allIn = true;
                } else {
                    //call
                    let difference = pots[0].callAmount - currentPlayer.bet;
                    currentPlayer.chips -= difference;
                    currentPlayer.bet += difference;
                    pots[0].amount += difference;
                    raiseMessage += `${currentPlayer.member.toString()} called and has ${currentPlayer.chips} chips left.\n`;
                }
            }
            // check for short stacked players
            const shortStackedPlayers = [];
            for(const player of pots[0].players){
                if(player.allIn && player.bet < pots[0].callAmount){ // Check current bet against ante
                    shortStackedPlayers.push(player);
                }
            }
            if(shortStackedPlayers.length > 0){ //make side pots for short stacked players
                outerLoop:
                for(const shortStackedPlayer of shortStackedPlayers){
                    for(let i = 1; i < pots.length; i++){
                        if(pots[i].players.some(p => p.member.id === shortStackedPlayer.member.id)) continue outerLoop;
                    }

                    // reduce the pot and ante for the main pot
                    pots[0].callAmount -= shortStackedPlayer.bet; 
                    pots[0].amount -= shortStackedPlayer.bet;

                    //  create side pot
                    let sidePotAmount = shortStackedPlayer.bet;
                    let sidePotPlayers = [shortStackedPlayer];
                    for(const player of pots[0].players){ //remove all bet from the main pot for all players in the main pot
                        if(player.member.id === shortStackedPlayer.member.id) continue;  
                        if(player.bet >= shortStackedPlayer.bet){
                            pots[0].amount -= shortStackedPlayer.bet;
                            player.bet -= shortStackedPlayer.bet;
                            sidePotAmount += shortStackedPlayer.bet;
                            sidePotPlayers.push(player);
                        }
                    }//make the side pot
                    pots.push({
                        amount: sidePotAmount,
                        players: [...sidePotPlayers],
                    });
                    pots[0].players = pots[0].players.filter(player => player.member.id !== shortStackedPlayer.member.id); //remove the short stacked player from the main pot
                    raiseMessage += `${shortStackedPlayer.member.toString()} is all-in and cannot match the bet so side pot ${pots.length-1} was created.\n`;
                }
            }
            await channel.send(`${raiseMessage}
## It's the ultimate showdown!`);
            stage = 4;
            break;
    }
    return [players, pots, communityCards, stage, deck]
}

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

// Function to evaluate poker hands
function evaluateHand(player, communityCards) {
    const hand = [...player.hand, ...communityCards];
    
    // Find joker
    const jokerIndex = hand.findIndex(card => card[0] === 4);
    
    // Function to evaluate a specific hand
    const evaluateSpecificHand = (currentHand) => {
        currentHand.sort((a, b) => (b[1] === 1 ? 14 : b[1]) - (a[1] === 1 ? 14 : a[1]));
        
        // Check for pairs, three of a kind, etc.
        const valueCounts = {};
        currentHand.forEach(card => {
            const value = card[1];
            valueCounts[value] = (valueCounts[value] || 0) + 1;
        });
        const counts = Object.values(valueCounts);
    
        const suitCounts = [0,0,0,0];
        for(const card of currentHand){
            if(card[0] < 4) suitCounts[card[0]]++;
        }
        const mostSuitIndex = suitCounts.indexOf(Math.max(...suitCounts));
        const sameSuitCards = currentHand.filter(card => card[0] === mostSuitIndex);
        const isFlush = sameSuitCards.length >= 5;
        
        let isRoyalFlush;
        let straightLength = 0;
        for(let i = sameSuitCards.length - 1; i > 0; i--){
            if(sameSuitCards[i][1] < 10) continue;
            if(sameSuitCards[i-1][1] === sameSuitCards[i][1]) continue;
            if(sameSuitCards[i-1][1] - sameSuitCards[i][1] === 1  || (sameSuitCards[i-1][1] === 1 && sameSuitCards[i][1] === 13)){
                straightLength++;
            } else {
                straightLength = 0;
            }
            if(straightLength === 4){
                isRoyalFlush = true;
                break;
            }
        }
    
        let isHighStraightFlush;
        straightLength = 0;
        for(let i = sameSuitCards.length - 1; i > 0; i--){
            if(sameSuitCards[i-1][1] === sameSuitCards[i][1]) continue;
            if(sameSuitCards[i-1][1] - sameSuitCards[i][1] === 1  || (sameSuitCards[i-1][1] === 1 && sameSuitCards[i][1] === 13)){
                straightLength++;
            } else {
                straightLength = 0;
            }
            if(straightLength === 4){
                isHighStraightFlush = true;
                break;
            }
        }
    
        const isLowStraightFlush = !isHighStraightFlush && sameSuitCards.some(card => card[1] === 1) && sameSuitCards.some(card => card[1] === 2) && sameSuitCards.some(card => card[1] === 3) && sameSuitCards.some(card => card[1] === 4) && sameSuitCards.some(card => card[1] === 5);
    
        let isHighStraight;
        straightLength = 0;
        for(let i = currentHand.length - 1; i > 0; i--){
            if(currentHand[i-1][1] === currentHand[i][1]) continue;
            if(currentHand[i-1][1] - currentHand[i][1] === 1  || (currentHand[i-1][1] === 1 && currentHand[i][1] === 13)){
                straightLength++;
            } else {
                straightLength = 0;
            }
            if(straightLength === 4){
                isHighStraight = true;
                break;
            }
        }
    
        const isLowStraight = !isHighStraight && currentHand.some(card => card[1] === 1) && currentHand.some(card => card[1] === 2) && currentHand.some(card => card[1] === 3) && currentHand.some(card => card[1] === 4) && currentHand.some(card => card[1] === 5);
    
        let rank = 0;
        let handName = "High Card";
        let bestHand = [];
    
        if (isRoyalFlush) {
            rank = 11;
            handName = "Royal Flush";
            bestHand = sameSuitCards.slice(0, 5);
        } else if (isHighStraightFlush) {
            rank = 10;
            handName = "Straight Flush";    
            for(let i = 0; i < sameSuitCards.length - 1; i++){
                if (sameSuitCards[i][1] === sameSuitCards[i+1][1]) continue;
                if(sameSuitCards[i][1] - sameSuitCards[i+1][1] === 1 || (sameSuitCards[i][1] === 1 && sameSuitCards[i+1][1] === 13)){
                    bestHand.push(sameSuitCards[i]);
                } else {
                    bestHand = [];
                    continue;
                }
                if(bestHand.length === 4){
                    bestHand.push(sameSuitCards[i+1]);
                    break;
                }
            }
        } else if (isLowStraightFlush) {
            rank = 9;
            handName = "Steel Wheel";
            const twoToFive = sameSuitCards.filter(card => card[1] >= 2 && card[1] <= 5)
                .sort((a, b) => b[1] - a[1]);
            const ace = sameSuitCards.find(card => card[1] === 1);
            bestHand = [...twoToFive, ace];
        } else if (counts.includes(4)) {
            rank = 8;
            handName = "Four of a Kind";
            const value = Number(Object.keys(valueCounts).find(key => valueCounts[key] === 4));
            bestHand = [
                ...currentHand.filter(card => card[1] === value),
                ...currentHand.filter(card => card[1] !== value).slice(0, 1)
            ];
        } else if (counts.filter(count => count >= 2).length >= 2 && counts.filter(count => count >= 3).length >= 1) {
            rank = 7;
            handName = "Full House";
            const threeValue = Number(Object.keys(valueCounts).find(key => valueCounts[key] >= 3));
            const twoValue = Number(Object.keys(valueCounts).find(key => key != threeValue && valueCounts[key] >= 2));
            bestHand = [
                ...currentHand.filter(card => card[1] === threeValue).slice(0, 3),
                ...currentHand.filter(card => card[1] === twoValue).slice(0, 2)
            ];
        } else if (isFlush) {
            rank = 6;
            handName = "Flush";
            bestHand = sameSuitCards.slice(0, 5);
        } else if (isHighStraight) {
            rank = 5;
            handName = "Straight";
            for(let i = 0; i < currentHand.length - 1; i++){
                if (currentHand[i][1] === currentHand[i+1][1]) continue;
                if(currentHand[i][1] - currentHand[i+1][1] === 1 || (currentHand[i][1] === 1 && currentHand[i+1][1] === 13)){
                    bestHand.push(currentHand[i]);
                } else {
                    bestHand = [];
                    continue;
                }
                if(bestHand.length === 4){
                    bestHand.push(currentHand[i+1]);
                    break;
                }
            }
        } else if (isLowStraight) {
            rank = 4;
            handName = "Wheel";
            const twoToFive = currentHand.filter(card => card[1] >= 2 && card[1] <= 5)
                .sort((a, b) => b[1] - a[1]);
            const aces = currentHand.filter(card => card[1] === 1);
            const straightCards = [...twoToFive, ...aces];
            const seen = new Set();
            straightCards.forEach(card => {
                if (!seen.has(card[1])) {
                    bestHand.push(card);
                    seen.add(card[1]);
                }
            });
        } else if (counts.includes(3)) {
            rank = 3;
            handName = "Three of a Kind";
            const value = Number(Object.keys(valueCounts).find(key => valueCounts[key] === 3));
            bestHand = [
                ...currentHand.filter(card => card[1] === value),
                ...currentHand.filter(card => card[1] !== value).slice(0, 2)
            ];
        } else if (counts.filter(count => count === 2).length >= 2) {
            rank = 2;
            handName = "Two Pair";
            const pairValues = Object.keys(valueCounts)
                .filter(key => valueCounts[key] === 2)
                .map(Number)
                .sort((a, b) => (b === 1 ? 14 : b) - (a === 1 ? 14 : a));
            bestHand = [
                ...currentHand.filter(card => card[1] === pairValues[0]),
                ...currentHand.filter(card => card[1] === pairValues[1]),
                ...currentHand.filter(card => !pairValues.includes(card[1])).slice(0, 1)
            ];
        } else if (counts.includes(2)) {
            rank = 1;
            handName = "One Pair";
            const value = Number(Object.keys(valueCounts).find(key => valueCounts[key] === 2));
            bestHand = [
                ...currentHand.filter(card => card[1] === value),
                ...currentHand.filter(card => card[1] !== value).slice(0, 3)
            ];
        } else {
            bestHand = currentHand.slice(0, 5);
        }
    
        return { rank, handName, bestHand };
    };

    if (jokerIndex === -1) {
        // No joker - evaluate normally
        const result = evaluateSpecificHand(hand);
        return {
            ...player,
            ...result
        };
    }

    // With joker, try all 52 possible cards
    let bestRank = 0;
    let bestHandName = "High Card";
    let bestHand = [];
    let bestSuit = 0;
    let bestValue = 1;  // Add these variables to track the best card
    
    // Remove joker from hand
    const nonJokerCards = [...hand];
    nonJokerCards.splice(jokerIndex, 1);
    
    // Try each possible card value and suit
    for (let suit = 0; suit < 4; suit++) {
        for (let value = 1; value <= 13; value++) {
            const currentHand = [...nonJokerCards, [suit, value]];
            const result = evaluateSpecificHand(currentHand);
            
            // Update best hand if this combination is better
            if (result.rank >= bestRank || 
                (result.rank === bestRank && result.bestHand[0][1] > bestHand[0][1])) {
                bestRank = result.rank;
                bestHandName = result.handName;
                bestHand = result.bestHand;
                bestSuit = suit;  // Track the best suit and value
                bestValue = value;
            }
        }
    }
    
    // Replace one of the cards in bestHand with the joker but with the value of the simulated card
    const jokerCard = [4, bestValue];
    for(let i = 0; i < bestHand.length; i++) {
        if(bestHand[i][0] === bestSuit && bestHand[i][1] === bestValue) {  // Use bestSuit and bestValue here
            bestHand[i] = jokerCard;
            break;
        }
    }
    
    return {
        ...player,
        rank: bestRank,
        handName: bestHandName,
        bestHand
    };
}

function breakTies(results) {
    // Group results by rank
    const rankGroups = {};
    results.forEach(result => {
        if (!rankGroups[result.rank]) {
            rankGroups[result.rank] = [];
        }
        rankGroups[result.rank].push(result);
    });

    // Sort each rank group by comparing cards
    Object.values(rankGroups).forEach(group => {
        if (group.length > 1) {
            group.sort((a, b) => {
                const aFullHand = a.bestHand.concat(a.hand);
                const bFullHand = b.bestHand.concat(b.hand);

                // Convert card values, treating Ace as 14
                const aValues = aFullHand.map(card => card[1] === 1 ? 14 : card[1]);
                const bValues = bFullHand.map(card => card[1] === 1 ? 14 : card[1]);

                // Compare each card position
                for (let i = 0; i < aValues.length; i++) {
                    if (aValues[i] !== bValues[i]) {
                        return bValues[i] - aValues[i]; // Higher value wins
                    }
                }
                return 0; // True tie
            });
        }
    });
    
    // Create final results array, grouping tied players together
    const finalResults = [];
    const ranks = Object.keys(rankGroups).map(Number).sort((a, b) => b - a);
    
    for (const rank of ranks) {
        const group = rankGroups[rank];
        const tiedGroups = [];
        let currentTieGroup = [group[0]];
        
        for (let i = 1; i < group.length; i++) {
            const a = group[i - 1];
            const b = group[i];
            
            const aFullHand = a.bestHand.concat(a.hand);
            const bFullHand = b.bestHand.concat(b.hand);
            
            const aValues = aFullHand.map(card => card[1] === 1 ? 14 : card[1]);
            const bValues = bFullHand.map(card => card[1] === 1 ? 14 : card[1]);
            
            let isTie = true;
            for (let j = 0; j < aValues.length; j++) {
                if (aValues[j] !== bValues[j]) {
                    isTie = false;
                    break;
                }
            }
            
            if (isTie) {
                currentTieGroup.push(b);
            } else {
                tiedGroups.push([...currentTieGroup]);
                currentTieGroup = [b];
            }
        }
        tiedGroups.push([...currentTieGroup]);
        finalResults.push(...tiedGroups);
    }

    // Return both winners (first tie group) and complete results
    return finalResults;
};

async function playHoldemRound(players, host, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, channel, conn, emojis) { 
    const blackCard = getEmoji(emojis, 'blank_card');
    const blankSuit = getEmoji(emojis, 'blank_suit');

    let wildMagic = 0;

    // Assign positions based on number of players
    let dealerPlayer, smallBlindPlayer, bigBlindPlayer;

    let pots = [
        {
            players: [...players],
            callAmount: startingCallAmount,
            amount: 0
        }
    ];
    
    if (players.length > 2) {
        dealerPlayer = players[0];
        smallBlindPlayer = players[1];
        bigBlindPlayer = players[2];
    } else {
        dealerPlayer = players[0];
        smallBlindPlayer = players[0]; // dealer is small blind
        bigBlindPlayer = players[1];
    }
    let smallBlindMessage
    if(smallBlindAmount){
        smallBlindMessage = `${smallBlindPlayer.member.toString()} payed the small blind of ${smallBlindAmount} chips.`;
        if(smallBlindPlayer.chips <= smallBlindAmount){
            smallBlindPlayer.bet = smallBlindPlayer.chips;
            smallBlindPlayer.chips = 0;
            smallBlindPlayer.allIn = true;
            if(smallBlindPlayer.bet === smallBlindAmount){
                smallBlindMessage = `${smallBlindPlayer.member.toString()} must go all in to pay the small blind of ${smallBlindPlayer.bet} chips.`;
            } else {
                smallBlindMessage = `${smallBlindPlayer.member.toString()} can not afford the small blind and the game must go all in for ${smallBlindPlayer.bet} chips.`;
            }
        } else {
            smallBlindPlayer.bet = smallBlindAmount;
            smallBlindPlayer.chips -= smallBlindAmount;
        }
        pots[0].amount = smallBlindPlayer.bet;
    } else {
        smallBlindMessage = `There is no small blind.`;
    }

    let bigBlindMessage;
    if(bigBlindAmount){
        bigBlindMessage = `${bigBlindPlayer.member.toString()} payed the big blind of ${bigBlindAmount} chips.`
        if(bigBlindPlayer.chips < smallBlindPlayer.bet){
            bigBlindPlayer.bet = bigBlindPlayer.chips;
            bigBlindPlayer.chips = 0;
            bigBlindPlayer.allIn = true;
            pots[0].players = pots[0].players.filter(player => player.member.id !== bigBlindPlayer.member.id);
    
            smallBlindPlayer.bet = pots[0].callAmount;
            
            pots[0].amount -= bigBlindPlayer.bet;
            pots[0].callAmount -= bigBlindPlayer.bet; 
    
            //make the side pot
            pots.push({
                amount: bigBlindPlayer.bet * 2,
                callAmount: bigBlindPlayer.bet,
                players: [bigBlindPlayer, smallBlindPlayer],
            });
            bigBlindMessage = `${bigBlindPlayer.member.toString()} can not afford the big blind and the game must go all in, creating side pot 1, and making the effective big blind ${pots[0].callAmount} chips.`;
        } else {
            if(bigBlindPlayer.chips <= bigBlindAmount){
                bigBlindPlayer.bet = bigBlindPlayer.chips;
                bigBlindPlayer.chips = 0;
                bigBlindPlayer.allIn = true;
                if(bigBlindPlayer.bet === bigBlindAmount){
                    bigBlindMessage = `${bigBlindPlayer.member.toString()} must go all in for ${bigBlindPlayer.bet} chips to pay the big blind.`;
                } else {
                    bigBlindMessage = `${bigBlindPlayer.member.toString()} can not afford the big blind and must go all in making the effective big blind ${bigBlindPlayer.bet} chips.`;
                    pots[0].callAmount = bigBlindPlayer.bet;
                }
            } else {
                bigBlindPlayer.bet = bigBlindAmount;
                bigBlindPlayer.chips -= bigBlindAmount;
            }
    
            pots[0].amount += bigBlindPlayer.bet;
    
            if(smallBlindPlayer.allIn){
                const bigBlindTotalBet = bigBlindPlayer.bet;
                bigBlindPlayer.bet -= smallBlindPlayer.bet;
                
                pots[0].amount -= smallBlindPlayer.bet * 2;
                pots[0].callAmount -= smallBlindPlayer.bet; 
                pots[0].players = pots[0].players.filter(player => player.member.id !== smallBlindPlayer.member.id);
        
                //make the side pot
                pots.push({
                    amount: smallBlindPlayer.bet * 2,
                    ante: smallBlindPlayer.bet,
                    players: [bigBlindPlayer, smallBlindPlayer],
                });
    
                bigBlindMessage += `\n${smallBlindPlayer.member.toString()} cannot match the bet so side pot 1 was created making the effective big blind ${pots[0].callAmount} chips.`;
            }
        }
    } else{
        bigBlindMessage = `There is no big blind.`;
    }


    let deck = shuffleDeck();

    let communityCards = deck.splice(0, 5);

    for (const player of players) {
        //deal 2 cards to each player
        player.hand = deck.splice(0, 2);

        // Sort the hand by card value, treating Aces as high
        player.hand.sort((a, b) => (b[1] === 1 ? 14 : b[1]) - (a[1] === 1 ? 14 : a[1]));
    }

    // do not include in production
    // communityCards[0] = [3,1] // Ace of spades for wild magic!
    // communityCards = [
    //     [0, 2],
    //     [1, 2],
    //     [2, 2],
    //     [3, 3],
    //     [0, 3]
    // ];
    // players[0].hand = [
    //     [0, 1],
    //     [1, 11]
    // ];
    // players[1].hand = [
    //     [2, 3],
    //     [3, 5]
    // ];
    // if(players[2]) players[1].hand = [
    //     [2, 7],
    //     [3, 3]
    // ];
    // players[0].chips = 16;
    // players[1].chips = 7 - players[1].bet;
    // if(players[2]) players[2].chips = 5 - players[2].bet;
    
    // Send game start message to the channel
    await channel.send(`## Game started!
${dealerPlayer.member.toString()} shuffled the deck and dealt the cards to your direct messages.
${smallBlindMessage}
${bigBlindMessage}
**Community Cards**:
${blackCard} ${blackCard} ${blackCard} ${blackCard} ${blackCard}
${blankSuit} ${blankSuit} ${blankSuit} ${blankSuit} ${blankSuit}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);

    for (const player of players){
        if(!player.npc) await player.member.send(`**Your hand:**
${player.hand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${player.hand.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
    }

    if (players.length > 2) {
        const firstPlayer = players.shift();
        players.push(firstPlayer);
    }

    let folded = false;
    
    await channel.send(`## Time for initial bets`);
    [players, pots, folded] = await playHoldemStage(players, pots, 0, startingCallAmount, wildMagic, communityCards, channel, conn, emojis);
    if(folded || players.filter(player => !player.allIn && !player.folded).length <= 1){
        await channel.send(`## Skipping to the showdown
**Community Cards**:
${communityCardsString(communityCards, 4, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
        return determineWinner(deck, communityCards, players, pots, host, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, wildMagic, channel, conn, emojis);
    }
   
    if(players.length === 2) players.reverse();
   
    let stage = 1;

    await channel.send(`## Proceeding to the flop.
**Community Cards**:
${communityCardsString(communityCards, 1, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);

    for(const card of communityCards.slice(0, 3)){
        if(card[0] === 3 && card[1] === 1){
            await channel.send(`## Ace of Spades revealed! The dungeon master is rolling 2d6 on the wild magic table!`);

            await sleep(1500);

            const die1 = randInt(6,1);
            const die2 = randInt(6,1);
            wildMagic = die1 + die2;

            await channel.send(`${getD6Emoji(die1, emojis)} ${getD6Emoji(die2, emojis)}`);

            await channel.send(wildMagicTable[wildMagic]);

            [players, pots, communityCards, stage, deck] = await applyWildMagic(deck, players, pots, communityCards, 1, buyIn, startingCallAmount, wildMagic, channel, emojis);

            await channel.send(`**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);

            if(stage === 4) return determineWinner(deck, communityCards, players, pots, host, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, wildMagic, channel, conn, emojis);
            break;
        }
    }

    [players, pots, folded] = await playHoldemStage(players, pots, 1, startingCallAmount, wildMagic, communityCards, channel, conn, emojis);
    if(folded || players.filter(player => !player.allIn && !player.folded).length <= 1){
        await channel.send(`## Skipping to the showdown
**Community Cards**:
${communityCardsString(communityCards, 4, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
        return determineWinner(deck, communityCards, players, pots, host, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, wildMagic, channel, conn, emojis);
    }

    await channel.send(`## Now it's time for the turn.
**Community Cards**:
${communityCardsString(communityCards, 2, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);

    if(!wildMagic && communityCards[3][0] === 3 && communityCards[3][1] === 1){
        await channel.send(`## Ace of Spades revealed! The dungeon master is rolling 2d6 on the wild magic table!`);

        await sleep(1500);

        const die1 = randInt(6,1);
        const die2 = randInt(6,1);
        wildMagic = die1 + die2;

        await channel.send(`${getD6Emoji(die1, emojis)} ${getD6Emoji(die2, emojis)}`);

        await channel.send(wildMagicTable[wildMagic]);

        [players, pots, communityCards, stage, deck] = await applyWildMagic(deck, players, pots, communityCards, 2, buyIn, startingCallAmount, wildMagic, channel, emojis);

        await channel.send(`**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);

        if(stage === 4) return determineWinner(deck, communityCards, players, pots, host, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, wildMagic, channel, conn, emojis);
    }

    [players, pots, folded] = await playHoldemStage(players, pots, 2, startingCallAmount, wildMagic, communityCards, channel, conn, emojis);
    if(folded || players.filter(player => !player.allIn && !player.folded).length <= 1){
        await channel.send(`## Skipping to the showdown
**Community Cards**:
${communityCardsString(communityCards, 4, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
        return determineWinner(deck, communityCards, players, pots, host, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, wildMagic, channel, conn, emojis);
    }

    if(wildMagic !== 7){
        await channel.send(`## Sailing down the river!
**Community Cards**:
${communityCardsString(communityCards, 3, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
    
        if(!wildMagic && communityCards[4][0] === 3 && communityCards[4][1] === 1){
            await channel.send(`## Ace of Spades revealed! The dungeon master is rolling 2d6 on the wild magic table!`);
    
            await sleep(1500);
    
            const die1 = randInt(6,1);
            const die2 = randInt(6,1);
            wildMagic = die1 + die2;
    
            await channel.send(`${getD6Emoji(die1, emojis)} ${getD6Emoji(die2, emojis)}`);
    
            await channel.send(wildMagicTable[wildMagic]);
    
            [players, pots, communityCards, stage, deck] = await applyWildMagic(deck, players, pots, communityCards, 3, buyIn, startingCallAmount, wildMagic, channel, emojis);
    
            await channel.send(`**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
    
            if(stage === 4) return determineWinner(deck, communityCards, players, pots, host, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, wildMagic, channel, conn, emojis);
        }
        [players, pots] = await playHoldemStage(players, pots, 3, startingCallAmount, wildMagic, communityCards, channel, conn, emojis);
    }
    
    await channel.send("## It's the final showdown!");
    return determineWinner(deck, communityCards, players, pots, host, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, wildMagic, channel, conn, emojis);
}

async function determineWinner(deck, communityCards, players, pots, host, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, wildMagic, channel, conn, emojis) {
    for(const card of communityCards){
        if(!wildMagic && card[0] === 3 && card[1] === 1){
            await channel.send(`## Ace of Spades revealed! The dungeon master is rolling 2d6 on the wild magic table!`);

            await sleep(1500);

            const die1 = randInt(6,1);
            const die2 = randInt(6,1);
            wildMagic = die1 + die2;

            await channel.send(`${getD6Emoji(die1, emojis)} ${getD6Emoji(die2, emojis)}`);

            await channel.send(wildMagicTable[wildMagic]);

            [players, pots, communityCards] = await applyWildMagic(deck, players, pots, communityCards, 4, buyIn, startingCallAmount, wildMagic, channel, emojis);

            await channel.send(`**Community Cards**:
${communityCardsString(communityCards, 4, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
            break;
        }
    }

    const playersInGame = players.filter(player => !player.folded);
    const results = await Promise.all(playersInGame.map(player => evaluateHand(player, communityCards)));
    const finalResults = breakTies(results);

    //reverse to list hands in ascending order
    finalResults.reverse();

    const blankEmoji = getEmoji(emojis, 'blank');

    // Send the messages to show hands
    await channel.send("## Player Hands:");
    for (const result of finalResults) {
        for (const player of result) {
            await channel.send(`${player.member.toString()} - ${player.handName}
${player.bestHand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ${blankEmoji} ${player.hand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${player.bestHand.map(card => getSuitEmoji(card[0], emojis)).join(' ')} ${blankEmoji} ${player.hand.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
            if(!player.npc && player.handName === 'Full House'){
                //give the Joey cat to user
                const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
                    [player.member.id, 9, player.member.displayName, 'Joey']);
                if(userCatDB[0].affectedRows){
                    await channel.send({content: `<@${player.member.id}> just gained ownership of Joey by getting a full house! This unlocks the \`/shadowdale\` command.`, files: ['images/cats/Joey.jpg']});
                }
            }
        }
    }

    //reverse back to descending order
    finalResults.reverse();

    // Sort pots by ante amount (highest to lowest)
    pots.sort((a, b) => b.callAmount - a.callAmount);

    //distribute pots
    for(const pot of pots) {
        // Get all potential winners for this pot (not folded and in pot.players)
        let potWinners = [];
        for(const group of finalResults){
            for(const player of group){
                if(!player.folded && pot.players.some(p => p.member.id === player.member.id)){
                    potWinners.push(player);
                }
            }
            if(potWinners.length > 0) break;
        }

        if(wildMagic === 6){
            let startingWinnerCount = potWinners.length;
            finalResults.reverse();
            for(const group of finalResults){
                for(const player of group){
                    if(!player.folded && pot.players.some(p => p.member.id === player.member.id)){
                        potWinners.push(player);
                    }
                }
                if(potWinners.length > startingWinnerCount) break;
            }
            finalResults.reverse();
        
        }

        if(potWinners.length === 0) potWinners = pot.players;

        // Split pot amount among winners
        const winAmount = Math.floor(pot.amount / potWinners.length);
        const remainder = pot.amount % potWinners.length;

        // Distribute winnings and track for message
        potWinners.forEach((winner, index) => {
            // Add remainder to first winner if pot can't be split evenly
            const extraChip = index === 0 ? remainder : 0;
            const totalWin = winAmount + extraChip;
            
            // Initialize won property if it doesn't exist
            if(!winner.won) winner.won = 0;
            winner.won += totalWin;
            winner.chips += totalWin;
        });
    }

    let winningMessage = '';
    let winners = [];
    for(const finalResult of finalResults){
        for(const player of finalResult){
            if(player.won) winners.push(player);
        }
    }
    winners.sort((a, b) => a.won - b.won);
    for(const winner of winners){
        winningMessage += `# ${winner.member.toString()} won ${winner.won} chips with ${winner.handName}!\n`;
        players.find(p => p.member.id === winner.member.id).chips = winner.chips;
    }
    await channel.send(winningMessage);

    completeRound(players, host, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, wildMagic, channel, conn, emojis);
}

async function completeRound(players, host, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, wildMagic, channel, conn, emojis){
    // Update the game timestamp in the database
    await conn.query('UPDATE `game` SET `start_time` = NOW() WHERE `channel_id` = ?;', [channel.id]);

    let nexRoundStartTime = Math.ceil(Date.now()/1000)+122;

    const previousPlayers = players;

    players.forEach(player => {
        player.folded = false;
        player.allIn = false;
        player.bet = 0;
        player.hand = [];
    });

    //remove busted players
    players = players.filter(player => player.chips > 0);

    // New message with button components for cashing out, starting, canceling, and joining
    const joinButton = new ButtonBuilder()
        .setCustomId('join')
        .setLabel('Join Game')
        .setStyle(ButtonStyle.Success);

    const addNPCButton = new ButtonBuilder()
        .setCustomId('add-npc')
        .setLabel('Add NPC')
        .setStyle(ButtonStyle.Success);

    const cashOutButton = new ButtonBuilder()
        .setCustomId('cashout')
        .setLabel('Cash Out')
        .setStyle(ButtonStyle.Primary);

    const startButton = new ButtonBuilder()
        .setCustomId('start')
        .setLabel('Start Game')
        .setStyle(ButtonStyle.Primary);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('End Game')
        .setStyle(ButtonStyle.Danger);

    const actionRow = new ActionRowBuilder().addComponents(joinButton, addNPCButton, cashOutButton, startButton, cancelButton);

    const message = await channel.send({
        content: `## Round over!
Players ended the last round with:
${previousPlayers.map(player => `${player.member.toString()} ${player.chips}${player.cashedOut ? ' chips (cashed out)' : player.chips === 0 ? ' chips (busted)' : ' chips'}`).join('\n')}
### The dungeon master is ${host.toString()}.
The dungeon master must start game <t:${nexRoundStartTime}:R> or everyone will be cashed out.
Players can cash out now, new players can join, and the dungeon master can add or cash out NPCs, start the next round, or cancel the game.
## Players in next game:
${players.map(player => `${player.member.toString()}${host.id === player.member.id ? ' (DM)' : ''}`).join('\n')}`,
        components: [actionRow]
    });

    // Create a collector for the button interactions
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000 // 60 seconds for the collector
    });

    const highestId = players.reduce((max, player) => player.member.id > max ? player.member.id : max, 0);
    let npcCount = highestId + 1;

    collector.on('collect', async i => {
        try {
            if (i.customId === 'join') {
                // Check if player is already in game
                if (players.some(p => p.member.id === i.user.id)) {
                    await i.reply({ content: "You're already in the game.", ephemeral: true });
                    return;
                }

                if(players.length >= 10) {
                    await i.reply({ content: "The game is too full. Only 10 players can join.", ephemeral: true });
                    return;
                }

                await i.deferUpdate();

                const previousPlayer = previousPlayers.find(p => p.member.id === i.user.id) || { lost: 0 };

                // Add player to game
                players.push({
                    member: i.member,
                    chips: buyIn,
                    bet: 0,
                    lost: previousPlayer.lost,
                    hand: []
                });

                await message.edit({
                    content: `## Round over!
Players ended the last round with:
${previousPlayers.map(player => `${player.member.toString()} ${player.chips}${player.cashedOut ? ' chips (cashed out)' : player.chips === 0 ? ' chips (busted)' : ' chips'}`).join('\n')}
### The dungeon master is ${host.toString()}.
The dungeon master must start game <t:${nexRoundStartTime}:R> or everyone will be cashed out.
Players can cash out now, new players can join, and the dungeon master can add or cash out NPCs, start the next round, or cancel the game.
## Players in next game:
${players.map(player => `${player.member.toString()}${host.id === player.member.id ? ' (DM)' : ''}`).join('\n')}`,
                    components: [actionRow]
                });
                await channel.send(`${i.user.toString()}${host.id === i.user.id ? ' (DM)' : ''} has joined the game with a buy-in of ${buyIn} chips!`);
            }  else if (i.customId === 'add-npc') {
                if(players.length >= 10) {
                    await i.reply({ content: "The game is too full. Only 10 players can join.", ephemeral: true });
                    return;
                }

                // Create the modal
                const modal = new ModalBuilder()
                    .setCustomId(`npcModal-${i.id}`)
                    .setTitle('Add NPC');

                let npcName;
                do {
                    npcName = fantasyNames[randInt(fantasyNames.length-1)];
                } while (players.some(player => player.member && player.member.name === npcName));

                // Create the text input component
                const nameInput = new TextInputBuilder()
                    .setCustomId('nameInput')
                    .setLabel(`NPC Name`)
                    .setStyle(TextInputStyle.Short)
                    .setValue(npcName)
                    .setRequired(true)
                    .setMinLength(1)
                    .setMaxLength(12);

                // Add the text input to the modal
                const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
                modal.addComponents(firstActionRow);

                // Show the modal
                await i.showModal(modal);

                try {
                    const modalResponse = await i.awaitModalSubmit({
                        time: 60000,
                        filter: j => j.customId === `npcModal-${i.id}`
                    }).catch(() => null);
                    
                    if (!modalResponse) return;

                    // Check again if collector is still active
                    if (collector.ended) {
                        await modalResponse.reply({ 
                            content: "It's too late to add an NPC.", 
                            ephemeral: true 
                        });
                        return;
                    }

                    const name = modalResponse.fields.getTextInputValue('nameInput').trim();

                    if(players.some(p => p.npc && p.member.name.toLowerCase() === name.toLowerCase())){
                        await modalResponse.reply({ content: 'There is already an NPC with that name.', ephemeral: true });
                        return;
                    }

                    await modalResponse.deferUpdate();
                    // Add player to game
                    players.push({
                        npc: true,
                        member: new NPC(name, npcCount),
                        chips: buyIn,
                        bet: 0,
                        lost: 0,
                        hand: []
                    });

                    npcCount++;

                    await channel.send(`${name} (NPC) has joined the game with a buy-in of ${buyIn} chips!`);

                    await message.edit({
                        content: `## Round over!
Players ended the last round with:
${previousPlayers.map(player => `${player.member.toString()} ${player.chips}${player.cashedOut ? ' chips (cashed out)' : player.chips === 0 ? ' chips (busted)' : ' chips'}`).join('\n')}
### The dungeon master is ${host.toString()}.
The dungeon master must start game <t:${nexRoundStartTime}:R> or everyone will be cashed out.
Players can cash out now, new players can join, and the dungeon master can add or cash out NPCs, start the next round, or cancel the game.
## Players in next game:
${players.map(player => `${player.member.toString()}${host.id === player.member.id ? ' (DM)' : ''}`).join('\n')}`,
                        components: [actionRow]
                    });
                } catch (error) {
                    // console.error(error);
                }
            } else if (i.customId === 'cashout') {
                let player;
                if(i.user.id === host.id && players.some(p => p.npc === true)){
                    // Create the modal
                    const modal = new ModalBuilder()
                        .setCustomId(`cashoutModal-${i.id}`)
                        .setTitle('Add NPC');

                    // Create the text input component
                    const nameInput = new TextInputBuilder()
                        .setCustomId('nameInput')
                        .setLabel(`NPC to cash out (or 'Yourself')`)
                        .setStyle(TextInputStyle.Short)
                        .setValue('Yourself')
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(12);

                    // Add the text input to the modal
                    const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
                    modal.addComponents(firstActionRow);

                    // Show the modal
                    await i.showModal(modal);

                    try {
                        const modalResponse = await i.awaitModalSubmit({
                            time: 60000,
                            filter: j => j.customId === `cashoutModal-${i.id}`
                        }).catch(() => null);
                        
                        if (!modalResponse) return;

                        // Check again if collector is still active
                        if (collector.ended) {
                            await modalResponse.reply({ 
                                content: "It's too late to cash out.", 
                                ephemeral: true 
                            });
                            return;
                        }

                        const name = modalResponse.fields.getTextInputValue('nameInput').toLowerCase().trim();

                        if(name === 'yourself'){
                            player = players.find(p => p.member.id === i.user.id);
                            if (!player) {
                                await modalResponse.reply({ content: "You are not in the game.", ephemeral: true });
                                return;
                            }
                        } else {
                            player = players.find(p => p.npc && p.member.name.toLowerCase() === name);
                            if(!player){
                                await modalResponse.reply({ content: 'NPC not in the game.', ephemeral: true });
                                return;
                            }
                        }
                        await modalResponse.deferUpdate();
                        
                        await channel.send(`${player.member.toString()} has cashed out ${players.find(p => p.member.id === player.member.id).chips} chips.`);

                        if(previousPlayers.find(p => p.member.id === player.member.id)){
                            previousPlayers.find(p => p.member.id === player.member.id).cashedOut = true;
                        }
                        players = players.filter(p => p.member.id !== player.member.id); // Remove player from players array

                        await message.edit({
                            content: `## Round over!
Players ended the last round with:
${previousPlayers.map(p => `${p.member.toString()} ${p.chips}${p.cashedOut ? ' chips (cashed out)' : p.chips === 0 ? ' chips (busted)' : ' chips'}`).join('\n')}
### The dungeon master is ${host.toString()}.
The dungeon master must start game <t:${nexRoundStartTime}:R> or everyone will be cashed out.
Players can cash out now, new players can join, and the dungeon master can add or cash out NPCs, start the next round, or cancel the game.
## Players in next game:
${players.map(p => `${p.member.toString()}${host.id === p.member.id ? ' (DM)' : ''}`).join('\n')}`,
                            components: [actionRow]
                        });
                    } catch (error) {
                        console.error(error);
                    }
                } else {
                    // Get the player's chips from the players array
                    player = players.find(p => p.member.id === i.user.id);
                    if (!player) {
                        await i.reply({ content: "You are not in the game.", ephemeral: true });
                        return;
                    }
                    await channel.send(`${player.member.toString()} has cashed out ${players.find(p => p.member.id === player.member.id).chips} chips.`);
    
                    if(previousPlayers.find(p => p.member.id === player.member.id)){
                        previousPlayers.find(p => p.member.id === player.member.id).cashedOut = true;
                    }
                    players = players.filter(p => p.member.id !== player.member.id); // Remove player from players array
    
                    await message.edit({
                        content: `## Round over!
Players ended the last round with:
${previousPlayers.map(p => `${p.member.toString()} ${p.chips}${p.cashedOut ? ' chips (cashed out)' : p.chips === 0 ? ' chips (busted)' : ' chips'}`).join('\n')}
### The dungeon master is ${host.toString()}.
The dungeon master must start game <t:${nexRoundStartTime}:R> or everyone will be cashed out.
Players can cash out now, new players can join, and the dungeon master can add or cash out NPCs, start the next round, or cancel the game.
## Players in next game:
${players.map(p => `${p.member.toString()}${host.id === p.member.id ? ' (DM)' : ''}`).join('\n')}`,
                        components: [actionRow]
                    });
                } 
            } else if (i.customId === 'start' || i.customId === 'cancel') {
                // Only game host can start/cancel
                if (channel.guild.id !== '825883828798881822' && i.user.id !== host.id) {
                    await i.reply({ content: `Only the game dungeon master can ${i.customId} the game.`, ephemeral: true });
                    return;
                }

                if (i.customId === 'start') {
                    if(players.length < 2){
                        await i.reply({ content: "Not enough players to start the game.", ephemeral: true });
                        return;
                    }
                    
                    await i.deferUpdate();
                    message.edit({
                        content: message.content,
                        components: [],
                    });

                    collector.stop('started');
                } else {
                    

                    await i.deferUpdate();  
                    collector.stop('cancelled');
                }
            }
        } catch (error) {

        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'started' && players.length > 1) { 
            await message.edit({
                content: `## Round over!
Players ended the last round with:
${previousPlayers.map(player => `${player.member.toString()} ${player.chips}${player.cashedOut ? ' chips (cashed out)' : player.chips === 0 ? ' chips (busted)' : ' chips'}`).join('\n')}`,
                components: []
            });

            players.push(players.shift());

            playHoldemRound(players, host, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, channel, conn, emojis);
            return;
        } else {
            if (reason === 'cancelled') {                         
                await channel.send('Game cancelled by dungeon master. All players have been cashed out.');
            } else if(reason === 'time'){                              
                await channel.send('Game cancelled because the dungeon master did not start the game in time. All players have been cashed out.');
            } else  if(reason !== 'cashed out') {                                 
                await channel.send('Game cancelled: Not enough players. All players have been cashed out.');
            }  

            await message.edit({
                content: `## Game Ended
Players ended the last round with:
${previousPlayers.map(player => `${player.member.toString()} ${player.chips}${player.chips === 0 ? ' chips (busted)' : ' chips (cashed out)'}`).join('\n')}`,
                components: []
            });

            await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id])
                .catch(console.error);
        }                            
    });
}

function createPokerButtons(meetsCallAmount) {
    const fold = new ButtonBuilder()
        .setCustomId('fold')
        .setLabel('Fold')
        .setStyle(ButtonStyle.Danger);

    const call = new ButtonBuilder()
        .setCustomId('call')
        .setLabel(meetsCallAmount ? 'Check' : 'Call')
        .setStyle(ButtonStyle.Primary);

    const raise = new ButtonBuilder()
        .setCustomId('raise')
        .setLabel('Raise')
        .setStyle(ButtonStyle.Primary);

    const allIn = new ButtonBuilder()
        .setCustomId('allin')
        .setLabel('All In')
        .setStyle(ButtonStyle.Success);

    const row1 = new ActionRowBuilder().addComponents(fold, call);
    const row2 = new ActionRowBuilder().addComponents(raise, allIn);

    return [row1, row2];
}

function createLobbyButtons() {
    const join = new ButtonBuilder()
        .setCustomId('join')
        .setLabel('Join Game')
        .setStyle(ButtonStyle.Success);

    const addNPC = new ButtonBuilder()
        .setCustomId('add-npc')
        .setLabel('Add NPC')
        .setStyle(ButtonStyle.Success);

    const start = new ButtonBuilder()
        .setCustomId('start')
        .setLabel('Start Game')
        .setStyle(ButtonStyle.Primary);

    const cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel Game')
        .setStyle(ButtonStyle.Danger);

    const row1 = new ActionRowBuilder().addComponents(join, addNPC);
    const row2 = new ActionRowBuilder().addComponents(start, cancel);

    return [row1, row2];
}

async function playHoldemStage(players, pots, stage, startingCallAmount, wildMagic, communityCards, channel, conn, emojis) {
    // Reset NPC raise tracking for new stage
    players.forEach(player => {
        if (player.npc) {
            if (!player.stageRaises) {
                player.stageRaises = new Map();
            }
            player.stageRaises.set(stage, false);
        }
        player.raised = false;
        player.alreadyRaised = false;
    });

    // Update the game timestamp in the database
    await conn.query('UPDATE `game` SET `start_time` = NOW() WHERE `channel_id` = ?;', [channel.id]);

    let currentPlayerIndex = 0;

    const betLimit = stage < 2 ? startingCallAmount * 2 : startingCallAmount * 4;

    const processPlayerAction = async () => {
        const currentPlayer = players[currentPlayerIndex];
        const startingBet = currentPlayer.bet;

        if(pots[0].players.length <= 1) {
            return [players, pots, true];
        }

        if (currentPlayer.folded || currentPlayer.allIn || currentPlayer.raised || currentPlayer.chips === 0) {
            if (currentPlayerIndex < players.length - 1) {
                currentPlayerIndex++;
                return processPlayerAction();
            } else {
                // Check if we need another round
                const needsAnotherRound = pots[0].players.some(player => 
                    !player.folded && !player.allIn && player.bet < pots[0].callAmount
                );

                if (needsAnotherRound) {
                    currentPlayerIndex = 0;
                    return processPlayerAction();
                }
                return [players, pots];
            }
        }

        if (currentPlayer.npc) {
            return new Promise(async (resolve) => {
                const meetsCallAmount = currentPlayer.bet === pots[0].callAmount;
                await applyNPCAction(currentPlayer, players, pots, betLimit, meetsCallAmount, wildMagic, stage, communityCards, channel, emojis);
                await channel.send(`**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                currentPlayerIndex++;
                if (currentPlayerIndex < players.length) {
                    const result = await processPlayerAction();
                    resolve(result);
                } else {
                    const needsAnotherRound = pots[0].players.some(player => 
                        !player.folded && !player.allIn && player.bet < pots[0].callAmount
                    );

                    if (needsAnotherRound) {
                        currentPlayerIndex = 0;
                        const result = await processPlayerAction();
                        resolve(result);
                    } else {
                        resolve([players, pots]);
                    }
                }
            });
        }

        const actionRow = createPokerButtons(currentPlayer.bet === pots[0].callAmount); // Create buttons for player actions
        const message = await channel.send({
            content: `${currentPlayer.member.toString()}, it's your turn! You have ${currentPlayer.chips} chips left. The call amount is ${pots[0].callAmount} chips and your current bet is ${currentPlayer.bet}${pots[0].callAmount - currentPlayer.bet >= currentPlayer.chips ? ' chips and you must go all in to continue' : ' chips'}. Act quick or you will fold <t:${Math.ceil(Date.now()/1000)+60}:R>.`,
            components: actionRow
        });

        return new Promise(async (resolve) => {
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            collector.on('collect', async i => {
                try {
                    if (channel.guild.id !== '825883828798881822' && i.user.id !== currentPlayer.member.id) {
                        await i.reply({ content: "It's not your turn!", ephemeral: true });
                        return;
                    }

                    if (i.customId === 'raise') {
                        let difference = pots[0].callAmount - currentPlayer.bet;
                        if(currentPlayer.chips <= difference) {
                            await i.reply({
                                content: `You must go all-in.`,
                                ephemeral: true
                            });
                            return;
                        }

                        if(currentPlayer.alreadyRaised){
                            await i.reply({
                                content: `You have already raised.`,
                                ephemeral: true
                            });
                            return;
                        }

                        // Create the modal
                        const modal = new ModalBuilder()
                            .setCustomId(`raiseModal-${i.id}`)
                            .setTitle('Raise Amount');

                        // Create the text input component
                        const raiseInput = new TextInputBuilder()
                            .setCustomId('raiseAmount')
                            .setLabel(`How much to raise? (Max: ${betLimit})`)
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Enter Amount')
                            .setRequired(true)
                            .setMinLength(1);

                        // Add the text input to the modal
                        const firstActionRow = new ActionRowBuilder().addComponents(raiseInput);
                        modal.addComponents(firstActionRow);

                        // Show the modal
                        await i.showModal(modal);

                        try {
                            const modalResponse = await i.awaitModalSubmit({
                                time: 60000,
                                filter: j => j.customId === `raiseModal-${i.id}`
                            }).catch(() => null);

                            if (!modalResponse) return;

                            const raiseAmount = parseInt(modalResponse.fields.getTextInputValue('raiseAmount'));

                            // Check again if collector is still active
                            if (collector.ended) {
                                await modalResponse.reply({ 
                                    content: "It's too late to raise.", 
                                    ephemeral: true 
                                });
                                return;
                            }

                            if (isNaN(raiseAmount) || raiseAmount <= 0) {
                                await modalResponse.reply({ content: 'Please enter a valid positive number.', ephemeral: true });
                                return;
                            }

                            if (raiseAmount > currentPlayer.chips) {
                                await modalResponse.reply({ content: "You don't have enough chips for that raise amount.", ephemeral: true });
                                return;
                            }

                            if(raiseAmount > betLimit){
                                await modalResponse.reply({ content: `You cannot raise more than the bet limit of ${betLimit} chips.`, ephemeral: true });
                                return;
                            }

                            await modalResponse.deferUpdate();

                            difference += raiseAmount;

                            pots[0].callAmount += raiseAmount;
                            currentPlayer.chips -= difference;
                            currentPlayer.bet += difference;
                            pots[0].amount += difference;
                            for(const player of players){
                                player.raised = false;
                            }
                            currentPlayer.raised = true;
                            currentPlayer.alreadyRaised = true;

                            // check for short stacked players
                            const shortStackedPlayers = [];
                            for(const player of pots[0].players){
                                if(player.member.id === currentPlayer.member.id || !player.allIn) continue;
                                if(player.bet < pots[0].callAmount){ // Check current bet against ante
                                    shortStackedPlayers.push(player);
                                }
                            }
                            if(shortStackedPlayers.length > 0){ //make side pots for short stacked players
                                let sidePotMessage = `${currentPlayer.member.toString()} raised by ${raiseAmount} chips and has ${currentPlayer.chips} chips left.\n`;
                                
                                outerLoop:
                                for(const shortStackedPlayer of shortStackedPlayers){
                                    for(let i = 1; i < pots.length; i++){
                                        if(pots[i].players.some(p => p.member.id === shortStackedPlayer.member.id)) continue outerLoop;
                                    }

                                    // reduce the pot and ante for the main pot
                                    pots[0].callAmount -= shortStackedPlayer.bet; 
                                    pots[0].amount -= shortStackedPlayer.bet;

                                    //  create side pot
                                    let sidePotAmount = shortStackedPlayer.bet;
                                    let sidePotPlayers = [shortStackedPlayer];
                                    for(const player of pots[0].players){ //remove all bet from the main pot for all players in the main pot
                                        if(player.member.id === shortStackedPlayer.member.id) continue;  
                                        if(player.bet >= shortStackedPlayer.bet){
                                            pots[0].amount -= shortStackedPlayer.bet;
                                            player.bet -= shortStackedPlayer.bet;
                                            sidePotAmount += shortStackedPlayer.bet;
                                            sidePotPlayers.push(player);
                                        }
                                    }//make the side pot
                                    pots.push({
                                        amount: sidePotAmount,
                                        players: [...sidePotPlayers],
                                    });
                                    pots[0].players = pots[0].players.filter(player => player.member.id !== shortStackedPlayer.member.id); //remove the short stacked player from the main pot
                                    sidePotMessage += `${shortStackedPlayer.member.toString()} is all-in and cannot match the bet so side pot ${pots.length-1} was created.\n`;
                                }
                                await channel.send(`${sidePotMessage}**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                            } else {
                                await channel.send(`${currentPlayer.member.toString()} raised by ${raiseAmount} chips and has ${currentPlayer.chips} chips left..
**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                            }

                            currentPlayerIndex++;
                            collector.stop();
                        } catch (error) {
                            // console.error(error);
                        }
                    } else {
                        if (i.customId === 'fold') {
                            await i.deferUpdate();
                            await channel.send(`${currentPlayer.member.toString()} has folded.
**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                            currentPlayer.bet = 0;
                            currentPlayer.folded = true;
                            pots[0].players = pots[0].players.filter(player => player.member.id !== currentPlayer.member.id);
                            for(let i = 1; i < pots.length; i++){
                                if(pots[i].players.length >= 2){
                                    pots[i].players = pots[i].players.filter(player => player.member.id !== currentPlayer.member.id);
                                    if(pots[i].players.length === 1) await channel.send(`${pots[i].players[0].member.toString()} has won side pot ${i}!`);
                                }
                            }
                        } else if (i.customId === 'call') {
                            let difference = pots[0].callAmount - currentPlayer.bet;

                            if(currentPlayer.chips <= difference) {
                                await i.reply({
                                    content: `You must go all-in.`,
                                    ephemeral: true
                                });
                                return;
                            } else  {
                                const meetsCallAmount = currentPlayer.bet === pots[0].callAmount;
                                currentPlayer.chips -= difference;
                                currentPlayer.bet += difference;
                                pots[0].amount += difference;

                                await i.deferUpdate();
                                await channel.send(`${currentPlayer.member.toString()} has ${meetsCallAmount ? 'checked' : 'called'} and has ${currentPlayer.chips} chips left.
**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                            }
                        } else if (i.customId === 'allin'){ 
                            if(currentPlayer.bet + currentPlayer.chips - pots[0].callAmount > betLimit){
                                await i.reply({ content: `You cannot go all-in with more than the bet limit of ${betLimit} chips.`, ephemeral: true });
                                return;
                            }
                            await i.deferUpdate();

                            if(currentPlayer.bet + currentPlayer.chips > pots[0].callAmount && currentPlayer.alreadyRaised){
                                await i.reply({
                                    content: `You have already raised.`,
                                    ephemeral: true
                                });
                                return;
                            }

                            //calculate the bet
                            currentPlayer.bet += currentPlayer.chips;
                            if(currentPlayer.bet >= pots[0].callAmount) { //the player can afford the main pot
                                let difference = currentPlayer.bet - pots[0].callAmount;
                                pots[0].callAmount += difference;
                                pots[0].amount += currentPlayer.chips;
                                if(difference > 0){
                                    for(const player of players){
                                        player.raised = false;
                                    }
                                }
                                // check for short stacked players
                                const shortStackedPlayers = [];
                                for(const player of pots[0].players){
                                    if(player.member.id === currentPlayer.member.id || !player.allIn) continue;
                                    if(player.bet < pots[0].callAmount){ // Check current bet against ante
                                        shortStackedPlayers.push(player);
                                    }
                                }
                                if(shortStackedPlayers.length > 0){ //make side pots for short stacked players
                                    let sidePotMessage = `${currentPlayer.member.toString()} has gone all-in raising their bet to ${currentPlayer.bet} chips.\n`;
                                    outerLoop:
                                    for(const shortStackedPlayer of shortStackedPlayers){
                                        for(let i = 1; i < pots.length; i++){
                                            if(pots[i].players.some(p => p.member.id === shortStackedPlayer.member.id)) continue outerLoop;
                                        }

                                        // reduce the pot and ante for the main pot
                                        pots[0].callAmount -= shortStackedPlayer.bet; 
                                        pots[0].amount -= shortStackedPlayer.bet;

                                        //  create side pot
                                        let sidePotAmount = shortStackedPlayer.bet;
                                        let sidePotPlayers = [shortStackedPlayer];
                                        for(const player of pots[0].players){ //remove all bet from the main pot for all players in the main pot
                                            if(player.member.id === shortStackedPlayer.member.id) continue;  
                                            if(player.bet >= shortStackedPlayer.bet){
                                                pots[0].amount -= shortStackedPlayer.bet;
                                                player.bet -= shortStackedPlayer.bet;
                                                sidePotAmount += shortStackedPlayer.bet;
                                                sidePotPlayers.push(player);
                                            }
                                        }//make the side pot
                                        pots.push({
                                            amount: sidePotAmount,
                                            players: [...sidePotPlayers],
                                        });
                                        pots[0].players = pots[0].players.filter(player => player.member.id !== shortStackedPlayer.member.id); //remove the short stacked player from the main pot
                                        sidePotMessage += `${shortStackedPlayer.member.toString()} is all-in and cannot match the bet so side pot ${pots.length-1} was created.\n`;
                                    }
                                    await channel.send(`${sidePotMessage}**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                                } else {
                                    await channel.send(`${currentPlayer.member.toString()} has gone all-in raising the ante to ${pots[0].callAmount} chips!
**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                                }
                            } else { // the player is making a side pot// reduce the pot and ante for the main pot
                                pots[0].callAmount -= currentPlayer.bet; 
                                pots[0].amount -= startingBet;

                                //  create side pot
                                let sidePotAmount = currentPlayer.bet;
                                let sidePotPlayers = [currentPlayer];
                                for(const player of pots[0].players){ //remove bet from the main pot for all players in the main pot
                                    if(player.member.id === currentPlayer.member.id) continue;  
                                    if(player.bet >= currentPlayer.bet){
                                        pots[0].amount -= currentPlayer.bet;
                                        player.bet -= currentPlayer.bet;
                                        sidePotAmount += currentPlayer.bet;
                                        sidePotPlayers.push(player);
                                    }
                                }
                                pots[0].players = pots[0].players.filter(player => player.member.id !== currentPlayer.member.id); //remove the player from the main pot
                                //make the side pot
                                pots.push({
                                    amount: sidePotAmount,
                                    players: [...sidePotPlayers],
                                });
                                await channel.send(`${currentPlayer.member.toString()} has gone all-in, starting side pot ${pots.length-1}!
**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => pot.wild ? `Wild Pot ${i+1}: ${pot.amount}` : `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                            }
                            //make the player all in
                            currentPlayer.chips = 0;
                            currentPlayer.allIn = true;
                        }

                        // Move to the next player
                        currentPlayerIndex++;
                        collector.stop();
                    }
                } catch (error) {
                    console.error('Button interaction error:', error);
                    await i.reply({ content: "An error occurred while processing your action.", ephemeral: true }).catch(console.error);
                }
            });

            collector.on('end', async (collected, reason) => {
                message.delete();

                if (reason === 'time' ) {
                    await channel.send(`${currentPlayer.member.toString()} took too long to respond and has folded.`);
                    currentPlayer.bet = 0;
                    currentPlayer.folded = true;
                    pots[0].players = pots[0].players.filter(player => player.member.id !== currentPlayer.member.id);
                    for(let i = 1; i < pots.length; i++){
                        if(pots[i].players.length >= 2){
                            pots[i].players = pots[i].players.filter(player => player.member.id !== currentPlayer.member.id);
                            if(pots[i].players.length === 1) await channel.send(`${pots[i].players[0].member.toString()} has won side pot ${i}!`);
                        }
                    }
                    currentPlayerIndex++;
                }

                if (currentPlayerIndex < players.length) {
                    const result = await processPlayerAction();
                    resolve(result);
                } else {
                    const needsAnotherRound = pots[0].players.some(player => 
                        !player.folded && !player.allIn && player.bet < pots[0].callAmount
                    );

                    if (needsAnotherRound) {
                        currentPlayerIndex = 0;
                        const result = await processPlayerAction();
                        resolve(result);
                    } else {
                        resolve([players, pots]);
                    }
                }
            });
        });
    };
    return processPlayerAction();
}

// Add these functions to handle NPC AI decisions
async function getNPCAction(player, pots, betLimit, wildMagic, stage, communityCards) {
    const NUM_SIMULATIONS = communityCards[4][0] === 4 ? 2500 : 10000;
    const RAISE_THRESHOLD = 0.625;
    const RANDOMNESS_FACTOR = 0.141;
    
    // Calculate current pot odds
    const callAmount = pots[0].callAmount - player.bet;
    const potOdds = callAmount / (pots[0].amount + callAmount);
    
    // Count active opponents
    const numOpponents = pots[0].players.length - 1;
    if (numOpponents === 0) return 'call'; // No opponents left, just call
    
    // Run Monte Carlo simulation
    let wins = 0;
    
    for (let i = 0; i < NUM_SIMULATIONS; i++) {
        // Create a copy of the deck excluding known cards
        let deck = shuffleDeck();
        const knownCards = [...player.hand, ...communityCards.slice(0, stage === 0 ? 0 : stage === 1 ? 3 : stage === 2 ? 4 : 5)];
        deck = deck.filter(card => !knownCards.some(known => known[0] === card[0] && known[1] === card[1]));
        
        // Simulate opponent hands and remaining community cards
        const simulatedCommunityCards = [...communityCards];
        if (stage === 0) {
            simulatedCommunityCards.splice(0, 5, ...deck.splice(0, 5));
        } else if (stage === 1) {
            if(communityCards[4][0] === 4){
                simulatedCommunityCards.splice(3, 1, ...deck.splice(0, 1));
            } else {
                simulatedCommunityCards.splice(3, 2, ...deck.splice(0, 2));
            }
        } else if (stage === 2) {
            if(communityCards[4][0] !== 4) simulatedCommunityCards.splice(4, 1, ...deck.splice(0, 1));            
        }
        
        // Create array of all players for this simulation
        let simulatedPlayers = [
            { hand: player.hand }
        ];
        
        // Add simulated opponents
        for (let j = 0; j < numOpponents; j++) {
            simulatedPlayers.push({
                hand: wildMagic === 5 ? deck.splice(0, 2) : deck.splice(0, 3)
            });
        }
        
        // Evaluate all hands
        const results = simulatedPlayers.map(p => evaluateHand(p, simulatedCommunityCards));
        
        // Use breakTies to determine winner(s)
        const finalResults = breakTies(results);
        
        // Check if our player (index 0) is in the winning group
        if (finalResults[0].some(result => 
            result.hand[0][0] === player.hand[0][0] && 
            result.hand[0][1] === player.hand[0][1] && 
            result.hand[1][0] === player.hand[1][0] && 
            result.hand[1][1] === player.hand[1][1]
        )) {
            // Add partial win if tied
            wins += 1 / finalResults[0].length;
        }
    }
    
    // Calculate win rate
    const winRate = wins / NUM_SIMULATIONS;
    
    // Adjust thresholds based on number of opponents
    const randomness = Math.random() * RANDOMNESS_FACTOR * 2 - RANDOMNESS_FACTOR;
    const adjustedRaiseThreshold = RAISE_THRESHOLD / Math.sqrt(numOpponents) + randomness / Math.sqrt(numOpponents);
    
    // Calculate maximum bet based on win rate
    const maxBet = Math.floor(winRate * player.chips);
    
    // Pre-flop decisions are more aggressive       
    if(player.chips <= callAmount){
        if(winRate > adjustedRaiseThreshold){
            return 'allIn';
        } else {
            return 'fold';
        }
    } else if (!player.alreadyRaised && winRate > adjustedRaiseThreshold && maxBet > callAmount) {
        const raiseAmount = Math.min(
            Math.ceil(winRate * betLimit), 
            betLimit,
            player.chips - callAmount
        );
        if(player.chips - callAmount - raiseAmount <= 0) return 'allIn';
        return { action: 'raise', amount: raiseAmount };
    } else if(callAmount === 0){
        return 'call';
    } else if (maxBet >= callAmount) {
        if(player.chips - callAmount <= 0) return 'allIn';
        return 'call';
    } else {
        return 'fold';
    }
}

async function applyNPCAction(currentPlayer, players, pots, betLimit, meetsCallAmount, wildMagic, stage, communityCards, channel, emojis) {
    const actionResult = await getNPCAction(currentPlayer, pots, betLimit, wildMagic, stage, communityCards);
    
    const action = typeof actionResult === 'string' ? actionResult : actionResult.action;
    let difference = pots[0].callAmount - currentPlayer.bet;
    const startingBet = currentPlayer.bet;

    
    switch(action) {
        case 'fold':
            await channel.send(`${currentPlayer.member.toString()} has folded.`);
            currentPlayer.folded = true;
            pots[0].players = pots[0].players.filter(p => p.member.id !== currentPlayer.member.id);
            break;
        case 'call':
            currentPlayer.chips -= difference;
            currentPlayer.bet += difference;
            pots[0].amount += difference;
            await channel.send(`${currentPlayer.member.toString()} has ${meetsCallAmount ? 'checked' : 'called'} and has ${currentPlayer.chips} chips left.`);
            break;
        case 'raise':
            const raiseAmount = actionResult.amount;
            difference += raiseAmount;

            pots[0].callAmount += raiseAmount;
            currentPlayer.chips -= difference;
            currentPlayer.bet += difference;
            pots[0].amount += difference;
            for(const player of players){
                player.raised = false;
            }
            currentPlayer.raised = true;
            currentPlayer.alreadyRaised = true;

            // check for short stacked players
            const shortStackedPlayers = [];
            for(const player of pots[0].players){
                if(player.member.id === currentPlayer.member.id || !player.allIn) continue;
                if(player.bet < pots[0].callAmount){ // Check current bet against ante
                    shortStackedPlayers.push(player);
                }
            }
            if(shortStackedPlayers.length > 0){ //make side pots for short stacked players
                let sidePotMessage = `${currentPlayer.member.toString()} raised by ${raiseAmount} chips and has ${currentPlayer.chips} chips left.\n`;
                
                outerLoop:
                for(const shortStackedPlayer of shortStackedPlayers){
                    for(let i = 1; i < pots.length; i++){
                        if(pots[i].players.some(p => p.member.id === shortStackedPlayer.member.id)) continue outerLoop;
                    }

                    // reduce the pot and ante for the main pot
                    pots[0].callAmount -= shortStackedPlayer.bet; 
                    pots[0].amount -= shortStackedPlayer.bet;

                    //  create side pot
                    let sidePotAmount = shortStackedPlayer.bet;
                    let sidePotPlayers = [shortStackedPlayer];
                    for(const player of pots[0].players){ //remove all bet from the main pot for all players in the main pot
                        if(player.member.id === shortStackedPlayer.member.id) continue;  
                        if(player.bet >= shortStackedPlayer.bet){
                            pots[0].amount -= shortStackedPlayer.bet;
                            player.bet -= shortStackedPlayer.bet;
                            sidePotAmount += shortStackedPlayer.bet;
                            sidePotPlayers.push(player);
                        }
                    }//make the side pot
                    pots.push({
                        amount: sidePotAmount,
                        players: [...sidePotPlayers],
                    });
                    pots[0].players = pots[0].players.filter(player => player.member.id !== shortStackedPlayer.member.id); //remove the short stacked player from the main pot
                    sidePotMessage += `${shortStackedPlayer.member.toString()} is all-in and cannot match the bet so side pot ${pots.length-1} was created.\n`;
                }
                await channel.send(sidePotMessage);
            } else {
                await channel.send(`${currentPlayer.member.toString()} raised by ${raiseAmount} chips and has ${currentPlayer.chips} chips left.`);
            }
            break;
        case 'allIn'://calculate the bet
            currentPlayer.bet += currentPlayer.chips;
            if(currentPlayer.bet >= pots[0].callAmount) { //the player can afford the main pot=
                if(currentPlayer.bet - pots[0].callAmount > 0){
                    for(const player of players){
                        player.raised = false;
                    }
                }
                pots[0].callAmount += currentPlayer.bet - pots[0].callAmount;
                pots[0].amount += currentPlayer.chips;
                // check for short stacked players
                const shortStackedPlayers = [];
                for(const player of pots[0].players){
                    if(player.member.id === currentPlayer.member.id || !player.allIn) continue;
                    if(player.bet < pots[0].callAmount){ // Check current bet against ante
                        shortStackedPlayers.push(player);
                    }
                }
                if(shortStackedPlayers.length > 0){ //make side pots for short stacked players
                    let sidePotMessage = `${currentPlayer.member.toString()} has gone all-in raising their bet to ${currentPlayer.bet} chips.\n`;
                    outerLoop:
                    for(const shortStackedPlayer of shortStackedPlayers){
                        for(let i = 1; i < pots.length; i++){
                            if(pots[i].players.some(p => p.member.id === shortStackedPlayer.member.id)) continue outerLoop;
                        }

                        // reduce the pot and ante for the main pot
                        pots[0].callAmount -= shortStackedPlayer.bet; 
                        pots[0].amount -= shortStackedPlayer.bet;

                        //  create side pot
                        let sidePotAmount = shortStackedPlayer.bet;
                        let sidePotPlayers = [shortStackedPlayer];
                        for(const player of pots[0].players){ //remove all bet from the main pot for all players in the main pot
                            if(player.member.id === shortStackedPlayer.member.id) continue;  
                            if(player.bet >= shortStackedPlayer.bet){
                                pots[0].amount -= shortStackedPlayer.bet;
                                player.bet -= shortStackedPlayer.bet;
                                sidePotAmount += shortStackedPlayer.bet;
                                sidePotPlayers.push(player);
                            }
                        }//make the side pot
                        pots.push({
                            amount: sidePotAmount,
                            players: [...sidePotPlayers],
                        });
                        pots[0].players = pots[0].players.filter(player => player.member.id !== shortStackedPlayer.member.id); //remove the short stacked player from the main pot
                        sidePotMessage += `${shortStackedPlayer.member.toString()} is all-in and cannot match the bet so side pot ${pots.length-1} was created.\n`;
                    }
                    await channel.send(sidePotMessage);
                } else {
                    await channel.send(`${currentPlayer.member.toString()} has gone all-in!`);
                }
            } else { // the player is making a side pot// reduce the pot and ante for the main pot
                pots[0].callAmount -= currentPlayer.bet; 
                pots[0].amount -= startingBet;

                //  create side pot
                let sidePotAmount = currentPlayer.bet;
                let sidePotPlayers = [currentPlayer];
                for(const player of pots[0].players){ //remove bet from the main pot for all players in the main pot
                    if(player.member.id === currentPlayer.member.id) continue;  
                    if(player.bet >= currentPlayer.bet){
                        pots[0].amount -= currentPlayer.bet;
                        player.bet -= currentPlayer.bet;
                        sidePotAmount += currentPlayer.bet;
                        sidePotPlayers.push(player);
                    }
                }
                pots[0].players = pots[0].players.filter(player => player.member.id !== currentPlayer.member.id); //remove the player from the main pot
                //make the side pot
                pots.push({
                    amount: sidePotAmount,
                    players: [...sidePotPlayers],
                });
                await channel.send(`${currentPlayer.member.toString()} has gone all-in, starting side pot ${pots.length-1}!`);
            }
            //make the player all in
            currentPlayer.chips = 0;
            currentPlayer.allIn = true;
            break;
    }
    
    return action;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shadowdale')
        .setDescription('Start a game of Shadowdale Hold\'em.')
        .addIntegerOption(option =>
            option.setName('buy-in')
                .setDescription('Amount of chips that players get at the start. No scritch bucks are required!')
                .setRequired(true)
				.setMinValue(5))
        .addIntegerOption(option =>
            option.setName('small-blind')
                .setDescription('Sets the amount of chips automatically put forward by the small blind player.')
                .setRequired(false)
				.setMinValue(0))
        .addIntegerOption(option => 
            option.setName('big-blind')
                .setDescription('Sets the amount of chips automatically put forward by the big blind player.')
                .setRequired(false)
				.setMinValue(0))
        .addStringOption(option =>
            option.setName('dm-play')
                .setDescription('Whether the DM will participate. Default is true.')
                .setRequired(false)
                .addChoices(
                    { name: 'true', value: 'true' },
                    { name: 'false', value: 'false' }
                )),
    game: true,
    catId: 9, //Joey
    image: 'https://cdn.discordapp.com/attachments/1000574162017992884/1325624155919614034/holdem-hands.jpeg',
    help: `Shadowdale Hold'em is a poker-style card game popular in taverns across the realms. It's similar to Texas Hold'em but with a twist suited for the adventurous life of Faerûn. This command does not use scritch bucks and instead is intended to use D&D currency. The dungeon master (the player who started the game) can choose to not participate and can add NPCs that use the Monte Carlo method to decide their actions.

**Game Flow:**
1. The game uses a standard 52-card deck that is shuffled at the start of every round, plus a joker card that is set aside for later.
2. The dealer deals 5 cards face down to the middle of the table which are called the **community cards**. Then, each player is dealt 2 private cards (their **hole cards**)
3. Betting occurs in 4 rounds:
   - Initial betting
   - Flop (first 3 community cards)
   - Turn (4th community card)
   - River (5th community card)
4. Showdown: All remaining players reveal their hands and the best hand wins

**Betting Rules:**
- Small blind and big blind are posted automatically (defaults to 1% and 2% of buy-in)
- If there are no blinds amounts then the call amount is 2% of the buy-in
- The small bet limit is twice the starting call amount and the big bet limit is twice that
- On your turn, you can:
   - Fold: Give up your hand
   - Call/Check: Match the current call amount
   - Raise: Increase the betting amount up to the bet limit
   - All-in: Bet all remaining chips if it is less than or equal to the bet limit
- The main pot is a pool of bets which are won by the winner of the round
- Side Pots are created when players goes all-in with fewer chips than the current bet or when all-in players are short stacked:
   - The all-in amount is removed from the main pot for each player that contributed that amount and added to that side pot
   - Players with more chips can continue betting in the main pot
   - If all players in a side pot but one fold, the remaining player wins the side pot at the end of the round even if they don't show their hand 
   - Pots are distributed at the end of the round

**Twist: Wild Magic Card**
When ever an Ace of Spades is revealed among the community cards, it triggers a "Wild Magic" effect that changes the rules. The dealer rolls 2d6, and one of the following effects takes place:

**Wild Magic Table (2d6)**
2. **Shadow Trick**: The main pot is reduced by half, and the other half is given to the dealer
3. **Chaotic Deal**: All players still in the game discard their current hole cards and receive two new ones from the deck
4. **The Swap**: Each player gives their hole cards to the player on their left
5. **Spread the Love**: Every player still in the game draws a third hole card
6. **Split the Pot**: At the showdown, the pots are split evenly between the players with the highest and lowest hands that are in each pot
7. **Wild River**: The river card is replaced with a joker card that is a wild card
8. **Modron Madness**: A lawful nuertral NPC modron buys in at the start of the next round
3. **Random Reveal**: A random player that has not folded must reveal their hole cards
10. **The Big Reveal**: All players still in the game must reveal their hole cards
11. **Instant Showdown**: The game skips straight to the Showdown
12. **Ultimate Showdown**: The call ammount is raised by the bet limit. All players still in the game automatically call or go all-in and the game skips straight to the Showdown

**Winning:**
- Best 5-card hand wins using any combination of your hole cards and community cards
- Aces are high or low depending on what is best for the player
- Jokers are wild and acts as any value or suit to benefit the player
- Players with the same hand rank win based on high card
- The winner wins any pots they contributed to
- If the winner didn't contribute to a pot that pot is distributed to the next winner in that pot
- Any wild magic rules in play must be taken into consideration`,
    async execute(interaction, pool, emojis) { 
        const buyIn = interaction.options.getInteger('buy-in');
        let smallBlindAmount = interaction.options.getInteger('small-blind');
        let bigBlindAmount = interaction.options.getInteger('big-blind');
        let startingCallAmount;
        const dmPlay = interaction.options.getString('dm-play') === null ? true : interaction.options.getString('dm-play') === 'true';
        let npcCount = 0;
        const channel = interaction.channel;
        const startTime = Date.now();

        if(buyIn < 5){
            return interaction.reply({
                content: "Buy-in must be at least 5 chips.",
                ephemeral: true
            });
        }

        if(smallBlindAmount === null) smallBlindAmount = Math.ceil(buyIn * 0.01);
        if(bigBlindAmount && bigBlindAmount < smallBlindAmount){
            return interaction.reply({
                content: "Big blind must be greater than small blind or be set to 0.",
                ephemeral: true
            });
        }

        if(bigBlindAmount === null){
            if(smallBlindAmount) bigBlindAmount = smallBlindAmount * 2;
            else bigBlindAmount = Math.ceil(buyIn * 0.02);
            startingCallAmount = bigBlindAmount;
        } else if(!bigBlindAmount){
            if(smallBlindAmount) startingCallAmount = smallBlindAmount * 2;
            else startingCallAmount = Math.ceil(buyIn * 0.02);
        } else {
            startingCallAmount = bigBlindAmount;
        }
        
        // Get database connection
        const conn = await pool.getConnection();
        try {
            // For the actual game message
            const message = await interaction.reply({ 
                content: `${interaction.member.toString()} has started a game of Shadowdale Hold'em and is the dungeon master of this game! 
The a buy-in is ${buyIn} chips (no scritch bucks required).
The game will start <t:${Math.ceil(startTime/1000)+122}:R> or when the dungeon master starts it.
${dmPlay ? `## Players
${interaction.member.toString()} (DM)` : ''}`,
                components: createLobbyButtons(),
                fetchReply: true
            });

            // Add game to database
            await conn.query('INSERT INTO `game` (channel_id, game) VALUES (?, "shadowdale holdem");', [channel.id]);

            // Create list of players with their chips
            let players = dmPlay ? [{
                member: interaction.member,
                chips: buyIn,
                bet: 0,
                hand: []
            }] : [];

            // Create button collector
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000 
            });

            collector.on('collect', async i => {
                try {
                    if (i.customId === 'join') {
                        // Check if player is already in game
                        if (players.some(p => p.member.id === i.user.id)) {
                            await i.reply({ content: "You're already in the game.", ephemeral: true });
                            return;
                        }

                        if(players.length >= 10) {
                            await i.reply({ content: "The game is too full. Only 10 players can join.", ephemeral: true });
                            return;
                        }

                        // Add player to game
                        players.push({
                            member: i.member,
                            chips: buyIn,
                            bet: 0,
                            lost: 0,
                            hand: []
                        });

                        await i.deferUpdate();
                        await channel.send(`${i.user.toString()}${interaction.member.id === i.user.id ? ' (DM)' : ''} has joined the game with a buy-in of ${buyIn} chips!`);

                        await message.edit({
                            content: `${interaction.member.toString()} has started a game of Shadowdale Hold'em and is the dungeon master of this game! 
The a buy-in is ${buyIn} chips (no scritch bucks required).
The game will start <t:${Math.ceil(startTime/1000)+122}:R> or when the dungeon master starts it.
## Players
${players.map(player => `${player.member.toString()}${interaction.member.id === player.member.id ? ' (DM)' : ''}`).join('\n')}`,
                            components: createLobbyButtons()
                        });
                    } else if (i.customId === 'add-npc') {
                        if(players.length >= 10) {
                            await i.reply({ content: "The game is too full. Only 10 players can join.", ephemeral: true });
                            return;
                        }

                        // Create the modal
                        const modal = new ModalBuilder()
                            .setCustomId(`npcModal-${i.id}`)
                            .setTitle('Add NPC');

                        let npcName;
                        do {
                            npcName = fantasyNames[randInt(fantasyNames.length-1)];
                        } while (players.some(player => player.member && player.member.name === npcName));
        
                        // Create the text input component
                        const nameInput = new TextInputBuilder()
                            .setCustomId('nameInput')
                            .setLabel(`NPC Name`)
                            .setStyle(TextInputStyle.Short)
                            .setValue(npcName)
                            .setRequired(true)
                            .setMinLength(1)
                            .setMaxLength(12);

                        // Add the text input to the modal
                        const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
                        modal.addComponents(firstActionRow);

                        // Show the modal
                        await i.showModal(modal);

                        try {
                            const modalResponse = await i.awaitModalSubmit({
                                time: 60000,
                                filter: j => j.customId === `npcModal-${i.id}`
                            }).catch(() => null);

                            if (!modalResponse) return;

                            // Check again if collector is still active
                            if (collector.ended) {
                                await modalResponse.reply({ 
                                    content: "It's too late to add an NPC.", 
                                    ephemeral: true 
                                });
                                return;
                            }

                            const name = modalResponse.fields.getTextInputValue('nameInput').trim();

                            if(players.some(p => p.npc && p.member.name && p.member.name.toLowerCase() === name.toLowerCase())){
                                await modalResponse.reply({ content: 'There is already an NPC with that name.', ephemeral: true });
                                return;
                            }

                            await modalResponse.deferUpdate();

                            // Add player to game
                            players.push({
                                npc: true,
                                member: new NPC(name, npcCount),
                                chips: buyIn,
                                bet: 0,
                                lost: 0,
                                hand: []
                            });

                            npcCount++;

                            await channel.send(`${name} (NPC) has joined the game with a buy-in of ${buyIn} chips!`);

                            await message.edit({
                                content: `${interaction.member.toString()} has started a game of Shadowdale Hold'em and is the dungeon master of this game! 
The a buy-in is ${buyIn} chips (no scritch bucks required).
The game will start <t:${Math.ceil(startTime/1000)+122}:R> or when the dungen master starts it.
## Players
${players.map(player => `${player.member.toString()}${interaction.member.id === player.member.id ? ' (DM)' : ''}`).join('\n')}`,
                                components: createLobbyButtons()
                            });
                        } catch (error) {
                            // console.error(error);
                        }
                    } else if (i.customId === 'start' || i.customId === 'cancel') {
                        // Only game host can start/cancel
                        if (channel.guild.id !== '825883828798881822' && i.user.id !== interaction.member.id) {
                            await i.reply({ content: `Only the game dungeon master can ${i.customId} the game.`, ephemeral: true });
                            return;
                        }

                        if (i.customId === 'start') {
                            if (players.length < 2) {
                                await i.reply({ content: "Need at least 2 players to start!", ephemeral: true });
                                return;
                            }

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
                if (reason !== 'cancelled' && players.length > 1) {                    
                    // Set initial blinds
                    const smallBlindAmount = Math.max(Math.floor(buyIn * 0.01), 1); // 1% of buy-in, minimum 1
                    const bigBlindAmount = smallBlindAmount * 2;

                    interaction.editReply({
                        content: `${interaction.member.toString()} has started a game of Shadowdale Hold'em and is the dungeon master of this game! 
The a buy-in is ${buyIn} chips (no scritch bucks required).
## Players
${players.map(player => `${player.member.toString()}${interaction.member.id === player.member.id ? ' (DM)' : ''}`).join('\n')}`,
                        components: [],
                    });
                    
                    return playHoldemRound(players, interaction.member, buyIn, smallBlindAmount, bigBlindAmount, startingCallAmount, channel, conn, emojis);
                } else if (reason === 'cancelled') {
                    if(!players.some(player => player.member.id === interaction.member.id)) players.unshift({ member: interaction.member });
                    await interaction.editReply({
                        content: `Game cancelled by dungeon master.
## Players
${players.map(player => `${player.member.toString()}${interaction.member.id === player.member.id ? ' (DM)' : ''}`).join('\n')}`,
                        components: []
                    });
                    await channel.send('Game cancelled by dungeon master..');
                } else {
                    await interaction.editReply({
                        content: `Game cancelled: Not enough players joined within the time limit.
## Players
${players.map(player => `${player.member.toString()}${interaction.member.id === player.member.id ? ' (DM)' : ''}`).join('\n')}`,
                        components: []
                    });
                }

                // Remove game from database
                await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id])
                    .catch(console.error);
            });

        } catch(err) {
            console.error('Holdem command error:', err);
            await interaction.editReply({ 
                content: "An error occurred while starting the game. Please try again."
            }).catch(console.error);
            
            await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id])
                .catch(console.error);
            throw err;
        } finally {
            conn.release();
        }
    },
};