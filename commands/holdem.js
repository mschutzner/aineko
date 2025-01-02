const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { sleep, shuffle } = require("../utils.js");
require('dotenv').config();

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

function shuffleDeck() {
    const deck = [];
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

function communityCardsString(communityCards, stage, emojis) { 
    const blackCard = getEmoji(emojis, 'blank_card');
    const blankSuit = getEmoji(emojis, 'blank_suit');
    switch(stage){
        case 0: // Pre-flop
            return `${blackCard} ${blackCard} ${blackCard} ${blackCard} ${blackCard}
${blankSuit} ${blankSuit} ${blankSuit} ${blankSuit} ${blankSuit}`;
        
        case 1: // Flop (first 3 cards)
            return `${communityCards.slice(0, 3).map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ${blackCard} ${blackCard}
${communityCards.slice(0, 3).map(card => getSuitEmoji(card[0], emojis)).join(' ')} ${blankSuit} ${blankSuit}`;
        
        case 2: // Turn (4 cards)
            return `${communityCards.slice(0, 4).map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ${blackCard}
${communityCards.slice(0, 4).map(card => getSuitEmoji(card[0], emojis)).join(' ')} ${blankSuit}`;
        
        case 3: // River (all 5 cards)
            return `${communityCards.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${communityCards.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`;
    }
}

async function playHoldemRound(players, host, buyIn, smallBlindAmount, bigBlindAmount, channel, conn, emojis) { 
    const blackCard = getEmoji(emojis, 'blank_card');
    const blankSuit = getEmoji(emojis, 'blank_suit');

    // Assign positions based on number of players
    let dealerPlayer, smallBlindPlayer, bigBlindPlayer;
    
    if (players.length > 2) {
        dealerPlayer = players[0];
        smallBlindPlayer = players[1];
        bigBlindPlayer = players[2];
    } else {
        dealerPlayer = players[0];
        smallBlindPlayer = players[0]; // dealer is small blind
        bigBlindPlayer = players[1];
    }

    if(smallBlindPlayer.chips < smallBlindAmount){
        // Cash out all remaining players
        for (const player of players) {
            // Get current scritch_bucks before cash out
            const cashoutUserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [player.member.id]);
            const newAmount = cashoutUserDB[0][0].scritch_bucks + player.chips;
            const highestScritchBucks = Math.max(newAmount, cashoutUserDB[0][0].scritch_bucks_highscore);

            // Update scritch_bucks and record transaction
            await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                [newAmount, highestScritchBucks, player.member.id]);
            await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                [player.member.id, newAmount, player.member.user.username]);
        }
        await channel.send(`${smallBlindPlayer.member.toString()} can not afford the small blind and the game must end to prevent a stack overflow. All players have been cashed out.`);
        await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id])
            .catch(console.error);
        return;
    }
    if(bigBlindPlayer.chips < bigBlindAmount){
        // Cash out all remaining players
        for (const player of players) {
            // Get current scritch_bucks before cash out
            const cashoutUserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [player.member.id]);
            const newAmount = cashoutUserDB[0][0].scritch_bucks + player.chips;
            const highestScritchBucks = Math.max(newAmount, cashoutUserDB[0][0].scritch_bucks_highscore);

            // Update scritch_bucks and record transaction
            await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                [newAmount, highestScritchBucks, player.member.id]);
            await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                [player.member.id, newAmount, player.member.user.username]);
        }
        await channel.send(`${bigBlindPlayer.member.toString()} can not afford the big blind and the game must end to prevent a stack overflow. All players have been cashed out.`);
        await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id])
            .catch(console.error);
        return;
    }

    smallBlindPlayer.chips -= smallBlindAmount;
    bigBlindPlayer.chips -= bigBlindAmount;
    
    smallBlindPlayer.bet = smallBlindAmount;
    bigBlindPlayer.bet = bigBlindAmount;
    smallBlindPlayer.totalBet = smallBlindAmount;
    bigBlindPlayer.totalBet = bigBlindAmount;

    const pots = [
        {
            amount: smallBlindAmount + smallBlindAmount,
            ante: bigBlindAmount,
            players: [...players]
        }
    ];

    // Send game start message to the channel
    await channel.send(`## Game started!
${dealerPlayer.member.toString()} shuffled the deck and dealt the cards to your direct messages.
${smallBlindPlayer.member.toString()} payed the small blind of ฅ${smallBlindAmount}.
${bigBlindPlayer.member.toString()} payed the big blind of ฅ${bigBlindAmount}.
**Community Cards**:
${blackCard} ${blackCard} ${blackCard} ${blackCard} ${blackCard}
${blankSuit} ${blankSuit} ${blankSuit} ${blankSuit} ${blankSuit}
Main Pot: ${pots[0].amount}`);

    const deck = shuffleDeck();
    const communityCards = deck.splice(0, 5);

    for (const player of players) {
        //deal 2 cards to each player
        player.hand = deck.splice(0, 2);

        // Sort the hand by card value, treating Aces as high
        player.hand.sort((a, b) => (b[1] === 1 ? 14 : b[1]) - (a[1] === 1 ? 14 : a[1]));

        // Send the hand message as direct messages
        await player.member.send(`**Your hand:**
${player.hand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${player.hand.map(card => getSuitEmoji(card[0], emojis)).join(' ')}`);
    }

    if (players.length > 2) {
        const firstPlayer = players.shift();
        players.push(firstPlayer);
    }
    
    await channel.send(`## Time for initial bets`);
    const [preflopPlayers, preflopPots, preflopFolded] = await playHoldemStage(players, pots, 0, communityCards, channel, conn, emojis);
    if(preflopFolded || preflopPlayers.filter(player => !player.allIn && !player.folded).length <= 1) return determineWinner(communityCards, preflopPlayers, preflopPots, host, buyIn, smallBlindAmount, bigBlindAmount, channel, conn, emojis);
   
    if(preflopPlayers.length === 2) preflopPlayers.reverse();
   
    await channel.send(`## Proceeding to the flop.
**Community Cards**:
${communityCardsString(communityCards, 1, emojis)}
Main Pot: ${preflopPots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
    const [flopPlayers, flopPots, flopFolded] = await playHoldemStage(preflopPlayers, preflopPots, 1, communityCards, channel, conn, emojis);
    if(flopFolded || flopPlayers.filter(player => !player.allIn && !player.folded).length <= 1) return determineWinner(communityCards, flopPlayers, flopPots, host, buyIn, smallBlindAmount, bigBlindAmount, channel, conn, emojis);
   
    await channel.send(`## Now it's time for the turn.
**Community Cards**:
${communityCardsString(communityCards, 2, emojis)}
Main Pot: ${flopPots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
    const [turnPlayers, turnPots, turnFolded] = await playHoldemStage(flopPlayers, flopPots, 2, communityCards, channel, conn, emojis);
    if(turnFolded || turnPlayers.filter(player => !player.allIn && !player.folded).length <= 1) return determineWinner(communityCards, turnPlayers, turnPots, host, buyIn, smallBlindAmount, bigBlindAmount, channel, conn, emojis);
   
    await channel.send(`## Sailing down the river!
**Community Cards**:
${communityCardsString(communityCards, 3, emojis)}
Main Pot: ${turnPots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
    const [riverPlayers, riverPots, riverFolded] = await playHoldemStage(turnPlayers, turnPots, 3, communityCards, channel, conn, emojis);
    
    await channel.send("## It's the final showdown!");
    return determineWinner(communityCards, riverPlayers, riverPots, host, buyIn, smallBlindAmount, bigBlindAmount, channel, conn, emojis);
}

async function determineWinner(communityCards, players, pots, host, buyIn, smallBlindAmount, bigBlindAmount, channel, conn, emojis) {    
    // Function to evaluate poker hands
    const evaluateHand = async(player, communityCards) => {
        const hand = [...player.hand, ...communityCards];
        
        // Sort the hand by card value, treating Aces as high
        hand.sort((a, b) => (b[1] === 1 ? 14 : b[1]) - (a[1] === 1 ? 14 : a[1]));
        
        // Check for pairs, three of a kind, etc.
        const valueCounts = {};
        hand.forEach(card => {
            const value = card[1];
            valueCounts[value] = (valueCounts[value] || 0) + 1;
        });
        const counts = Object.values(valueCounts);
    
        const suitCounts = [0,0,0,0]
        for(const card of hand){
            suitCounts[card[0]]++
        }
        const mostSuitIndex = suitCounts.indexOf(Math.max(...suitCounts));
        const sameSuitCards = hand.filter(card => card[0] === mostSuitIndex);
        const isFlush = sameSuitCards.length >= 5;
        
        let isRoyalFlush
        let straightLength = 0;
        for(let i = sameSuitCards.length - 1; i > 0; i--){
            if(sameSuitCards[i][1] < 10) continue;
            if(sameSuitCards[i-1][1] === sameSuitCards[i][1]) continue
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
            if(sameSuitCards[i-1][1] === sameSuitCards[i][1]) continue
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
        for(let i = hand.length - 1; i > 0; i--){
            if(hand[i-1][1] === hand[i][1]) continue
            if(hand[i-1][1] - hand[i][1] === 1  || (hand[i-1][1] === 1 && hand[i][1] === 13)){
                straightLength++;
            } else {
                straightLength = 0;
            }
            if(straightLength === 4){
                isHighStraight = true;
                break;
            }
        }
    
        const isLowStraight = !isHighStraight && hand.some(card => card[1] === 1) && hand.some(card => card[1] === 2) && hand.some(card => card[1] === 3) && hand.some(card => card[1] === 4) && hand.some(card => card[1] === 5);
    
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
            handName = "Steel Wheel";  // Common name for A-2-3-4-5 straight flush
            // First get all cards of the same suit
            const sameSuitCards = hand.filter(card => card[0] === hand[0][0]);
            // Get cards 2-5 first in descending order, then add ace at the end
            const twoToFive = sameSuitCards.filter(card => card[1] >= 2 && card[1] <= 5)
                .sort((a, b) => b[1] - a[1]);  // Changed to descending order
            const ace = sameSuitCards.find(card => card[1] === 1);
            bestHand = [...twoToFive, ace];
        } else if (counts.includes(4)) {
            rank = 8;
            handName = "Four of a Kind";
            const value = Number(Object.keys(valueCounts).find(key => valueCounts[key] === 4));
            bestHand = [
                ...hand.filter(card => card[1] === value),
                ...hand.filter(card => card[1] !== value).slice(0, 1)
            ];
        } else if (counts.filter(count => count >= 2).length >= 2 && counts.filter(count => count >= 3).length >= 1) {
            rank = 7;
            handName = "Full House";
            handName = "Full House";
            const threeValue = Number(Object.keys(valueCounts).find(key => valueCounts[key] >= 3));
            const twoValue = Number(Object.keys(valueCounts).find(key => key != threeValue && valueCounts[key] >= 2));
            bestHand = [
                ...hand.filter(card => card[1] === threeValue).slice(0, 3),
                ...hand.filter(card => card[1] === twoValue).slice(0, 2)
            ];
            //give the Joey cat to user
            const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
                [player.member.id, 9, player.member.displayName, 'Joey']);
            if(userCatDB[0].affectedRows){
                await channel.send({content: `<@${player.member.id}> just gained ownership of Joey by getting a full house! This unlocks the /shadowdale command (coming soon).`, files: ['images/cats/Joey.jpg']});
            }
        } else if (isFlush) {
            rank = 6;
            handName = "Flush";
            bestHand = sameSuitCards.slice(0, 5);
        } else if (isHighStraight) {
            rank = 5;
            handName = "Straight";
            for(let i = 0; i < hand.length - 1; i++){
                if (hand[i][1] === hand[i+1][1]) continue;
                if(hand[i][1] - hand[i+1][1] === 1 || (hand[i][1] === 1 && hand[i+1][1] === 13)){
                    bestHand.push(hand[i]);
                } else {
                    bestHand = [];
                    continue;
                }
                if(bestHand.length === 4){
                    bestHand.push(hand[i+1]);
                    break;
                }
            }
        } else if (isLowStraight) {
            rank = 4;
            handName = "Wheel";  // Common name for A-2-3-4-5 straight
            // Get cards 2-5 first in descending order, then add ace at the end
            const twoToFive = hand.filter(card => card[1] >= 2 && card[1] <= 5)
                .sort((a, b) => b[1] - a[1]);  // Changed to descending order
            const aces = hand.filter(card => card[1] === 1);
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
                ...hand.filter(card => card[1] === value),
                ...hand.filter(card => card[1] !== value).slice(0, 2)
            ];
        } else if (counts.filter(count => count === 2).length >= 2) {
            rank = 2;
            handName = "Two Pair";
            const pairValues = Object.keys(valueCounts)
                .filter(key => valueCounts[key] === 2)
                .map(Number)
                .sort((a, b) => (b === 1 ? 14 : b) - (a === 1 ? 14 : a));
            bestHand = [
                ...hand.filter(card => card[1] === pairValues[0]),
                ...hand.filter(card => card[1] === pairValues[1]),
                ...hand.filter(card => !pairValues.includes(card[1])).slice(0, 1)
            ];
        } else if (counts.includes(2)) {
            rank = 1;
            handName = "One Pair";
            const value = Number(Object.keys(valueCounts).find(key => valueCounts[key] === 2));
            bestHand = [
                ...hand.filter(card => card[1] === value),
                ...hand.filter(card => card[1] !== value).slice(0, 3)
            ];
        } else {
            bestHand = hand.slice(0, 5);
        }
    
        return {
            ...player,
            rank,
            handName,
            bestHand
        };
    };
    
    const breakTies = (results) => {
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

    const playersInGame = players.filter(player => !player.folded);
    const results = await Promise.all(playersInGame.map(player => evaluateHand(player, communityCards)));
    const finalResults = breakTies(results);

    //reverse to list hands in ascending order
    finalResults.reverse();

    const blankEmoji = getEmoji(emojis, 'blank');

    // Construct the message to show hands
    let handsMessage = "## Players' Hands:\n";
    finalResults.forEach(result => {
        result.forEach(player => {
            handsMessage += `${player.member.toString()} - ${player.handName}
${player.bestHand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')} ${blankEmoji} ${player.hand.map(card => getValueEmoji(card[0], card[1], emojis)).join(' ')}
${player.bestHand.map(card => getSuitEmoji(card[0], emojis)).join(' ')} ${blankEmoji} ${player.hand.map(card => getSuitEmoji(card[0], emojis)).join(' ')}\n`;
        });
    });
    await channel.send(handsMessage);

    //reverse back to descending order
    finalResults.reverse();

    // Sort pots by ante amount (highest to lowest)
    pots.sort((a, b) => b.ante - a.ante);

    //distribute pots
    for(const pot of pots) {
        // Helper function to distribute pot to winners of a specific rank
        const distributePotToRank = (potentialWinners, rankIndex = 0) => {
            // If we've checked all ranks and found no winners, something is wrong
            if(rankIndex >= finalResults.length) {
                console.error('No winners found in any rank for pot:', pot);
                return;
            }

            // Get winners at current rank who are eligible for this pot
            const currentRankWinners = finalResults[rankIndex]
                .filter(player => 
                    !player.folded && 
                    pot.players.some(p => p.member.id === player.member.id)
                );

            // If no winners at this rank, try next rank
            if(currentRankWinners.length === 0) {
                return distributePotToRank(potentialWinners, rankIndex + 1);
            }

            // Split pot amount among winners
            const winAmount = Math.floor(pot.amount / currentRankWinners.length);
            const remainder = pot.amount % currentRankWinners.length;

            // Distribute winnings and track for message
            currentRankWinners.forEach((winner, index) => {
                // Add remainder to first winner if pot can't be split evenly
                const extraChip = index === 0 ? remainder : 0;
                const totalWin = winAmount + extraChip;
                
                // Initialize won property if it doesn't exist
                if(!winner.won) winner.won = 0;
                winner.won += totalWin;
                winner.chips += totalWin;
            });
        };

        // Get all potential winners for this pot (not folded and in pot.players)
        const potentialWinners = finalResults
            .flatMap(group => group)
            .filter(player => 
                !player.folded && 
                pot.players.some(p => p.member.id === player.member.id)
            );

        if(potentialWinners.length === 0) {
            console.error('No potential winners found for pot:', pot);
            continue;
        }

        // Start distribution from highest rank (index 0)
        distributePotToRank(potentialWinners);
    }

    let winningMessage = '';
    let winners = [];
    for(const finalResult of finalResults){
        for(const player of finalResult){
            if(player.won) winners.push(player);
        }
    }
    winners.sort((a, b) => b.won - a.won);
    winners.forEach(winner => {
        winningMessage += `# ${winner.member.toString()} won ฅ${winner.won} with ${winner.handName}!\n`;
        players.find(p => p.member.id === winner.member.id).chips = winner.chips;
    });
    await channel.send(winningMessage);

    completeRound(players, host, buyIn, smallBlindAmount, bigBlindAmount, channel, conn, emojis);
}

async function completeRound(players, host, buyIn, smallBlindAmount, bigBlindAmount, channel, conn, emojis){

    let nexRoundStartTime = Math.ceil(Date.now()/1000)+62;

    const previousPlayers = players;

    players.forEach(player => {
        player.folded = false;
        player.allIn = false;
        player.bet = 0;
        player.totalBet = 0;
        player.hand = [];
    });

    //remove busted players
    players = players.filter(player => player.chips > 0);

    //cash out players who can't pay small blind
    let smallBlindPlayer;
    while(!smallBlindPlayer){
        if(players.length < 2){
            const player = players[0];

            const cashoutUserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [player.member.id]);
            const newAmount = cashoutUserDB[0][0].scritch_bucks + player.chips;
            const highestScritchBucks = Math.max(newAmount, cashoutUserDB[0][0].scritch_bucks_highscore);

            // Update scritch_bucks and record transaction
            await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                [newAmount, highestScritchBucks, player.member.id]);
            await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                [player.member.id, newAmount, player.member.user.username]);
                
            const message = await channel.send(`## Game Ended
Players of the last round now have:
${previousPlayers.map(player => `${player.member.toString()} - ฅ${player.chips}${player.chips === 0 ? ' (busted)' : ' (cashed out)'}`).join('\n')}`);
            
            await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id])
            .catch(console.error);

            return;
        } else if(players[1].chips < bigBlindAmount){
            const player = players[1];
            previousPlayers.find(p => p.member.id === player.member.id).cashedOut = true;
            players = players.filter(p => p.member.id !== player.member.id); // Remove player from players array
            
            const cashoutUserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [player.member.id]);
            const newAmount = cashoutUserDB[0][0].scritch_bucks + player.chips;
            const highestScritchBucks = Math.max(newAmount, cashoutUserDB[0][0].scritch_bucks_highscore);

            await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                [newAmount, highestScritchBucks, player.member.id]);
            await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                [player.member.id, newAmount, player.member.user.username]);

            await channel.send(`${player.member.toString()} can not afford the big blind and has been cashed out for ฅ${player.chips}.`);
        } else {
            smallBlindPlayer = players[1];
        }
    }

    let bigBlindPlayer;
    while(!bigBlindPlayer){
        if(players.length < 2){
            const player = players[0];

            const cashoutUserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [player.member.id]);
            const newAmount = cashoutUserDB[0][0].scritch_bucks + player.chips;
            const highestScritchBucks = Math.max(newAmount, cashoutUserDB[0][0].scritch_bucks_highscore);

            // Update scritch_bucks and record transaction
            await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                [newAmount, highestScritchBucks, player.member.id]);
            await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                [player.member.id, newAmount, player.member.user.username]);
                
            const message = await channel.send(`## Game Ended
Players of the last round now have:
${previousPlayers.map(player => `${player.member.toString()} - ฅ${player.chips}${player.chips === 0 ? ' (busted)' : ' (cashed out)'}`).join('\n')}`);
            
            await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id])
            .catch(console.error);

            return;
        } else if(players.length < 4){
            if(players[0].chips < bigBlindAmount){
                const player = players[0];
                previousPlayers.find(p => p.member.id === player.member.id).cashedOut = true;
                players = players.filter(p => p.member.id !== player.member.id); // Remove player from players array
                
                const cashoutUserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [player.member.id]);
                const newAmount = cashoutUserDB[0][0].scritch_bucks + player.chips;
                const highestScritchBucks = Math.max(newAmount, cashoutUserDB[0][0].scritch_bucks_highscore);
    
                await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                    [newAmount, highestScritchBucks, player.member.id]);
                await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                    [player.member.id, newAmount, player.member.user.username]);
    
                await channel.send(`${player.member.toString()} can not afford the big blind and has been cashed out for ฅ${player.chips}.`);
            } else {
                bigBlindPlayer = players[1];
            }
        } else if(players[2].chips < bigBlindAmount){
            const player = players[2];
            previousPlayers.find(p => p.member.id === player.member.id).cashedOut = true;
                
            const cashoutUserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [player.member.id]);
            const newAmount = cashoutUserDB[0][0].scritch_bucks + player.chips;
            const highestScritchBucks = Math.max(newAmount, cashoutUserDB[0][0].scritch_bucks_highscore);

            await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                [newAmount, highestScritchBucks, player.member.id]);
            await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                [player.member.id, newAmount, player.member.user.username]);

            await channel.send(`${player.member.toString()} can not afford the big blind and has been cashed out for ฅ${player.chips}.`);
        } else {
            bigBlindPlayer = players[2];
        }
    }

    // Check if host is no longer in players
    let newHost = false;
    if (!players.some(player => player.member.id === host.id)) {
        host = players[0].member;
        newHost = true;
    }

    // New message with button components for cashing out, starting, canceling, and joining
    const joinButton = new ButtonBuilder()
        .setCustomId('join')
        .setLabel('Join Game')
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

    const actionRow = new ActionRowBuilder().addComponents(joinButton, cashOutButton, startButton, cancelButton);

    const message = await channel.send({
        content: `## Round over!
Players of the last round now have:
${previousPlayers.map(player => `${player.member.toString()} - ฅ${player.chips}${player.chips === 0 ? ' (busted)' : ''}`).join('\n')}
${newHost ? `\n${host.toString()} is the new host.\n\n` : ''}Host must start game <t:${nexRoundStartTime}:R> or everyone will be cashed out.. 
Players can cash out now, new players can join, and the host can start the next round or cancel the game.
## Players in next game:
${players.map(player => `${player.member.toString()}${host.id === player.member.id ? ' (host)' : ''}`).join('\n')}`,
        components: [actionRow]
    });

    // Create a collector for the button interactions
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // 60 seconds for the collector
    });

    collector.on('collect', async i => {
        try {
            if (i.customId === 'join') {
                // Check if player is already in game
                if (players.some(p => p.member.id === i.user.id)) {
                    await i.reply({ content: "You're already in the game.", ephemeral: true });
                    return;
                }

                // Check if player has enough scritch bucks
                const joinUserDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [i.user.id]);
                if(joinUserDB[0].length === 0) {
                    await i.reply({ content: "You don't exist in the database.", ephemeral: true });
                    return;
                }
                if(buyIn > joinUserDB[0][0].scritch_bucks) {
                    await i.reply({ content: "You don't have enough scritch bucks.", ephemeral: true });
                    return;
                }

                // Take buy-in from player
                await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', 
                    [buyIn, i.user.id]);
                
                // Record transaction in user_scritch
                await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                    [i.user.id, joinUserDB[0][0].scritch_bucks - buyIn, i.user.username]);

                // Add player to game
                players.push({
                    member: i.member,
                    chips: buyIn,
                    bet: 0,
                    hand: []
                });

                await message.edit({
                    content: `## Round over!
Players of the last round now have:
${previousPlayers.map(player => `${player.member.toString()} - ฅ${player.chips}${player.cashedOut ? ' (cashed out)' : player.chips === 0 ? ' (busted)' : ''}`).join('\n')}
${newHost ? `\n${host.toString()} is the new host.\n\n` : ''}Host must start game <t:${nexRoundStartTime}:R> or everyone will be cashed out.. 
Players can cash out now, new players can join, and the host can start the next round or cancel the game.
## Players in next game:
${players.map(player => `${player.member.toString()}${host.id === player.member.id ? ' (host)' : ''}`).join('\n')}`,
                    components: [actionRow]
                });

                await i.deferUpdate();
                await channel.send(`${i.user.toString()} has joined the game with a buy-in of ฅ${buyIn}!`);
            } else if (i.customId === 'cashout') {
                const userDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [i.user.id]);
                if (userDB[0].length === 0) {
                    await i.reply({ content: "You don't exist in the database.", ephemeral: true });
                    return;
                }

                // Get the player's chips from the players array
                const player = players.find(p => p.member.id === i.user.id);
                if (!player) {
                    await i.reply({ content: "You are not in the game.", ephemeral: true });
                    return;
                }

                const currentAmount = userDB[0][0].scritch_bucks;
                const newAmount = currentAmount + player.chips; // Add player's chips to current scritch_bucks
                const highestScritchBucks = Math.max(newAmount, userDB[0][0].scritch_bucks_highscore);

                // Update scritch_bucks and record transaction
                await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                    [newAmount, highestScritchBucks, i.user.id]);
                await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                    [i.user.id, newAmount, i.user.username]); // Record the chips being cashed out

                players = players.filter(p => p.member.id !== i.user.id); // Remove player from players array
                previousPlayers.find(p => p.member.id === i.user.id).cashedOut = true;

                if (players.length >= 1 && i.user.id === host.id) {
                    host = players[0].member;
                    newHost = true;
                    await i.reply(`${i.user.toString()} has cashed out ${player.chips} scritch bucks. ${host.toString()} is now the new host!`);
                } else if(players.length === 0){
                    await i.reply(`${i.user.toString()} has cashed out ${player.chips} scritch bucks. Gane has ended.`);
                    collector.stop('cashed out');
                    return;
                } else {
                    await i.reply(`${i.user.toString()} has cashed out ${player.chips} scritch bucks.`);
                }

                // Add strikethrough to the player's chips line in the message
                const messageLines = message.content.split('\n');
                const playerLine = messageLines.findIndex(line => line.includes(`${i.user.toString()}`) && !line.includes('(cashed out)'));
                if (playerLine !== -1) {
                    messageLines[playerLine] = `${messageLines[playerLine]} (cashed out)`;
                    await message.edit(messageLines.join('\n'));
                }

                await message.edit({
                    content: `## Round over!
Players of the last round now have:
${previousPlayers.map(player => `${player.member.toString()} - ฅ${player.chips}${player.cashedOut ? ' (cashed out)' : player.chips === 0 ? ' (busted)' : ''}`).join('\n')}
${newHost ? `\n${host.toString()} is the new host.\n\n` : ''}Host must start game <t:${nexRoundStartTime}:R> or everyone will be cashed out.. 
Players can cash out now, new players can join, and the host can start the next round or cancel the game.
## Players in next game:
${players.map(player => `${player.member.toString()}${host.id === player.member.id ? ' (host)' : ''}`).join('\n')}`,
                    components: [actionRow]
                });

            } else if (i.customId === 'start' || i.customId === 'cancel') {
                // Only game host can start/cancel
                if (i.user.id !== host.id) {
                    await i.reply({ content: `Only the game host can ${i.customId} the game.`, ephemeral: true });
                    return;
                }

                if (i.customId === 'start') {
                    message.edit({
                        content: message.content,
                        components: [],
                    });

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
        if (reason === 'started' && players.length > 1) { 
            await message.edit({
                content: `## Round over!
Players of the last round now have:
${previousPlayers.map(player => `${player.member.toString()} - ฅ${player.chips}${player.cashedOut ? ' (cashed out)' : player.chips === 0 ? ' (busted)' : ''}`).join('\n')}`,
                components: []
            });

            players.push(players.shift());
            playHoldemRound(players, host, buyIn, smallBlindAmount, bigBlindAmount, channel, conn, emojis);
            return;
        } else {
            // Cash out all remaining players
            for (const player of players) {
                // Get current scritch_bucks before cash out
                const cashoutUserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [player.member.id]);
                const newAmount = cashoutUserDB[0][0].scritch_bucks + player.chips;
                const highestScritchBucks = Math.max(newAmount, cashoutUserDB[0][0].scritch_bucks_highscore);

                // Update scritch_bucks and record transaction
                await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                    [newAmount, highestScritchBucks, player.member.id]);
                await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                    [player.member.id, newAmount, player.member.user.username]);
            }

            if (reason === 'cancelled') {                         
                await channel.send('Game cancelled by host. All players have been cashed out.');
            } else if(reason === 'time'){                              
                await channel.send('Game cancelled because the host did not start the game in time. All players have been cashed out.');
            } else  if(reason !== 'cashed out') {                                 
                await channel.send('Game cancelled: Not enough players. All players have been cashed out.');
            }  

            await message.edit({
                content: `## Game Ended
Players of the last round now have:
${previousPlayers.map(player => `${player.member.toString()} - ฅ${player.chips}${player.chips === 0 ? ' (busted)' : ' (cashed out)'}`).join('\n')}`,
                components: []
            });

            await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id])
                .catch(console.error);
        }                            
    });
}

function createPokerButtons(enabled = true) {
    const fold = new ButtonBuilder()
        .setCustomId('fold')
        .setLabel('Fold')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!enabled);

    const call = new ButtonBuilder()
        .setCustomId('call')
        .setLabel('Call')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!enabled);

    const raise = new ButtonBuilder()
        .setCustomId('raise')
        .setLabel('Raise')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!enabled);

    const allIn = new ButtonBuilder()
        .setCustomId('allin')
        .setLabel('All In')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!enabled);

    const row1 = new ActionRowBuilder().addComponents(fold, call);
    const row2 = new ActionRowBuilder().addComponents(raise, allIn);

    return [row1, row2];
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

async function playHoldemStage(players, pots, stage, communityCards, channel, conn, emojis) {
    // Update the game timestamp in the database
    await conn.query('UPDATE `game` SET `start_time` = NOW() WHERE `channel_id` = ?;', [channel.id]);

    const actionRow = createPokerButtons(); // Create buttons for player actions

    let currentPlayerIndex = 0;

    let playersStillIn = players.length;

    const processPlayerAction = async () => {
        const currentPlayer = players[currentPlayerIndex];

        if(playersStillIn === 1) {
            return [players, pots, true];
        }

        if (currentPlayer.folded || currentPlayer.allIn || currentPlayer.chips === 0) {
            if (currentPlayerIndex < players.length - 1) {
                currentPlayerIndex++;
                return processPlayerAction();
            } else {
                // Check if we need another round
                const needsAnotherRound = players.some(player => 
                    !player.folded && !player.allIn && player.bet < pots[0].ante
                );

                if (needsAnotherRound) {
                    currentPlayerIndex = 0;
                    return processPlayerAction();
                }
                return [players, pots];
            }
        }

        const message = await channel.send({
            content: `${currentPlayer.member.toString()}, it's your turn! You have ฅ${currentPlayer.chips} chips left. The call amount is ฅ${pots[0].ante} and your current bet is ฅ${currentPlayer.bet}. Act quick or you will fold <t:${Math.ceil(Date.now()/1000)+60}:R>.`,
            components: actionRow
        });

        let raiseCollector;

        return new Promise((resolve) => {
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            collector.on('collect', async i => {
                try {
                    if (i.user.id !== currentPlayer.member.id) {
                        await i.reply({ content: "It's not your turn!", ephemeral: true });
                        return;
                    }

                    if (i.customId === 'raise') {
                        await i.deferUpdate();
                        const raisePrompt = await channel.send(`${currentPlayer.member.toString()}, you have ฅ${currentPlayer.chips}. How much would you like to raise by? Act quick or you will fold <t:${Math.ceil(Date.now()/1000)+60}:R>.`);
                        
                        const filter = m => m.author.id === currentPlayer.member.id && !isNaN(m.content) && parseInt(m.content) > 0;
                        raiseCollector = channel.createMessageCollector({
                            filter,
                            time: 60000, // 30 seconds for the collector
                        });

                        // Reset button collector timeout to allow time for message response
                        collector.resetTimer();

                        raiseCollector.on('collect', async (message) => {
                            const raiseAmount = parseInt(message.content);
                            if (raiseAmount > currentPlayer.chips) {
                                await i.followUp("You don't have enough chips for that raise amount.");
                                return;
                            }
                            pots[0].ante += raiseAmount;
                            const difference = pots[0].ante - currentPlayer.bet;
                            currentPlayer.chips -= difference;
                            currentPlayer.bet += difference;
                            currentPlayer.totalBet += difference;
                            pots[0].amount += difference;

                            
                            const shortStackedPlayers = [];
                            for(const player of pots[0].players){
                                if(player.member.id === currentPlayer.member.id || !player.allIn) continue;
                                if(player.totalBet < currentPlayer.bet){
                                    shortStackedPlayers.push(player);
                                }
                            }
                            if(shortStackedPlayers.length > 0){ //make side pots for short stacked players
                                let sidePotMessage = `${currentPlayer.member.toString()} raised to ฅ${currentPlayer.bet}.\n`;
                                for(const shortStackedPlayer of shortStackedPlayers){
                                    //check if matches existing side pot
                                    let sidePotMatch = false;
                                    for(let i = 1; i < pots.length; i++){
                                        if(pots[i].ante === shortStackedPlayer.bet) sidePotMatch = i;
                                        break;
                                    }
                                    if(sidePotMatch){ //add to existing side pot
                                        pots[0].amount -= pots[sidePotMatch].ante;
                                        pots[sidePotMatch].amount += shortStackedPlayer.bet;
                                        pots[sidePotMatch].players.push(shortStackedPlayer); 
                                        pots[0].players = pots[0].players.filter(player => player.member.id !== shortStackedPlayer.member.id); //remove the short stacked player from the main pot
                                        sidePotMessage += `${shortStackedPlayer.member.toString()} is all-in and cannot match the bet so was added to side pot ${sidePotMatch}\n`;
                                    } else { //create a new side pot
                                        pots[0].ante -= shortStackedPlayer.bet; //reduce the ante for the main pot
                                        let sidePotAmount = shortStackedPlayer.bet;
                                        let sidePotPlayers = [shortStackedPlayer];
                                        for(const player of pots[0].players){ //remove all bet from the main pot for all players in the main pot
                                            if(player.member.id === shortStackedPlayer.member.id) continue;  
                                            if(player.bet >= shortStackedPlayer.bet && !player.allIn){
                                                pots[0].amount -= shortStackedPlayer.bet;
                                                player.bet -= shortStackedPlayer.bet;
                                                sidePotAmount += shortStackedPlayer.bet;
                                                sidePotPlayers.push(player);
                                            }
                                        }//make the side pot
                                        pots.push({
                                            amount: sidePotAmount,
                                            ante: shortStackedPlayer.bet,
                                            players: [...sidePotPlayers],
                                        });
                                        pots[0].players = pots[0].players.filter(player => player.member.id !== shortStackedPlayer.member.id); //remove the short stacked player from the main pot
                                        sidePotMessage += `${shortStackedPlayer.member.toString()} is all-in and cannot match the bet so side pot ${pots.length-1} was created.\n`;
                                    }
                                }
                                await channel.send(`${sidePotMessage}**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                            } else {
                                await channel.send(`${currentPlayer.member.toString()} raised to ฅ${currentPlayer.bet}.
**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                            }

                            currentPlayerIndex++;
                            collector.stop();
                        });
                    } else {
                        if (i.customId === 'fold') {
                            await i.deferUpdate();
                            await channel.send(`${currentPlayer.member.toString()} has folded.
**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                            currentPlayer.bet = 0;
                            currentPlayer.folded = true;
                            playersStillIn--;
                        } else if (i.customId === 'call') {
                            const difference = pots[0].ante - currentPlayer.bet;

                            if(currentPlayer.chips <= difference) {
                                await i.reply({
                                    content: `You must go all-in.`,
                                    ephemeral: true
                                });
                                return;
                            } else {
                                currentPlayer.chips -= difference;
                                currentPlayer.bet += difference;
                                currentPlayer.totalBet += difference;
                                pots[0].amount += difference;

                                await i.deferUpdate();
                                await channel.send(`${currentPlayer.member.toString()} has called.
**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                            }
                        } else if (i.customId === 'allin') {
                            await i.deferUpdate();
                            //calculate the bet
                            currentPlayer.bet += currentPlayer.chips;
                            currentPlayer.totalBet += currentPlayer.chips;
                            if(currentPlayer.bet >= pots[0].ante) { //the player can afford the main pot
                                const difference = currentPlayer.bet - pots[0].ante;
                                pots[0].ante += difference;
                                pots[0].amount += currentPlayer.chips;
                                const shortStackedPlayers = [];
                                for(const player of pots[0].players){
                                    if(player.member.id === currentPlayer.member.id || !player.allIn) continue;
                                    if(player.totalBet < currentPlayer.bet){
                                        shortStackedPlayers.push(player);
                                    }
                                }
                                if(shortStackedPlayers.length > 0){ //make side pots for short stacked players
                                    let sidePotMessage = `${currentPlayer.member.toString()} has gone all-in raising their bet to ฅ${currentPlayer.bet}\n`;
                                    for(const shortStackedPlayer of shortStackedPlayers){
                                        //check if matches existing side pot
                                        let sidePotMatch = false;
                                        for(let i = 1; i < pots.length; i++){
                                            if(pots[i].ante === shortStackedPlayer.bet) sidePotMatch = i;
                                            break;
                                        }
                                        if(sidePotMatch){ //add to existing side pot
                                            pots[0].amount -= pots[sidePotMatch].ante;
                                            pots[sidePotMatch].amount += shortStackedPlayer.bet;
                                            pots[sidePotMatch].players.push(shortStackedPlayer); 
                                            pots[0].players = pots[0].players.filter(player => player.member.id !== shortStackedPlayer.member.id); //remove the short stacked player from the main pot
                                            sidePotMessage += `${shortStackedPlayer.member.toString()} is all-in and cannot match the bet so was added to side pot ${sidePotMatch}\n`;
                                        } else { //create a new side pot
                                            pots[0].ante -= shortStackedPlayer.bet; //reduce the ante for the main pot
                                            let sidePotAmount = shortStackedPlayer.bet;
                                            let sidePotPlayers = [shortStackedPlayer];
                                            for(const player of pots[0].players){ //remove all bet from the main pot for all players in the main pot
                                                if(player.member.id === shortStackedPlayer.member.id) continue;  
                                                if(player.bet >= shortStackedPlayer.bet && !player.allIn){
                                                    pots[0].amount -= shortStackedPlayer.bet;
                                                    player.bet -= shortStackedPlayer.bet;
                                                    sidePotAmount += shortStackedPlayer.bet;
                                                    sidePotPlayers.push(player);
                                                }
                                            }//make the side pot
                                            pots.push({
                                                amount: sidePotAmount,
                                                ante: shortStackedPlayer.bet,
                                                players: [...sidePotPlayers],
                                            });
                                            pots[0].players = pots[0].players.filter(player => player.member.id !== shortStackedPlayer.member.id); //remove the short stacked player from the main pot
                                            sidePotMessage += `${shortStackedPlayer.member.toString()} is all-in and cannot match the bet so side pot ${pots.length-1} was created.\n`;
                                        }
                                    }
                                    await channel.send(`${sidePotMessage}**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                                } else {
                                    await channel.send(`${currentPlayer.member.toString()} has gone all-in raising the ante to ฅ${pots[0].ante}!
**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                                }
                            } else { // the player is making a side pot
                                //check if matches existing side pot
                                let sidePotMatch = false;
                                for(let i = 1; i < pots.length; i++){
                                    if(pots[i].ante === currentPlayer.bet) sidePotMatch = i;
                                    break;
                                }
                                if(sidePotMatch){ //add to existing side pot
                                    pots[0].amount -= pots[sidePotMatch].ante;
                                    pots[sidePotMatch].amount += currentPlayer.bet;
                                    pots[0].players = pots[0].players.filter(player => player.member.id !== currentPlayer.member.id); //remove the player from the main pot
                                    pots[sidePotMatch].players.push(currentPlayer);
                                    await channel.send(`${currentPlayer.member.toString()} has gone all-in, joining side pot ${sidePotMatch}!
**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                                } else { //create a new side pot
                                    pots[0].ante -= currentPlayer.bet; //reduce the ante for the main pot
                                    let sidePotAmount = currentPlayer.bet;
                                    let sidePotPlayers = [currentPlayer];
                                    for(const player of pots[0].players){ //remove all bet from the main pot for all players in the main pot
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
                                        ante: currentPlayer.bet,
                                        players: [...sidePotPlayers],
                                    });
                                    await channel.send(`${currentPlayer.member.toString()} has gone all-in, starting side pot ${pots.length-1}!
**Community Cards**:
${communityCardsString(communityCards, stage, emojis)}
Main Pot: ${pots[0].amount}
${pots.length > 1 ? pots.slice(1).map((pot, i) => `Side Pot ${i+1}: ${pot.amount}`).join('\n') : ''}`);
                                }

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

                if(raiseCollector) raiseCollector.stop();

                if (reason === 'time' ) {
                    await channel.send(`${currentPlayer.member.toString()} took too long to respond and has folded.`);
                    currentPlayer.bet = 0;
                    currentPlayer.totalBet = 0;
                    currentPlayer.folded = true;
                    playersStillIn--;
                    currentPlayerIndex++;
                }

                if (currentPlayerIndex < players.length) {
                    processPlayerAction().then(resolve);
                } else {
                    const needsAnotherRound = players.some(player => 
                        !player.folded && !player.allIn && player.bet < pots[0].ante
                    );

                    if (needsAnotherRound) {
                        currentPlayerIndex = 0;
                        processPlayerAction().then(resolve);
                    } else {
                        resolve([players, pots]);
                    }
                }
            });
        });
    };
    return processPlayerAction();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('holdem')
        .setDescription('Start a game of Texas Hold\'em')
        .addIntegerOption(option =>
            option.setName('buy_in')
                .setDescription('Amount of scritch bucks to buy in with')
                .setRequired(true)),
    game: true,
    async execute(interaction, pool, emojis) { 
        const buyIn = interaction.options.getInteger('buy_in');
        const channel = interaction.channel;
        const startTime = Date.now();

        if(buyIn < 5){
            return interaction.reply({
                content: "Buy-in must be at least ฅ5.",
                ephemeral: true
            });
        }
        
        // Get database connection
        const conn = await pool.getConnection();
        
        try {
            // Check if there's already a game in this channel
            const gameDB = await conn.query('SELECT * FROM `game` WHERE `channel_id` = ?;', [channel.id]);
            if(gameDB[0].length > 0) {
                return interaction.reply({
                    content: "There's already a game in progress in this channel.",
                    ephemeral: true
                });
            }

            // Get user's current scritch bucks
            const userDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [interaction.member.id]);
            if(userDB[0].length === 0) {
                return interaction.reply({
                    content: "You don't exist in the database.",
                    ephemeral: true
                });
            }
            if(buyIn > userDB[0][0].scritch_bucks) {
                return interaction.reply({
                    content: "You don't have enough scritch bucks.",
                    ephemeral: true
                });
            }

            // For the actual game message
            const message = await interaction.reply({ 
                content: `${interaction.member.toString()} has started a game of Texas Hold'em with a buy-in of ฅ${buyIn}!
The game will start <t:${Math.ceil(startTime/1000)+62}:R> or when the host starts it.
## Players
${interaction.member.toString()} (host)`,
                components: [createLobbyButtons()],
                fetchReply: true
            });

            // Add game to database
            await conn.query('INSERT INTO `game` (channel_id, game) VALUES (?, "holdem");', [channel.id]);

            // Take buy-in from initiator
            await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', 
                [buyIn, interaction.member.id]);
            
            // Record transaction in user_scritch
            await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                [interaction.member.id, userDB[0][0].scritch_bucks - buyIn, interaction.member.user.username]);

            // Create list of players with their chips
            const players = [{
                member: interaction.member,
                chips: buyIn,
                bet: 0,
                hand: []
            }];

            // Create button collector
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000 
            });

            collector.on('collect', async i => {
                try {
                    if (i.customId === 'join') {
                        // Check if player is already in game
                        if (players.some(p => p.member.id === i.user.id)) {
                            await i.reply({ content: "You're already in the game.", ephemeral: true });
                            return;
                        }

                        // Check if player has enough scritch bucks
                        const joinUserDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [i.user.id]);
                        if(joinUserDB[0].length === 0) {
                            await i.reply({ content: "You don't exist in the database.", ephemeral: true });
                            return;
                        }
                        if(buyIn > joinUserDB[0][0].scritch_bucks) {
                            await i.reply({ content: "You don't have enough scritch bucks.", ephemeral: true });
                            return;
                        }

                        // Take buy-in from player
                        await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', 
                            [buyIn, i.user.id]);
                        
                        // Record transaction in user_scritch
                        await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                            [i.user.id, joinUserDB[0][0].scritch_bucks - buyIn, i.user.username]);

                        // Add player to game
                        players.push({
                            member: i.member,
                            chips: buyIn,
                            bet: 0,
                            hand: []
                        });

                        await i.deferUpdate();
                        await channel.send(`${i.user.toString()} has joined the game with a buy-in of ฅ${buyIn}!`);

                        await message.edit({
                            content: `${interaction.member.toString()} has started a game of Texas Hold'em with a buy-in of ฅ${buyIn}!
The game will start <t:${Math.ceil(startTime/1000)+62}:R> or when the host starts it.
## Players
${players.map(player => `${player.member.toString()}${players[0].member.id === player.member.id ? ' (host)' : ''}`).join('\n')}`,
                            components: [createLobbyButtons()]
                        });
                    } else if (i.customId === 'start' || i.customId === 'cancel') {
                        // Only game host can start/cancel
                        if (i.user.id !== interaction.member.id) {
                            await i.reply({ content: `Only the game host can ${i.customId} the game.`, ephemeral: true });
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
                        content: `${interaction.member.toString()} has started a game of Texas Hold'em with a buy-in of ฅ${buyIn}!
## Players
${players.map(player => `${player.member.toString()}${players[0].member.id === player.member.id ? ' (host)' : ''}`).join('\n')}`,
                        components: [],
                    });

                    return playHoldemRound(players, interaction.member, buyIn, smallBlindAmount, bigBlindAmount, channel, conn, emojis);
                } else if (reason === 'cancelled') {
                    await interaction.editReply({
                        content: `Game cancelled by host. All buy-ins have been refunded.
## Players
${players.map(player => player.member.toString() + ' (refunded)').join('\n')}`,
                        components: []
                    });
                } else {
                    await interaction.editReply({
                        content: `Game cancelled: Not enough players joined within the time limit. All buy-ins have been refunded.
## Players
${players.map(player => player.member.toString() + '(refunded)').join('\n')}`,
                        components: []
                    });
                }

                // Refund all players if not enough players
                for (const player of players) {
                    // Get current scritch_bucks before refund
                    const refundUserDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [player.member.id]);
                    const newAmount = refundUserDB[0][0].scritch_bucks + buyIn;
                    const highestScritchBucks = (newAmount > refundUserDB[0][0].scritch_bucks_highscore) ? newAmount : refundUserDB[0][0].scritch_bucks_highscore;
                    
                    // Update scritch_bucks and record transaction
                    await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                        [newAmount, highestScritchBucks, player.member.id]);
                    await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);',
                        [player.member.id, newAmount, player.member.user.username]);
                }

                // Remove game from database
                await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);
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