const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('referral')
		.setDescription('Mention the user who referred you to the server and you both get ฅ500!')
        .addUserOption(option => option.setName('user')
            .setDescription('The user who refered you.')
			.setRequired(true)),
	async execute(interaction, pool) {
		const member = interaction.member;
		const referredBy = interaction.options.getMember('user');
		if(referredBy.id == member.id) return interaction.reply("You can't be referred by yourself.");
		if(referredBy.id == interaction.client.user.id) return interaction.reply("You can't be referred by Aineko.");
		const conn = await pool.getConnection();
		try{
			const memberDB = await conn.query('SELECT `join_time`, `referred_by` FROM `member` WHERE `guild_id` = ? AND `user_id` = ?;',
				[member.guild.id, member.id]);
			if(memberDB[0].length < 1) return interaction.reply('You must be a member before you can use this command.');
			if(Date.now() - memberDB[0][0].join_time > 259200000) return interaction.reply("You must choose a referrer within 3 days of joining.");
			if(memberDB[0][0].referred_by) return interaction.reply("You have already stated that you were referred by a member.");

			const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [referredBy.id]);
			const newScritchBucks = userDB[0][0].scritch_bucks + 500;
			const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
			await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
				[newScritchBucks, highestScritchBucks, referredBy.id]);
			conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
				[referredBy.id, newScritchBucks, referredBy.user.username]);

			const userDB2 = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [member.id]);
			const newScritchBucks2 = userDB2[0][0].scritch_bucks + 500;
			const highestScritchBucks2 = (newScritchBucks2 > userDB2[0][0].scritch_bucks_highscore) ? newScritchBucks2 : userDB2[0][0].scritch_bucks_highscore;
			await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
				[newScritchBucks2, highestScritchBucks2, member.id]);
			conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
				[member.id, newScritchBucks2, member.user.username]);
				
			await conn.query('UPDATE `member` SET `referred_by` = ? WHERE `guild_id` = ? AND `user_id` = ?;',
				[referredBy.id, member.guild.id, member.id]);

			interaction.reply(`Welcome to the server. You and ${referredBy} got ฅ500!`);
		} finally{
			//release pool connection
			conn.release();
		}
	},
}