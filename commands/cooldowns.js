const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cooldowns')
        .setDescription('Shows all your active command cooldowns'),

    async execute(interaction, pool) {
        const conn = await pool.getConnection();
        try {
            // Fetch only active cooldowns for the user
            const cooldowns = await conn.query(
                'SELECT command_name, end_time FROM command_timer WHERE user_id = ? AND end_time > ?',
                [interaction.member.id, Date.now()]
            );

            if (cooldowns[0].length === 0) {
                return await interaction.reply({
                    content: 'You have no active cooldowns!',
                    ephemeral: true
                });
            }

            // Create a formatted message of all cooldowns
            const cooldownList = cooldowns[0].map(cd => 
                `\`/${cd.command_name}\`: <t:${Math.floor(cd.end_time / 1000)}:R>`
            );

            await interaction.reply({
                content: `## Your active cooldowns:\n${cooldownList.join('\n')}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error executing cooldown command:', error);
            await interaction.reply({
                content: 'An error occurred while fetching your cooldowns.',
                ephemeral: true
            });
        }
    }
};
