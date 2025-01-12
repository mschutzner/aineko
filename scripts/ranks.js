const { sleep, shuffle } = require("../utils.js");

const emojiIds = {
    red_ace: '1322741793284165734',
    black_ace: '1322741769640607814',
    red_2: '1322742250450456668',
    black_2: '1322741760266469508',
    red_3: '1322741779598016582',
    black_3: '1322741761399062640',
    red_4: '1322742251595763858',
    black_4: '1322741762678325288',
    red_5: '1322741783859429406',
    black_5: '1322741763860861009',
    red_6: '1322742252749193298',
    black_6: '1322741765265952861',
    red_7: '1322741787118276720',
    black_7: '1322741766264324179',
    red_8: '1322742253969473648',
    black_8: '1322741758022516736',
    red_9: '1322741790788554863',
    black_9: '1322742246566527160',
    red_10: '1322743479574597642',
    black_10: '1322743478446460939',
    red_jack: '1322742288064974848',
    black_jack: '1322742247699255297',
    red_queen: '1322742258411503649',
    black_queen: '1322742248881786991',
    red_king: '1322741797515952139',
    black_king: '1322741772870488074',
    hearts_suit: '1322741717266464831',
    diamonds_suit: '1322741715832143913',
    clubs_suit: '1322739460776923167',
    spades_suit: '1322741714795888701',
    black_card: '1322745250372128808',
    blank_suit: '1322745251491745843',
};

function getEmoji(suit, value) {
    const values = ['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
    return `${suit === 0 || suit === 1 ? 'red_' : 'black_'}${values[value - 1]}`;
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

function communityCardsString(communityCards, stage) {
    switch(stage){
        case 0: // Pre-flop
            return `<:black_card:1322745250372128808> <:black_card:1322745250372128808> <:black_card:1322745250372128808> <:black_card:1322745250372128808> <:black_card:1322745250372128808>
<:blank_suit:1322745251491745843> <:blank_suit:1322745251491745843> <:blank_suit:1322745251491745843> <:blank_suit:1322745251491745843> <:blank_suit:1322745251491745843>`;
        
        case 1: // Flop (first 3 cards)
            return `${communityCards.slice(0, 3).map(card => {
                const emoji = getEmoji(card[0], card[1]);
                return `<:${emoji}:${emojiIds[emoji]}>`;
            }).join(' ')} <:black_card:1322745250372128808> <:black_card:1322745250372128808>
${communityCards.slice(0, 3).map(card => {
                const suit = ['hearts_suit', 'diamonds_suit', 'clubs_suit', 'spades_suit'][card[0]];
                return `<:${suit}:${emojiIds[suit]}>`;
            }).join(' ')} <:blank_suit:1322745251491745843> <:blank_suit:1322745251491745843>`;
        
        case 2: // Turn (4 cards)
            return `${communityCards.slice(0, 4).map(card => {
                const emoji = getEmoji(card[0], card[1]);
                return `<:${emoji}:${emojiIds[emoji]}>`;
            }).join(' ')} <:black_card:1322745250372128808>
${communityCards.slice(0, 4).map(card => {
                const suit = ['hearts_suit', 'diamonds_suit', 'clubs_suit', 'spades_suit'][card[0]];
                return `<:${suit}:${emojiIds[suit]}>`;
            }).join(' ')} <:blank_suit:1322745251491745843>`;
        
        case 3: // River (all 5 cards)
            return `${communityCards.map(card => {
                const emoji = getEmoji(card[0], card[1]);
                return `<:${emoji}:${emojiIds[emoji]}>`;
            }).join(' ')}
${communityCards.map(card => {
                const suit = ['hearts_suit', 'diamonds_suit', 'clubs_suit', 'spades_suit'][card[0]];
                return `<:${suit}:${emojiIds[suit]}>`;
            }).join(' ')}`;
    }
}

const evaluateHand = (player, communityCards) => {
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
    
    // Replace one of the cards in bestHand with the joker
    const jokerCard = [4, 0];
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
    return {
        winners: finalResults[0],
        finalResults
    };
};

const rankTally = {
    "High Card": 0,
    "One Pair": 0,
    "Two Pair": 0,
    "Three of a Kind": 0,
    "Wheel": 0,
    "Straight": 0,
    "Flush": 0,
    "Full House": 0,
    "Four of a Kind": 0,
    "Steel Wheel": 0,
    "Straight Flush": 0,
    "Royal Flush": 0
};

// for(let i = 0; i < 10000; i++){
//     const deck = shuffleDeck();
//     const communityCards = deck.splice(0, 5);
//     // let communityCards = [[1,7],[0,13],[0,12],[0,11],[0,10]];
//     const players = [];
//     while(deck.length > 1){
//         const hand = deck.splice(0, 2).sort((a, b) => b[1] - a[1]);
//         players.push({hand});
//     }

//     const results = players.map(player => evaluateHand(player, communityCards));
//     const { winners, finalResults } = breakTies(results);
//     // console.log(`Shuffling and dealing! ${communityCards}`);
//     finalResults.reverse();
//     for(const bracket of finalResults){
//         // console.log(bracket[0].bestHand, bracket[0].handName, bracket[0].hand, bracket.length);
//         for(const player of bracket) rankTally[player.handName]++;
//     }
// }
// console.log("ran 10,000 decks", rankTally)

const deck = shuffleDeck();
const communityCards = deck.splice(0, 5);
communityCards[4] = [4,0];
// let communityCards = [[1,7],[0,7],[0,7],[0,1],[1,1]];
const players = [];
while(deck.length > 1){
    const hand = deck.splice(0, 2).sort((a, b) => b[1] - a[1]);
    players.push({hand});
}
players.push({hand: [[1,7],[1,7]]});

const results = players.map(player => evaluateHand(player, communityCards));
const { winners, finalResults } = breakTies(results);
console.log(`Shuffling and dealing! ${communityCards}`);
finalResults.reverse();
for(const bracket of finalResults){
    console.log(bracket[0].bestHand, bracket[0].handName, bracket[0].hand, bracket.length);
};