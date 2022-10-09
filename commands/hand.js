const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('hand')
		.setDescription('Displays your current hand of Digica cards.'),
	async execute(interaction, pool) {
		const member = interaction.member;

		const conn = await pool.getConnection();
		try{
			const userHandDB = await conn.query('SELECT * FROM `user_hand` WHERE `user_id` = ?;', [member.id]);
			const userDiscardDB = await conn.query('SELECT * FROM `user_deck` WHERE `user_id` = ?;', [member.id]);
			const userDeckDB = await conn.query('SELECT * FROM `user_discard` WHERE `user_id` = ?;', [member.id]);

			if( userHandDB[0].length == 0 && userDiscardDB[0].length == 0 && userDeckDB[0].length == 0 )
				return interaction.reply({ content: `You have no cards.` });
			
			const width = 560;
			const height = 180;

			const canvas = Canvas.createCanvas(width, height);
			const ctx = canvas.getContext('2d');

			if(userHandDB[0].length > 0){
				const cards = [];
				const handLength = (userHandDB[0].length > 5) ? 5 : userHandDB[0].length;
				const leftX = width/2-handLength*74/2+5; 
				for await(let card of userHandDB[0]){
					const cardDB = await conn.query('SELECT * FROM `card` WHERE `_id` = ?;', [card.card_id]);
					if(cardDB[0].length < 0) console.error(`card with id ${card.card_id} not found.`);
					const cardImage = await Canvas.loadImage(`images/digica/cards/${cardDB[0][0].name}.png`);
					cards.push(cardImage);
				}
				for(let i = 0; i < handLength; i++){
					ctx.drawImage(cards[i], leftX+i*74, 40)
				}
			}

			const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: member.displayName + 's-hand.png' });
			await interaction.reply({ files: [attachment] });
		} finally{
			//release pool connection
			conn.release();
		}
	},
}