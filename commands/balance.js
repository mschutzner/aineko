const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('balance')
		.setDescription('Check your scritch bucks balance.'),
	async execute(interaction, pool) {
		const conn = await pool.getConnection();
		try{
			const membersDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;',
				[interaction.member.id]);
			interaction.reply(`You have ฅ${membersDB[0][0].scritch_bucks}.`);
		} finally{
			//release pool connection
			conn.release();
		}
	},
}