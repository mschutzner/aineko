const { SlashCommandBuilder } = require('@discordjs/builders');
const { getEmojiIdByNumber, getEmojiByNumber, getNumberByEmoji } = require("../utils.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shop')
		.setDescription('Buy cats.'),
	help: 'React with the number emojis to purchase cats for scritch bucks (ฅ). Some cats unlock special commands when purchased.',
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
			for (let i = 0; i < catDB[0].length; i++){
				msg += `${getEmojiIdByNumber(i)} Name: ${catDB[0][i].name}, Cost: ฅ${catDB[0][i].price}, ${catDB[0][i].description}\n`;
			}
			const shop = await interaction.reply({ content: `**React with a number below to buy a cat.**\n${msg}`,
				fetchReply: true
			});

			const filter = (reaction, user) => !user.bot;

			const collector = shop.createReactionCollector({filter});
			
			collector.on('collect', async (reaction, user) => {
				reaction.users.remove(member.id);
				
				const index = getNumberByEmoji(reaction.emoji.name);
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

				const newScritchBucks = userDB[0][0].scritch_bucks - cat.price;
				const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
				await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
					[newScritchBucks, highestScritchBucks, member.id]);
				conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
					[member.id, newScritchBucks, member.user.username]);

				if(cat.command){

					channel.send({content: `<@${user.id}> has bought ${cat.name} for ฅ${cat.price}. This unlocks the \`/${cat.command}\` command.`, files: [`images/cats/${cat.name}.jpg`]});
				} else {
					channel.send({content: `<@${user.id}> has bought ${cat.name} for ฅ${cat.price}.`, files: [`images/cats/${cat.name}.jpg`]});
				}
			});

			for (let i = 0; i < catDB[0].length; i++){
				shop.react(getEmojiByNumber(i));
			}
		} finally{
			//release pool connection
			conn.release();
		}
	},
}