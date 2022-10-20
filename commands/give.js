const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('give')
		.setDescription('Give scritch bucks to another user.')
        .addUserOption(option => option.setName('user')
            .setDescription('The user to be painted.')
			.setRequired(true))
		.addIntegerOption(option =>
			option.setName('amount')
				.setDescription('The amount of scritch bucks to be given.')
				.setRequired(true)),
	async execute(interaction, pool) {
		const member = interaction.member;
		const target = interaction.options.getMember('user');
		const amt = interaction.options.getInteger('amount');

		if(amt <= 0 ) return interaction.reply({ 
			content: "Amount must be positive.",
			ephemeral: true 
		});
		if(target.id == interaction.client.user.id) return interaction.reply({ 
			content: "You can't give Aineko scritch bucks.",
			ephemeral: true 
		});
		if(target.id == member.id) return interaction.reply({ 
			content: "You can't give yourself scritch bucks.",
			ephemeral: true 
		});

		const conn = await pool.getConnection();
		try{
			
			const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;',
				[member.id]);
			if(userDB[0][0].scritch_bucks < amt) return interaction.reply({content: "You don't have enough scritch bucks.", ephemeral: true});
			
			const newScritchBucks = userDB[0][0].scritch_bucks - amt;
			const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
			await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
				[newScritchBucks, highestScritchBucks, member.id]);
			conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
				[member.id, newScritchBucks, member.user.username]);

			const targetUserDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [target.id]);
			const newTargetScritchBucks = targetUserDB[0][0].scritch_bucks + amt;
			const highestTargetScritchBucks = (newTargetScritchBucks > targetUserDB[0][0].scritch_bucks_highscore) ? newTargetScritchBucks : targetUserDB[0][0].scritch_bucks_highscore;
			await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
				[newTargetScritchBucks, highestTargetScritchBucks, target.id]);
			conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
				[target.id, newTargetScritchBucks, target.user.username]);

			interaction.reply(`You give ฅ${amt} to ${target}.`);
		} finally{
			//release pool connection
			conn.release();
		}
	},
}