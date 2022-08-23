const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('active')
		.setDescription('Show who is currently active.'),
	async execute(interaction, pool) {
		const guild = interaction.guild;

		let memberList = `<@${interaction.member.id}>`;
		let allText = 'is';

		const conn = await pool.getConnection();
		try{
			const memberDB = await conn.query('SELECT * FROM `member` WHERE `guild_id` = ? AND (`active` = 1 OR `prev_active` = 1);', [guild.id]);

			for await (const member of memberDB[0]){
				if(member.user_id == interaction.member.id) continue;
				
				let allText = 'are';

				memberList += `, <@${member.user_id}>`
			}

			await interaction.reply(`${memberList} ${allText} active!`);
		} finally{
			//release pool connection
			conn.release();
		}
	},
}