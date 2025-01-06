const { SlashCommandBuilder } = require('@discordjs/builders');
const { randInt } = require('../utils.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('highscores')
		.setDescription('See the members with the top 5 highest activity points on the server.'),
	help: 'Displays the top 5 members with the highest activity points on the server. Activity points are earned by sending messages or using commands. Activity points are distributed for one point for every five minute interval that a user is active. Users start with 4 activity points and activity points decay over time. The more you have the quicker they decay.',
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