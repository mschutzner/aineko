const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('give')
		.setDescription('Give scritch bucks to another user.')
        .addUserOption(option => option.setName('user')
            .setDescription('The user to be painted.')
			.setRequired(true))
		.addStringOption(option =>
			option.setName('amount')
				.setDescription('The amount of scritch bucks to be given.')
				.setRequired(true)),
	async execute(interaction, pool) {
		const member = interaction.member;
		const amt = interaction.options.getString('amount');
		const target = interaction.options.getMember('user');
		if(target.id == interaction.client.user.id) return interaction.reply("You can't give Aineko scritch bucks.");
		const conn = await pool.getConnection();
		try{
			const userDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;',
				[member.id]);
			if(userDB[0][0].scritch_bucks < amt) return interaction.reply("You don't have enough scritch bucks.");
			await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;',
				[amt, member.id]);
			await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` + ? WHERE `user_id` = ?;',
				[amt, target.id]);
			interaction.reply(`You give ฅ${amt} to ${target}.`);
		} finally{
			//release pool connection
			conn.release();
		}
	},
}