const { SlashCommandBuilder } = require('@discordjs/builders');
const { getNumberId, getNumberEmoji, getNumber } = require("../utils.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shop')
		.setDescription('Buy cats.'),
	async execute(interaction, pool) {
		const conn = await pool.getConnection();
		try{
			const member = interaction.member;
			const channel = interaction.channel;
			const catDB = await conn.query('SELECT * FROM `cat` WHERE `price` IS NOT NULL LIMIT 10;');
			if(catDB[0].length < 1) return interaction.reply({ 
				content: "There are no cats currently on sale.",
				ephemeral: true 
			});
			let msg = '';
			for (const index in catDB[0]){
				msg += `${getNumberId(index)} Name: ${catDB[0][index].name}, Cost: ฅ${catDB[0][index].price}, ${catDB[0][index].description} \n\n`;
			}
			const shop = await interaction.reply({ content: `**React with a number below to buy a cat.**\n${msg}`,
				fetchReply: true
			});

			const filter = (reaction, user) => !user.bot;

			const collector = shop.createReactionCollector({filter});
			
			collector.on('collect', async (reaction, user) => {
				reaction.users.remove(member.id);
				
				const index = getNumber(reaction.emoji.name);
				const cat = catDB[0][index];
				const userCatDB = await conn.query('SELECT * FROM `user_cat` WHERE `user_id` = ? AND `cat_id` = ?;', [user.id, cat._id]);
				if(userCatDB[0].length > 0){
					return channel.send(`<@${user.id}> already owns ${cat.name}.`);
				}
				const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [user.id]);
				if(userDB[0][0].scritch_bucks < cat.price){
					return channel.send(`<@${user.id}> does not have enough scritch bucks to buy ${cat.name}.`);
				}
				await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
					[user.id, cat._id, user.username, cat.name]);
				await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', [cat.price, user.id]);
				channel.send({content: `<@${user.id}> has bought ${cat.name} for ฅ${cat.price}.`, files: [`images/cats/${cat.name}.jpg`]});
			});

			for (const index in catDB[0]){
				shop.react(getNumberEmoji(index));
			}
		} finally{
			//release pool connection
			conn.release();
		}
	},
}