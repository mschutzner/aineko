const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('discard')
		.setDescription('Discards a card from your hand and draws another from your deck.')
		.addIntegerOption(option =>
			option.setName('card')
				.setDescription("The index of the card to be discarded.")
				.setRequired(true)),
	async execute(interaction, pool) {
		const member = interaction.member;
		const channel = interaction.channel;

		const conn = await pool.getConnection();
		try{
			const userDiscardDB = await conn.query('SELECT * FROM `user_deck` WHERE `user_id` = ?;', [member.id]);
			const userHandDB = await conn.query('SELECT * FROM `user_hand` WHERE `user_id` = ?;', [member.id]);
			const userDeckDB = await conn.query('SELECT * FROM `user_discard` WHERE `user_id` = ?;', [member.id]);
		} finally{
			//release pool connection
			conn.release();
		}
	},
}