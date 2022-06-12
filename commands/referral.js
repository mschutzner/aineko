const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('referral')
		.setDescription('Mention the user who referred you to the server.')
        .addUserOption(option => option.setName('user')
            .setDescription('The user to be painted.')
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
			if(memberDB[0][0].referred_by) return interaction.reply("You have stated that you were referred by a member.");
			await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` + 200 WHERE `user_id` = ?;',
				[referredBy.id]);
				await conn.query('UPDATE `member` SET `referred_by` = ? WHERE `guild_id` = ? AND `user_id` = ?;',
					[referredBy.id, member.guild.id, member.id]);
			interaction.reply(`Welcome to the server. ${referredBy} get's ฅ200 for referring you!`);
		} finally{
			//release pool connection
			conn.release();
		}
	},
}