const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('beg')
		.setDescription('Beg for treats.'),
	cooldown: 3600000,
	catId: 4, //Murphy
	async execute(interaction, pool) {
		const member = interaction.member;

		const conn = await pool.getConnection();
		try{
			const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [member.id]);
			const newScritchBucks = userDB[0][0].scritch_bucks + 32;
			const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
			await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
				[newScritchBucks, highestScritchBucks, member.id]);
			conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
				[member.id, newScritchBucks, member.user.username]);
				
			interaction.reply("You're a good human! You get ฅ32.");
		} finally{
			//release pool connection
			conn.release();
		}
	},
}