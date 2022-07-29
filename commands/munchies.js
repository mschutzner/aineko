const { SlashCommandBuilder } = require('@discordjs/builders');
const { randInt } = require('../utils.js');
const fs = require("fs");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('munchies')
		.setDescription('Replies with pictures of food.'),
	catId: 6, //chubby
	async execute(interaction, pool) {
		const foodImgs = fs.readdirSync("images/food");

		const foodIndex = randInt(foodImgs.length-1);
		const image = foodImgs[foodIndex];

		await interaction.reply({files: [`images/food/${image}`]});
	},
}