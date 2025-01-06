const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCanvas, loadImage, Image } = require('canvas');
const { getEmojiByNumber, getNumberByEmoji } = require("../utils.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('cats')
		.setDescription('Show off a user\'s cats collection!')
        .addUserOption(option => option.setName('user')
            .setDescription('The user to view the cats of.')
		),
	help: `Displays information about available commands.
		
Usage:
\`/cats\` - Lists all of your cats.
\`/cats <user>\` - Shows a user's cats.

The command list is paginated if there are more than six cats. Use the Previous/Next buttons to navigate through pages.`,
	async execute(interaction, pool) {
		const conn = await pool.getConnection();
		try{
			const target = (interaction.options.getMember('user')) ? interaction.options.getMember('user') : interaction.member;
			
			const userCatDB = await conn.query('SELECT * FROM `user_cat` WHERE `user_id` = ? ORDER BY `earned_timestamp`;', [target.id]);

			let canvas, ctx, cat, catImage, attachment, msg, page, length;

			switch(userCatDB[0].length){
				case 0:
					channel.send(`<@${user.id}> doesn't own any cats.`);
				break;

				case 1:
					canvas = createCanvas(180, 180);
					ctx = canvas.getContext('2d');
					ctx.font = '20px sans-serif';
					ctx.fillStyle = '#ffffff';

					cat = userCatDB[0][0];

                    catImage = await loadImage(`images/cats/${cat.cat_name}.jpg`);

					ctx.drawImage(catImage, 26, 35, 128, 128);

					ctx.fillText(cat.cat_name, 26, 26);

					attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `${target.displayName}'s-cats.png`});
					msg = await interaction.reply({ content: `${target.displayName}'s cats:`, files: [attachment] });
				break;

				case 2:
					canvas = createCanvas(360, 180);
					ctx = canvas.getContext('2d');
					ctx.font = '20px sans-serif';
					ctx.fillStyle = '#ffffff';

					for (let i = 0; i < userCatDB[0].length; i++){
						cat = userCatDB[0][i];

						catImage = await loadImage(`images/cats/${cat.cat_name}.jpg`);
	
						ctx.drawImage(catImage, 26+i*180, 35, 128, 128);
	
						ctx.fillText(cat.cat_name, 26+i*180, 26);
					}
	
					attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `${target.displayName}'s-cats.png`});
					msg = await interaction.reply({ content: `${target.displayName}'s cats:`, files: [attachment] });
				break;

				case 3:
					canvas = createCanvas(540, 180);
					ctx = canvas.getContext('2d');
					ctx.font = '20px sans-serif';
					ctx.fillStyle = '#ffffff';

					for (let i = 0; i < userCatDB[0].length; i++){
						cat = userCatDB[0][i];

						catImage = await loadImage(`images/cats/${cat.cat_name}.jpg`);
	
						ctx.drawImage(catImage, 26+i*180, 35, 128, 128);
	
						ctx.fillText(cat.cat_name, 26+i*180, 26);
					}
	
					attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `${target.displayName}'s-cats.png`});
					msg = await interaction.reply({ content: `${target.displayName}'s cats:`, files: [attachment] });
				break;

				case 4:
				case 5:
				case 6:
					canvas = createCanvas(540, 360);
					ctx = canvas.getContext('2d');
					ctx.font = '20px sans-serif';
					ctx.fillStyle = '#ffffff';

					for (let i = 0; i < userCatDB[0].length; i++){
						cat = userCatDB[0][i];

						catImage = await loadImage(`images/cats/${cat.cat_name}.jpg`);
	
						ctx.drawImage(catImage, 26+(i%3)*180, 35+180*Math.floor(i/3), 128, 128);

						ctx.fillText(cat.cat_name, 26+(i%3)*180, 26+180*Math.floor(i/3));
					}
	
					attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `${target.displayName}'s-cats.png`});
					msg = await interaction.reply({ content: `${target.displayName}'s cats:`, files: [attachment] });
				break;

				default:
					const pages = Math.ceil(userCatDB[0].length/6);
					page = 0;

					canvas = createCanvas(540, 360);
					ctx = canvas.getContext('2d');
					ctx.font = '20px sans-serif';
					ctx.fillStyle = '#ffffff';

					for (let i = 0; i < 6; i++){
						cat = userCatDB[0][i];

						catImage = await loadImage(`images/cats/${cat.cat_name}.jpg`);
	
						ctx.drawImage(catImage, 26+(i%3)*180, 35+180*Math.floor(i/3), 128, 128);

						ctx.fillText(cat.cat_name, 26+(i%3)*180, 26+180*Math.floor(i/3));
					}

					const row = new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setCustomId('previous')
								.setLabel('Previous')
								.setStyle(ButtonStyle.Primary)
								.setDisabled(true),
							new ButtonBuilder()
								.setCustomId('next')
								.setLabel('Next')
								.setStyle(ButtonStyle.Primary)
								.setDisabled(pages <= 1)
						);
	
					attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `${target.displayName}'s-cats.png`});
					msg = await interaction.reply({ 
						content: `${target.displayName}'s cats (Page ${page + 1}/${pages}):`,
						files: [attachment],
						components: [row],
						fetchReply: true 
					});
					
					const collector = msg.createMessageComponentCollector();
					
					collector.on('collect', async i => {
						if(i.user.id !== interaction.user.id){
							i.reply({ content: 'You are not the owner of this command.', ephemeral: true });
							return;
						}
						
						if (i.customId === 'previous') {
							page--;
						} else if (i.customId === 'next') {
							page++;
						}

						// Update button states
						row.components[0].setDisabled(page === 0);
						row.components[1].setDisabled(page === pages - 1);
						
						ctx.clearRect(0, 0, canvas.width, canvas.height);
						
						length = (page == pages-1) ? userCatDB[0].length%6 : 6;
						for (let i = 0; i < length; i++){
							cat = userCatDB[0][page*6+i];
	
							catImage = await loadImage(`images/cats/${cat.cat_name}.jpg`);
		
							ctx.drawImage(catImage, 26+(i%3)*180, 35+180*Math.floor(i/3), 128, 128);
	
							ctx.fillText(cat.cat_name, 26+(i%3)*180, 26+180*Math.floor(i/3));
						}
						
						attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `${target.displayName}'s-cats.png`});
						await i.update({ 
							content: `${target.displayName}'s cats (Page ${page + 1}/${pages}):`, 
							files: [attachment],
							components: [row]
						});
					});
				break;
			}
		} finally{
			//release pool connection
			conn.release();
		}
	},
}