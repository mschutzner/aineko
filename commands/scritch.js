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
	cooldown: 180000,
	catId: 1, //aineko
	async execute(interaction, pool) {
		const client = interaction.client;
		
		const rewardIndex = randInt(rewardsTable.length-1);
		const reward = rewardsTable[rewardIndex];

		const conn = await pool.getConnection();
		try{
			await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` + ? WHERE `user_id` = ?;',
				[reward.amt, interaction.user.id]);
			interaction.reply(`${reward.msg}
Aineko gives you ฅ${reward.amt}.`);
		} finally{
			//release pool connection
			conn.release();
		}
	},
}