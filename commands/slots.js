const { SlashCommandBuilder } = require('@discordjs/builders');
const { randInt, sleep } = require('../utils.js');

// Reels
const strip1 = ["*", "C", "C", "C", "7", "7", "7", "W", "W", "W", "B", "B", "B", "O", "O", "O", "G", "G", "G"];
const strip2 = ["*", "*", "C", "C", "7", "7", "7", "W", "W", "W", "B", "B", "B", "O", "O", "O", "G", "G", "G"];
const strip3 = ["*", "*", "7", "7", "7", "W", "W", "W", "W", "B", "B", "B", "O", "O", "O", "O", "G", "G", "G"];
const strip4 = ["*", "*", "7", "7", "7", "7", "W", "W", "W", "B", "B", "B", "B", "O", "O", "O", "G", "G", "G"];

const emojiTable = {
    "*": "⭐", // Wild
    "C": "🍒", // Cherry
    "W": "🍉", // Watermelon
    "7": "7️⃣", // Lucky 7
    "B": "🔔", // Bell
    "O": "🍊",  // Orange
    "G": "🍇"  // Grapes
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('slots')
		.setDescription('Bet ฅ1 to pull the lever on the slot machine.'),
	cooldown: 5000,
	catId: 8, //aineko
	async execute(interaction, pool) {
		const result1 = strip1[randInt(0,18)];
		const result2 = strip2[randInt(0,18)];
		const result3 = strip3[randInt(0,18)];
		const result4 = strip4[randInt(0,18)];

		const member = interaction.member;
		const channel = interaction.channel;

		const conn = await pool.getConnection();
		try{
            const userDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [member.id]);
            if(userDB[0].length === 0) throw("That user does not exist in the database.");
            if(userDB[0][0].scritch_bucks <= 0) return interaction.reply({content: "You don't have enough scritch bucks.", ephemeral: true});

			await interaction.reply(`<@${member.id}> pulled the lever on the slot machine!`);

			await sleep(1500);

			let reward = -1;
			let jackpot = false;

			if(result1 === "*"){
				if(result2 === "*"){
					if(result3 === "*"){
						if(result4 === "*"){
							reward += 200;
							jackpot = true;
						} else {
							reward += 20;
						}
					} else if(result3 === "7"){
						if(result4 === "*" || result4 === "7"){
							reward += 20;
						} else {
							reward += 15;
						}
					} else if(result3 === result4){
						reward += 20;
					} else {
						reward += 10;
					}
				} else if(result3 === "*" || result3 === result2){
					if(result4 === "*" || result4 === result2){
						reward += 20;
					} else {
						reward += 10;
					}
				}
			} else if(result1 === "C"){
				if(result2 === "*" || result2 === "C"){
					reward += 5;
				} else {	
					reward += 2;
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
			} else if(result2 === "*" || result2 === result1){
				if(result3 === "*" || result3 === result1){
					if(result4 === "*" || result4 === result1){
						reward += 20;
					} else {
						reward += 10;
					}
				}
			}

			const newScritchBucks = userDB[0][0].scritch_bucks + reward;
			const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;

			await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
				[newScritchBucks, highestScritchBucks, member.id]);
			conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
				[member.id, newScritchBucks, member.user.username]);


			await channel.send(`${emojiTable[result1]}${emojiTable[result2]}${emojiTable[result3]}${emojiTable[result4]}`);

			if(reward > 0){
				await channel.send(`<@${member.id}> won ฅ${reward + 1}!`);
			} else {
				await channel.send(`<@${member.id}> lost ฅ1.`);
			}

			if(jackpot){
				const userCatDB = await conn.query(
					'INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
					[member.id, 7, member.displayName, 'Lucky']
				);
				if(userCatDB[0].affectedRows){
					channel.send({content: `<@${member.id}> just gained ownership of Lucky by getting the jackpot!`, files: ['images/cats/Lucky.jpg']});
				}
			}
		} finally{
			//release pool connection
			conn.release();
		}
	},
}