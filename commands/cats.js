const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageAttachment } = require('discord.js');
const { createCanvas, loadImage, Image } = require('canvas');
const { getEmojiByNumber, getNumberByEmoji } = require("../utils.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('cats')
		.setDescription('Show off your cats collection!')
        .addUserOption(option => option.setName('user')
            .setDescription('The user to view the cats of.')),
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

					attachment = new MessageAttachment(canvas.toBuffer(), `${target.displayName}s-cats.png`);
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
	
					attachment = new MessageAttachment(canvas.toBuffer(), `${target.displayName}s-cats.png`);
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
	
					attachment = new MessageAttachment(canvas.toBuffer(), `${target.displayName}s-cats.png`);
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
	
					attachment = new MessageAttachment(canvas.toBuffer(), `${target.displayName}s-cats.png`);
					msg = await interaction.reply({ content: `${target.displayName}'s cats:`, files: [attachment] });
				break;

				default:
					const pages = Math.ceil(userCatDB[0].length/6);

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
	
					attachment = new MessageAttachment(canvas.toBuffer(), `${target.displayName}s-cats.png`);
					msg = await interaction.reply({ content: `${target.displayName}'s cats page 0:`,
						files: [attachment],
						fetchReply: true 
					});
;					
					const filter = (reaction, user) => (!user.bot);
					const collector = msg.createReactionCollector({filter});
					
					collector.on('collect', async (reaction, user) => {
						reaction.users.remove(user.id);

						if(user.id != interaction.user.id) return;

						page = getNumberByEmoji(reaction.emoji.name);
						
						ctx.clearRect(0, 0, canvas.width, canvas.height);
						
						length = (page == pages-1) ? userCatDB[0].length%6 : 6;
						for (let i = 0; i < length; i++){
							cat = userCatDB[0][page*6+i];
	
							catImage = await loadImage(`images/cats/${cat.cat_name}.jpg`);
		
							ctx.drawImage(catImage, 26+(i%3)*180, 35+180*Math.floor(i/3), 128, 128);
	
							ctx.fillText(cat.cat_name, 26+(i%3)*180, 26+180*Math.floor(i/3));
						}
						
						attachment = new MessageAttachment(canvas.toBuffer(), `${target.displayName}s-cats.png`);
						msg.edit({ content: `${target.displayName}'s cats page ${page}:`, files: [attachment] });
					});

					for (let i = 0; i < pages; i++){
						msg.react(getEmojiByNumber(i));
					}
				break;
			}

			// const filter = (reaction, user) => (!user.bot && user.id == target.id);
			// const collector = shop.createReactionCollector({filter});
			
			// collector.on('collect', async (reaction, user) => {
			// });

			// shop.react(getNumberReaction(i));
		} finally{
			//release pool connection
			conn.release();
		}
	},
}