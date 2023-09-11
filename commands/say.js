const { SlashCommandBuilder,  PermissionFlagsBits  } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('say')
		.setDescription('Makes Aienko say something.')
		.addStringOption(option =>
			option
				.setName('text')
				.setDescription('The text for Aineko to say.')
				.setRequired(true))
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
	async execute(interaction) {
		const text = interaction.options.getString('text');
		interaction.deferReply();
		interaction.deleteReply();
		interaction.channel.send(text);
	},
}