const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lovebomb')
		.setDescription('Everyone who has been recently active gets 100 scritch bucks!'),
	cooldown: 43200000,
	catId: 7, //Lucky
	async execute(interaction, pool) {
		const member = interaction.member;

		let memberList = `<@${interaction.member.id}>`;
		let allText = '';
		let eachText = '';

		const guild = interaction.guild;
		const channel = interaction.channel;

		const conn = await pool.getConnection();
		try{
			const member = interaction.member;
			
			await conn.query('UPDATE `member` SET `active` = 1 WHERE `guild_id` = ? AND `user_id` = ?;', [guild.id, member.id]);

			const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?', [member.id]);
			const newScritchBucks = userDB[0][0].scritch_bucks + 100;
			const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
			await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
				[newScritchBucks, highestScritchBucks, member.id]);
			conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
				[member.id, newScritchBucks, member.user.username]);

			const memberDB = await conn.query('SELECT * FROM `member` WHERE `guild_id` = ? AND (`active` = 1 OR `prev_active` = 1);', [guild.id]);

			for await (const mem of memberDB[0]){
				if(mem.user_id == member.id) continue;

				allText = 'all ';
				let eachText = ' each';

				memberList += `, <@${mem.user_id}>`

				const userDB2 = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [mem.user_id]);
				const newScritchBucks2 = userDB2[0][0].scritch_bucks + 100;
				const highestScritchBucks2 = (newScritchBucks2 > userDB2[0][0].scritch_bucks_highscore) ? newScritchBucks2 : userDB2[0][0].scritch_bucks_highscore;
				await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
					[newScritchBucks2, highestScritchBucks2, mem.user_id]);
				conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
					[mem.user_id, newScritchBucks2, mem.name]);
			}

			await interaction.reply(`${memberList} ${allText}got 100 scritch bucks${ eachText}!`);
		} finally{
			//release pool connection
			conn.release();
		}
	},
}