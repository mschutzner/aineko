const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rank')
		.setDescription('Check the activity rank for yourself or another member.')
        .addUserOption(option => option.setName('user')
            .setDescription('The user to check the rank of.')),
	async execute(interaction, pool) {
        const member = (interaction.options.getMember('user')) ? interaction.options.getMember('user') : interaction.member;
		const conn = await pool.getConnection();
		try{
			const membersDB = await conn.query('SELECT `user_id`, `activity_points` FROM `member` WHERE `guild_id` = ?  ORDER BY `activity_points` DESC;',
				[interaction.guild.id]);
			for(let i = 0; i < membersDB[0].length; i++){
				const activityPoints = Math.floor(membersDB[0][i].activity_points);
				if(membersDB[0][i].user_id == member.id){
					interaction.reply(`${member.displayName} is rank ${i+1} with ${activityPoints} activity points.`);
					return;
				}
			}
			interaction.reply('That user is not a member.');
		} finally{
			//release pool connection
			conn.release();
		}
	},
}