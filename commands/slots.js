const { SlashCommandBuilder } = require('@discordjs/builders');
const { randInt, sleep } = require('../utils.js');

// Reels
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

module.exports = {
	data: new SlashCommandBuilder()
		.setName('slots')
		.setDescription('Bet ฅ1 to pull the lever on the slot machine.')
		.addSubcommand(subcommand =>
			subcommand
				.setName('play')
				.setDescription('Pull the lever.'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('rules')
				.setDescription('Display the rules of the rewards.')),
	cooldown: 4000,
	catId: 8, //aineko
	async execute(interaction, pool) {
		if(interaction.options.getSubcommand() === "rules"){
			return interaction.reply(`Results must be from left to right.
Stars are wild.
⭐⭐⭐⭐ 200
⭐⭐⭐ 100
🍉🍉🍉🍉 50
🍉🍉🍉 10
7️⃣7️⃣7️⃣7️⃣ 20
7️⃣7️⃣7️⃣ 15
🔔🔔🔔🔔 20
🔔🔔🔔 10
🍇🍇🍇🍇 20
🍇🍇🍇 10
🍊🍊🍊🍊 20
🍊🍊🍊 10
🍋🍋🍋🍋 20
🍋🍋🍋 10
🍒🍒 5
🍒 1`)
		}
		const result1 = strip1[randInt(0,strip1.length-1)];
		const result2 = strip2[randInt(0,strip2.length-1)];
		const result3 = strip3[randInt(0,strip3.length-1)];
		const result4 = strip4[randInt(0,strip4.length-1)];

		const member = interaction.member;
		const channel = interaction.channel;

		const conn = await pool.getConnection();
		try{
            const userDB = await conn.query('SELECT `scritch_bucks`, `scritch_bucks_highscore` FROM `user` WHERE `user_id` = ?;', [member.id]);
            if(userDB[0].length === 0) throw("That user does not exist in the database.");
            if(userDB[0][0].scritch_bucks <= 0) return interaction.reply({content: "You don't have enough scritch bucks.", ephemeral: true});

			await interaction.reply(`<@${member.id}> put a scritch buck in the slot machine and pulled the lever!`);

			await sleep(2000);

			let reward = -1;
			let jackpot = false;
			let jackpot2 = false;

			if(result1 === "*"){
				if(result2 === "*"){
					if(result3 === "*"){
						if(result4 === "*"){
							reward += 200;
							jackpot = true;
						} else if(result4 === "W"){
							reward += 50;
						} else {
							reward += 100;
							jackpot2 = true;
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

			const newScritchBucks = userDB[0][0].scritch_bucks + reward;
			const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;

			await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
				[newScritchBucks, highestScritchBucks, member.id]);
			conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
				[member.id, newScritchBucks, member.user.username]);


			await channel.send(`${emojiTable[result1]}${emojiTable[result2]}${emojiTable[result3]}${emojiTable[result4]}`);

			if(jackpot){
				await channel.send(`<@${member.id}> hit the jackpot and won ฅ200!`);
				const userCatDB = await conn.query(
					'INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
					[member.id, 7, member.displayName, 'Lucky']
				);
				if(userCatDB[0].affectedRows){
					channel.send({content: `<@${member.id}> just gained ownership of Lucky by getting a jackpot!`, files: ['images/cats/Lucky.jpg']});
				}
			} else if(jackpot2){
				await channel.send(`<@${member.id}> hit the second jackpot and won ฅ100!`);
				const userCatDB = await conn.query(
					'INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
					[member.id, 7, member.displayName, 'Lucky']
				);
				if(userCatDB[0].affectedRows){
					channel.send({content: `<@${member.id}> just gained ownership of Lucky by getting a jackpot!`, files: ['images/cats/Lucky.jpg']});
				}
			} else if(reward > 0){
				await channel.send(`<@${member.id}> won ฅ${reward + 1}!`);
			} else if(reward === 0){
				await channel.send(`<@${member.id}> broke even.`);
			} else {
				await channel.send(`<@${member.id}> didn't win anything.`);
			}
		} finally{
			//release pool connection
			conn.release();
		}
	},
}