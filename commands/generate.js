require('dotenv').config();
const OpenAI = require('openai');
const { AttachmentBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const fetch = require('node-fetch');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('generate')
		.setDescription('Use AI to draw am image based on a text input.')
		.addStringOption(option => option.setName('text')
			.setDescription('Describe the image to be generated.')
			.setRequired(true)),
	
	async execute(interaction, pool) {
		const member = interaction.member;
		const text = interaction.options.getString('text');
		const conn = await pool.getConnection();
		
		try {
			const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [interaction.user.id]);
			
			if(userDB[0][0].scritch_bucks < 100){
				return interaction.reply('You do not have enough scritch bucks to generate an image. It costs 100 per image');
			}

			const confirmButton = new ButtonBuilder()
				.setCustomId('confirm_generate')
				.setLabel('Generate')
				.setStyle(ButtonStyle.Primary);

			const row = new ActionRowBuilder()
				.addComponents(confirmButton);

			const msg = await interaction.reply({ 
				content: `Would you like to spend 100 to generate an image from the text prompt *"${text}"*?`,
				components: [row],
				ephemeral: true
			});

			try {
				const confirmation = await msg.awaitMessageComponent({ 
					filter: i => i.user.id === interaction.user.id,
					time: 30000 
				});

				await confirmation.update({ content: 'Generating image. This could take some time...', components: [] });

				const openai = new OpenAI({
					apiKey: process.env.OPENAI_API_KEY,
				});

				try {
					const response = await openai.images.generate({
						prompt: text,
						n: 1,
						size: "1024x1024",
						model: 'dall-e-3'
					});

					const imageUrl = response.data[0].url;
					const imageResponse = await fetch(imageUrl);
					const imageBuffer = await imageResponse.arrayBuffer();

					const attachment = new AttachmentBuilder(Buffer.from(imageBuffer), { name: 'openai-response.png' });
					await interaction.followUp({content: `<@${member.id}> generated *"${text}"*`, files: [attachment]});

					const newScritchBucks = userDB[0][0].scritch_bucks - 100;
					const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
					await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
						[newScritchBucks, highestScritchBucks, member.id]);
					conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
						[member.id, newScritchBucks, member.user.username]);
					
				} catch (error) {					
					if (error instanceof OpenAI.APIError) {
						const errorMessage = error.message || 'An error occurred while generating the image. Please try again.';
						await interaction.editReply({ content: errorMessage, components: [] });
					} else {
						console.error('OpenAI Generation Error:', error);
						await interaction.editReply({ content: 'An unexpected error occurred while generating the image. Please try again.', components: [] });
					}
				}
			} catch (error) {
				// If no button press received within timeout
				await interaction.editReply({ content: 'Generation request timed out. Please try again.', components: [] });
			}
		} finally {
			//release pool connection
			conn.release();
		}
	}
};