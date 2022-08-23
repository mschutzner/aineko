const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lovebomb')
		.setDescription('Everyone who has been recently active gets 100 scritch bucks!'),
	cooldown: 86400000,
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
			await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` + 100 WHERE `user_id` = ?;',
				[interaction.member.id]);

			const memberDB = await conn.query('SELECT * FROM `member` WHERE `guild_id` = ? AND (`active` = 1 OR `prev_active` = 1);', [guild.id]);

			for await (const member of memberDB[0]){
				if(member.user_id == interaction.member.id) continue;
				allText = 'all ';
				let eachText = ' each';

				memberList += `, <@${member.user_id}>`

				await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` + 100 WHERE `user_id` = ?;',
					[member.user_id]);
			}

			await interaction.reply(`${memberList} ${allText}got 100 scritch bucks${ eachText}!`);
		} finally{
			//release pool connection
			conn.release();
		}
	},
}