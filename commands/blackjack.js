const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('blackjack')
		.setDescription('Starts a game of blackjack.'),
	async execute(interaction, pool) {
        await interaction.reply(`${interaction.member.displayName} has started a game of blackjack! Reply with join to join in. The game starts in 30 seconds or when a player replies with "start".`);
        const channel = interaction.channel;

        const players = [interaction.member]

        const filter1 = msg => msg.content.toLowerCase() == "join" && !players.some(player => player.id == msg.member.id)
        const collector1 = channel.createMessageCollector({ filter: filter1, time: 30000, max: 3 });

        collector1.on('collect', msg => {
            channel.send(`${msg.member.displayName} has joined the game!`)
            players.push(msg.member);
        });

        const filter2 = msg => msg.content.toLowerCase() == "start" && players.some(player => player.id == msg.member.id)
        const collector2 = channel.createMessageCollector({ filter: filter2, time: 30000, max: 1 });

        collector2.on('collect', () => {
            collector1.stop();
        });

        collector1.on('end', async collected => {
            for await(const player of players){
                await channel.send(player.displayName);
            }
        });
        //hello
	},
}