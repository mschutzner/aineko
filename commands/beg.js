const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('beg')
		.setDescription('Beg for treats.'),
	cooldown: 3600000,
	catId: 4, //Murphy
	async execute(interaction, pool) {
		const client = interaction.client;

		const conn = await pool.getConnection();
		try{
			await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` + 32 WHERE `user_id` = ?;',
				[interaction.user.id]);
			interaction.reply("You're a good boy! You get ฅ32.");
		} finally{
			//release pool connection
			conn.release();
		}
	},
}