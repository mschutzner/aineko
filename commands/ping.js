const { SlashCommandBuilder } = require('@discordjs/builders')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!'),
	catId: 2, //Crispy Aineko
	async execute(interaction) {
		await interaction.reply('Pong!');
	},
}