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
				.setMaxValue(14))
		.addIntegerOption(option =>
			option.setName('month')
				.setDescription("The month (defaults to current month)."))
		.addIntegerOption(option =>
			option.setName('day')
				.setDescription("The day (defaults to current day)."))
		.addIntegerOption(option =>
			option.setName('year')
				.setDescription("The full year (defaults to current year)."))
		.addIntegerOption(option =>
			option.setName('hours')
				.setDescription("The hours in 24-hour format (defaults to current hour)."))
		.addIntegerOption(option =>
			option.setName('minutes')
				.setDescription("The minutes (defaults to current minute)."))
		.addIntegerOption(option =>
			option.setName('seconds')
				.setDescription("The seconds (defaults to current second).")),
	async execute(interaction) {
		const now = new Date();
		const timezoneOffset = interaction.options.getInteger('timezone') ?? -(now.getTimezoneOffset() / 60);
		const month = interaction.options.getInteger('month') ?? (now.getMonth() + 1);
		const day = interaction.options.getInteger('day') ?? now.getDate();
		const year = interaction.options.getInteger('year') ?? now.getFullYear();
		const hours = interaction.options.getInteger('hours') ?? now.getHours();
		const minutes = interaction.options.getInteger('minutes') ?? now.getMinutes();
		const seconds = interaction.options.getInteger('seconds') ?? now.getSeconds();

		try {
			const date = new Date(year, month - 1, day, hours - timezoneOffset, minutes, seconds);
			const timestamp = Math.floor(date.getTime() / 1000).toString();
			await interaction.reply(`Timestamp for <t:${timestamp}:F>: ${timestamp}`);
		} catch (error) {
			await interaction.reply({ content: 'Invalid date provided.', ephemeral: true });
		}
	},
}