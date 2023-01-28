const { SlashCommandBuilder } = require('@discordjs/builders')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Replies with the invite link.'),
	async execute(interaction, pool) {
		const conn = await pool.getConnection();
		try{
			const guildDB = await conn.query('SELECT `invite` FROM `guild` WHERE `guild_id` = ?;',
				[interaction.guild.id]);
			interaction.reply(`${guildDB[0][0].invite}`);
		} finally{
			//release pool connection
			conn.release();
		}
	},
}