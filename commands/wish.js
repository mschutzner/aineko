const { SlashCommandBuilder } = require('discord.js');
const { OpenAI } = require('openai');

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wish')
        .setDescription('See how your D&D wish spell might go terribly wrong')
        .addStringOption(option =>
            option.setName('wish')
                .setDescription('What do you wish for?')
                .setRequired(true)),
    catId: 10, //Djinn
    async execute(interaction) {
        await interaction.deferReply();

        const wishText = interaction.options.getString('wish');

        const prompt = `As a mischievous D&D 5e Dungeon Master, interpret the following wish spell in the most monkey's paw way possible, explaining how it backfires while technically fulfilling the wish. The wish is: "${wishText}"

Keep the response under 1000 characters and make it both humorous and technically within D&D 5e rules when possible.`;

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a clever and slightly evil Dungeon Master who loves to find creative ways to twist wish spells while staying within D&D 5e rules and lore. Keep the responses appropriate for all ages."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 250,
            });

            const result = response.choices[0].message.content.replace(/['"]/g, '');

            await interaction.editReply({
                content: `## Original Wish:
${wishText}
## The Monkey's Paw Curls...
${result}`,
                ephemeral: false
            });
        } catch (error) {
            console.error('Error with wish command:', error);
            await interaction.editReply({
                content: 'The wish spell fizzles... (There was an error processing your wish)',
                ephemeral: true
            });
        }
    },
};
