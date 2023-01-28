const { SlashCommandBuilder } = require('@discordjs/builders');
const { randInt } = require('../utils.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('highscores')
		.setDescription('See the members with the top 5 highest activity points on the server.'),
	async execute(interaction, pool) {
		const conn = await pool.getConnection();
		try{
			const membersDB = await conn.query('SELECT `user_id`, `activity_points` FROM `member` WHERE `guild_id` = ?  ORDER BY `activity_points` DESC;',
				[interaction.guild.id]);
			const max = (membersDB[0].length > 5) ? 5 : membersDB[0].length;
			let msg = 'ACTIVITY HIGHSCORES\n';
			for(let i = 0; i < max; i++){
				const activityPoints = Math.floor(membersDB[0][i].activity_points);
				const member = await interaction.guild.members.fetch(membersDB[0][i].user_id);
				msg += `${i+1}) ${member.displayName} - ${activityPoints}\n`;
			}
			interaction.reply(msg);
		} finally{
			//release pool connection
			conn.release();
		}
	},
}