function randInt(max, min){
	min = min || 0;
	return min + Math.round(Math.random() * (max - min));
}

function nearestUnitFraction(decimal) {
    if (decimal <= 0) {
        throw new Error("Decimal must be positive");
    }

    const denominator = Math.round(1 / decimal); // Find the closest denominator
    const fraction = 1 / denominator; // Calculate the fraction value

    return `1/${denominator}`;
}


const strip1 = ["*", "*", "*", "W", "W", "7", "7", "B", "B", "B", "G", "G", "G", "O", "O", "O", "L", "L", "L", "C", "C", "C", "C"];
const strip2 = ["*", "*", "*", "W", "W", "7", "7", "B", "B", "B", "G", "G", "G", "O", "O", "O", "L", "L", "L", "C", "C", "C", "C"];
const strip3 = ["*", "*", "*", "*", "W", "7", "B", "B", "B", "B", "G", "G", "G", "G", "O", "O", "O", "O", "O", "L", "L", "L", "L"];
const strip4 = ["*", "*", "*", "*", "W", "7", "B", "B", "B", "B", "G", "G", "G", "G", "O", "O", "O", "O", "L", "L", "L", "L", "L"];

const emojiTable = {
    "*": "⭐", // Wild
    "W": "🍉", // Watermelon
    "7": "7️⃣", // Lucky 7
    "B": "🔔", // Bell
    "G": "🍇",  // Grapes
    "O": "🍊", // Orange
    "L": "🍋", //Lemon
    "C": "🍒", // Cherry
};

let reward = 0;
let jackpots = 0;
let secondJackpots = 0

for(let i = 0; i < 10000000; i++){
    reward --;
    const result1 = strip1[randInt(0,strip1.length-1)];
    const result2 = strip2[randInt(0,strip2.length-1)];
    const result3 = strip3[randInt(0,strip3.length-1)];
    const result4 = strip4[randInt(0,strip4.length-1)];

    if(result1 === "*"){
        if(result2 === "*"){
            if(result3 === "*"){
                if(result4 === "*"){
                    reward += 200;
                    jackpots ++;
                } else if(result4 === "W"){
                    reward += 50;
                } else {
                    reward += 100;
                    secondJackpots ++;
                }
            } else if(result3 === "W"){
                if(result4 === "*" || result4 === "W"){
                    reward += 50;
                } else {
                    reward += 10;
                }
            } else if(result3 === "7"){
                if(result4 === "*" || result4 === "7"){
                    reward += 20;
                } else {
                    reward += 15;
                }
            } else if(result3 === result4 || result4 === "*"){
                reward += 20;
            } else {
                reward += 10;
            }
        } else if (result2 === "W"){
            if(result3 === "*" || result3 === "W"){
                if(result4 === "*" || result4 === "W"){
                    reward += 50;
                } else {
                    reward += 10;
                }
            } else {
                reward += 1;
            }
        } else if(result2 === "7"){
            if(result3 === "*" || result3 === "7"){
                if(result4 === "*" || result4 === "7"){
                    reward += 20;
                } else {
                    reward += 15;
                }
            } else {
                reward += 1;
            }
        } else if(result2 === "C"){
            reward += 5;
        } else if(result3 === "*" || result3 === result2){
            if(result4 === "*" || result4 === result2){
                reward += 20;
            } else {
                reward += 10;
            }
        } else {
            reward += 1;
        }
    } else if(result1 === "W"){
        if (result2 === "*" || result2 === "W"){
            if(result3 === "*" || result3 === "W"){
                if(result4 === "*" || result4 === "W"){
                    reward += 50;
                } else {
                    reward += 10;
                }
            }
        } 
    } else if(result1 === "7"){
        if(result2 === "*" || result2 === "7"){
            if(result3 === "*" || result3 === "7"){
                if(result4 === "*" || result4 === "7"){
                    reward += 20;
                } else {
                    reward += 15;
                }
            }
        }
    } else if(result1 === "C"){
        if(result2 === "*" || result2 === "C"){
            reward += 5;
        } else {	
            reward += 1;
        }
    } else if(result2 === "*" || result2 === result1){
        if(result3 === "*" || result3 === result1){
            if(result4 === "*" || result4 === result1){
                reward += 20;
            } else {
                reward += 10;
            }
        }
    }
}

console.log(`Payout Rate = ${reward/100000}%
Jackpot Rate = ${jackpots/100000}%
Second Jackpot Rate = ${secondJackpots/100000}%
${nearestUnitFraction(jackpots/10000000+secondJackpots/10000000)}`);