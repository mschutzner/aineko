const { SlashCommandBuilder } = require('@discordjs/builders');

function normalize(value){
	value = value - Math.floor(value);
	if (value < 0) value = value + 1;
	return value;
}		

module.exports = {
	data: new SlashCommandBuilder()
		.setName('timestamp')
		.setDescription('Converts a date to a Unix timestamp which is seconds since the Unix epoch (January 1, 1970).')
		.addIntegerOption(option =>
			option.setName('timezone')
				.setDescription("The UTC offset in hours (e.g., 0 for UTC or -5 for EST )")
				.setMinValue(-12)
				.setMaxValue(14)
				.setRequired(true))
		.addIntegerOption(option =>
			option.setName('month')
				.setDescription("The month.")
				.setRequired(true))
		.addIntegerOption(option =>
			option.setName('day')
				.setDescription("The day.")
				.setRequired(true))
		.addIntegerOption(option =>
			option.setName('year')
				.setDescription("The full year.")
				.setRequired(true))
		.addIntegerOption(option =>
			option.setName('hours')
				.setDescription("The hours (24-hour format).")
				.setRequired(false))
		.addIntegerOption(option =>
			option.setName('minutes')
				.setDescription("The minutes.")
				.setRequired(false))
		.addIntegerOption(option =>
			option.setName('seconds')
				.setDescription("The seconds.")
				.setRequired(false)),
	async execute(interaction) {
		const month = interaction.options.getInteger('month');
		const day = interaction.options.getInteger('day');
		const year = interaction.options.getInteger('year');
		const timezoneOffset = interaction.options.getInteger('timezone');
		const hours = interaction.options.getInteger('hours') || 0;
		const minutes = interaction.options.getInteger('minutes') || 0;
		const seconds = interaction.options.getInteger('seconds') || 0;

		try {
			const date = new Date(year, month - 1, day, hours - timezoneOffset, minutes, seconds);
			const timestamp = Math.floor(date.getTime() / 1000).toString();
			await interaction.reply(`Timestamp for <t:${timestamp}:F>: ${timestamp}`);
		} catch (error) {
			await interaction.reply({ content: 'Invalid date provided.', ephemeral: true });
		}
	},
}