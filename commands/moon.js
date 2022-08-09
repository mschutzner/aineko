const { SlashCommandBuilder } = require('@discordjs/builders');

function normalize(value){
	value = value - Math.floor(value);
	if (value < 0) value = value + 1;
	return value;
}		

module.exports = {
	data: new SlashCommandBuilder()
		.setName('moon')
		.setDescription('Tells the phase of the moon on the current or supplied date.')
		.addIntegerOption(option =>
			option.setName('month')
				.setDescription("The month.")
				.setRequired(false))
		.addIntegerOption(option =>
			option.setName('day')
				.setDescription("The day.")
				.setRequired(false))
		.addIntegerOption(option =>
			option.setName('year')
				.setDescription("The year. Responses with two digits default to 1900 to 1999.")
				.setRequired(false)),
	catId: 5, //Luna
	async execute(interaction, pool) {
		const month = interaction.options.getInteger('month');
		const day = interaction.options.getInteger('day');
		const year = interaction.options.getInteger('year');
		
		if((month || day || year) && (!month || !day || !year))
			return interaction.reply({content: 'Please include complete date.', ephemeral: true});
		
		const curDate = new Date();
		const date = (month) ? new Date(year, month-1, day) : curDate;

		const lunarMonth = 29.530588853;
		const time = date.getTime();
		const tzoffset = date.getTimezoneOffset();
		const julianDate = (time / 86400000) - (tzoffset / 1440) + 2440587.5;
		const percent = normalize((julianDate - 2451550.1) / lunarMonth);
		const age = percent * lunarMonth;

		if(date == curDate){
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
		} else if(date  < curDate){
			if (age < 1.84566)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} it was be a new moon.🌑`);
			else if (age < 5.53699)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon was a waxing crescent.🌒`);
			else if (age < 9.22831)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon was in it's first quarter.🌓`);
			else if (age < 12.91963)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon was a waxing gibbous.🌔`);
			else if (age < 16.61096)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} it was a full moon.🌕`);
			else if (age < 20.30228)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon was a waning gibbous.🌖`);
			else if (age < 23.99361)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon was in it's last quarter.🌗`);
			else if (age < 27.68493)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon was a waning crescent.🌘`);
				
			return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear} the moon was a new moon.🌑`);
		} else {
			if (age < 1.84566)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} it will be a new moon.🌑`);
			else if (age < 5.53699)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon will be a waxing crescent.🌒`);
			else if (age < 9.22831)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon will be in it's first quarter.🌓`);
			else if (age < 12.91963)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon will be a waxing gibbous.🌔`);
			else if (age < 16.61096)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} it will be a full moon.🌕`);
			else if (age < 20.30228)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon will be a waning gibbous.🌖`);
			else if (age < 23.99361)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon will be in it's last quarter.🌗`);
			else if (age < 27.68493)
				return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon will be a waning crescent.🌘`);
				
			return interaction.reply(`On ${date.toLocaleString("en-us", { month: "long" })} ${date.getDate()}, ${date.getFullYear()} the moon will be a new moon.🌑`);
		}


	},
}