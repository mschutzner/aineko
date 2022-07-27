const { SlashCommandBuilder } = require('@discordjs/builders');
const { randInt } = require('../utils.js');
const Moon = require('lunarphase-js');

function normalize(value){
	value = value - Math.floor(value);
	if (value < 0) value = value + 1;
	return value;
}		

module.exports = {
	data: new SlashCommandBuilder()
		.setName('moon')
		.setDescription('Tells the current phase of the moon.'),
	catId: 5, //Luna
	async execute(interaction, pool) {
		const lunarMonth = 29.530588853;
		const date = new Date();
		const time = date.getTime();
		const tzoffset = date.getTimezoneOffset();
		const julianDate = (time / 86400000) - (tzoffset / 1440) + 2440587.5;
		const percent = normalize((julianDate - 2451550.1) / lunarMonth);
		const age = percent * lunarMonth;

		if (age < 1.84566)
			return interaction.reply("It is currently a new moon.🌑");
		else if (age < 5.53699)
			return interaction.reply("The moon is currently a waxing crescent.🌒");
		else if (age < 9.22831)
			return interaction.reply("The moon is currently in it's first quarter.🌓");
		else if (age < 12.91963)
			return interaction.reply("The moon is currently a waxing gibbous.🌔");
		else if (age < 16.61096)
			return interaction.reply("It is currently a full moon.🌕");
		else if (age < 20.30228)
			return interaction.reply("The moon is currently a waning gibbous.🌖");
		else if (age < 23.99361)
			return interaction.reply("The moon is currently in it's last quarter.🌗");
		else if (age < 27.68493)
			return interaction.reply("The moon is currently a waning crescent.🌘");

		return interaction.reply("It is currently a new moon.🌑");
	},
}