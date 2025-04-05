const { SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poster')
        .setDescription('Get a movie poster from OMDB')
        .addStringOption(option =>
            option.setName('movie')
                .setDescription('The name of the movie to search for')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('year')
                .setDescription('The year the movie was released')
                .setRequired(false)),
    catId: 14, // Kane
    async execute(interaction) {
        const movieTitle = interaction.options.getString('movie');
        const year = interaction.options.getInteger('year');
        const API_KEY = process.env.OMDB_API_KEY;

        try {
            const url = `http://www.omdbapi.com/?apikey=${API_KEY}&s=${encodeURIComponent(movieTitle)}${year ? `&y=${year}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.Error) {
                return interaction.reply({
                    content: `Error: ${data.Error}`,
                    ephemeral: true
                });
            }

            if (!data.Search?.[0]?.Poster || data.Search[0].Poster === 'N/A') {
                return interaction.reply({
                    content: 'No poster found for this movie.',
                    ephemeral: true
                });
            }

            const posterUrl = data.Search[0].Poster;
            const posterResponse = await fetch(posterUrl);
            const posterBuffer = Buffer.from(await posterResponse.arrayBuffer());

            await interaction.reply({
                content: `Poster for "${data.Search[0].Title}" (${data.Search[0].Year})`,
                files: [posterBuffer]
            });

        } catch (error) {
            console.error('OMDB API Error:', error);
            await interaction.reply({
                content: 'An error occurred while fetching the movie poster.',
                ephemeral: true
            });
        }
    },
};
