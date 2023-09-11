const { SlashCommandBuilder,  PermissionFlagsBits  } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('edit')
		.setDescription('Change a message Aineko has said.')
		.addStringOption(option =>
			option
				.setName('message-id')
				.setDescription('The id of the message to be changed.')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('text')
				.setDescription('The text for Aineko to to change to.')
				.setRequired(true))
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
	async execute(interaction) {
		const msgId = interaction.options.getString('message-id');
		const text = interaction.options.getString('text');
		const msg = await interaction.channel.messages.fetch(msgId);
		if(!msg)  return interaction.reply({ 
			content: "Message not found in this channel.",
			ephemeral: true 
		});

		await msg.edit({content: text});

		interaction.reply({ 
			content: "Message edited.",
			ephemeral: true 
		})
	},
}