const { SlashCommandBuilder } = require('@discordjs/builders');
const { createCanvas, loadImage, Image } = require('canvas');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('hand')
		.setDescription('Displays your current hand of Digica cards.'),
	async execute(interaction, pool) {
		const member = interaction.member;

		const conn = await pool.getConnection();
		try{
			const userDiscardDB = await conn.query('SELECT * FROM `user_deck` WHERE `user_id` = ?;', [member.id]);
			const userHandDB = await conn.query('SELECT * FROM `user_hand` WHERE `user_id` = ?;', [member.id]);
			const userDeckDB = await conn.query('SELECT * FROM `user_discard` WHERE `user_id` = ?;', [member.id]);

			// if(userHandDB[0].length == 0) 
			// 	return interaction.reply(`${member.displayName} doesn't have any cards in their hand`);

			const canvas = createCanvas(720, 270);
			const ctx = canvas.getContext('2d');
		} finally{
			//release pool connection
			conn.release();
		}
	},
}