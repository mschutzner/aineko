const { SlashCommandBuilder } = require('@discordjs/builders');
const { randInt } = require('../utils.js');

const rewardsTable = [
	{ msg: 'purr-rrr', amt: 1},
	{ msg: 'Good human.', amt: 1},
	{ msg: 'Thank you.', amt: 1},
	{ msg: 'UwU', amt: 1},
	{ msg: 'mmmhm ty', amt: 2},
	{ msg: 'ฅ^•ﻌ•^ฅ', amt: 4},
	{ msg: 'Such good. Very wow.', amt: 8},
	{ msg: "mmhmm. I'm feeling generous.", amt: 32},
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('scritch')
		.setDescription('Give Aineko a good scritch and maybe get something in return.'),
	cooldown: 30000,
	async execute(interaction, pool) {
		const rewardIndex = randInt(rewardsTable.length-1);
		const reward = rewardsTable[rewardIndex];

		const member = interaction.member;
		const channel = interaction.channel;

		const conn = await pool.getConnection();
		try{
			const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [member.id]);
			const newScritchBucks = userDB[0][0].scritch_bucks + reward.amt;
			const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
			const numScritches = userDB[0][0].scritches + 1;
			await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritches` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
				[newScritchBucks, numScritches, highestScritchBucks, member.id]);
			conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
				[member.id, newScritchBucks, member.user.username]);
				
			await interaction.reply(`${reward.msg}
Aineko gives you ฅ${reward.amt}.`);

			//give Chubby on 10th scritch.
			if(userDB[0][0].scritches == 10){
				const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
					[member.id, 6, member.displayName, 'Chubby']);
				if(userCatDB[0].affectedRows){
					channel.send({content: `<@${member.id}> just gained ownership of Chubby by giving their 10th /scritch! This unlocks the \`/munchies\` command.`, files: ['images/cats/Chubby.jpg']});
				}
			}
		} finally{
			//release pool connection
			conn.release();
		}
	},
}