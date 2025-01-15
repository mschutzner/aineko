const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { OpenAI } = require('openai');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const tarotDeck = [
    // Major Arcana
    { name: "The Fool", file: "the-fool.png" },
    { name: "The Magician", file: "the-magician.png" },
    { name: "The High Priestess", file: "the-high-priestess.png" },
    { name: "The Empress", file: "the-empress.png" },
    { name: "The Emperor", file: "the-emperor.png" },
    { name: "The Hierophant", file: "the-hierophant.png" },
    { name: "The Lovers", file: "the-lovers.png" },
    { name: "The Chariot", file: "the-chariot.png" },
    { name: "Strength", file: "strength.png" },
    { name: "The Hermit", file: "the-hermit.png" },
    { name: "Wheel of Fortune", file: "wheel-of-fortune.png" },
    { name: "Justice", file: "justice.png" },
    { name: "The Hanged Man", file: "the-hanged-man.png" },
    { name: "Death", file: "death.png" },
    { name: "Temperance", file: "temperance.png" },
    { name: "The Devil", file: "the-devil.png" },
    { name: "The Tower", file: "the-tower.png" },
    { name: "The Star", file: "the-star.png" },
    { name: "The Moon", file: "the-moon.png" },
    { name: "The Sun", file: "the-sun.png" },
    { name: "Judgement", file: "judgement.png" },
    { name: "The World", file: "the-world.png" },
    // Wands
    { name: "Ace of Wands", file: "ace-of-wands.png" },
    { name: "Two of Wands", file: "two-of-wands.png" },
    { name: "Three of Wands", file: "three-of-wands.png" },
    { name: "Four of Wands", file: "four-of-wands.png" },
    { name: "Five of Wands", file: "five-of-wands.png" },
    { name: "Six of Wands", file: "six-of-wands.png" },
    { name: "Seven of Wands", file: "seven-of-wands.png" },
    { name: "Eight of Wands", file: "eight-of-wands.png" },
    { name: "Nine of Wands", file: "nine-of-wands.png" },
    { name: "Ten of Wands", file: "ten-of-wands.png" },
    { name: "Page of Wands", file: "page-of-wands.png" },
    { name: "Knight of Wands", file: "knight-of-wands.png" },
    { name: "Queen of Wands", file: "queen-of-wands.png" },
    { name: "King of Wands", file: "king-of-wands.png" },
    // Cups
    { name: "Ace of Cups", file: "ace-of-cups.png" },
    { name: "Two of Cups", file: "two-of-cups.png" },
    { name: "Three of Cups", file: "three-of-cups.png" },
    { name: "Four of Cups", file: "four-of-cups.png" },
    { name: "Five of Cups", file: "five-of-cups.png" },
    { name: "Six of Cups", file: "six-of-cups.png" },
    { name: "Seven of Cups", file: "seven-of-cups.png" },
    { name: "Eight of Cups", file: "eight-of-cups.png" },
    { name: "Nine of Cups", file: "nine-of-cups.png" },
    { name: "Ten of Cups", file: "ten-of-cups.png" },
    { name: "Page of Cups", file: "page-of-cups.png" },
    { name: "Knight of Cups", file: "knight-of-cups.png" },
    { name: "Queen of Cups", file: "queen-of-cups.png" },
    { name: "King of Cups", file: "king-of-cups.png" },
    // Swords
    { name: "Ace of Swords", file: "ace-of-swords.png" },
    { name: "Two of Swords", file: "two-of-swords.png" },
    { name: "Three of Swords", file: "three-of-swords.png" },
    { name: "Four of Swords", file: "four-of-swords.png" },
    { name: "Five of Swords", file: "five-of-swords.png" },
    { name: "Six of Swords", file: "six-of-swords.png" },
    { name: "Seven of Swords", file: "seven-of-swords.png" },
    { name: "Eight of Swords", file: "eight-of-swords.png" },
    { name: "Nine of Swords", file: "nine-of-swords.png" },
    { name: "Ten of Swords", file: "ten-of-swords.png" },
    { name: "Page of Swords", file: "page-of-swords.png" },
    { name: "Knight of Swords", file: "knight-of-swords.png" },
    { name: "Queen of Swords", file: "queen-of-swords.png" },
    { name: "King of Swords", file: "king-of-swords.png" },
    // Pentacles
    { name: "Ace of Pentacles", file: "ace-of-pentacles.png" },
    { name: "Two of Pentacles", file: "two-of-pentacles.png" },
    { name: "Three of Pentacles", file: "three-of-pentacles.png" },
    { name: "Four of Pentacles", file: "four-of-pentacles.png" },
    { name: "Five of Pentacles", file: "five-of-pentacles.png" },
    { name: "Six of Pentacles", file: "six-of-pentacles.png" },
    { name: "Seven of Pentacles", file: "seven-of-pentacles.png" },
    { name: "Eight of Pentacles", file: "eight-of-pentacles.png" },
    { name: "Nine of Pentacles", file: "nine-of-pentacles.png" },
    { name: "Ten of Pentacles", file: "ten-of-pentacles.png" },
    { name: "Page of Pentacles", file: "page-of-pentacles.png" },
    { name: "Knight of Pentacles", file: "knight-of-pentacles.png" },
    { name: "Queen of Pentacles", file: "queen-of-pentacles.png" },
    { name: "King of Pentacles", file: "king-of-pentacles.png" }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tarot')
        .setDescription('Draw three tarot cards for past, present, and future'),
    catId: 12, // Jinx
    cooldown: 57600000, // 16 hours
    async execute(interaction) {
        await interaction.deferReply();

        // Draw three random cards
        const reading = [];
        const usedIndices = new Set();

        for (let i = 0; i < 3; i++) {
            let cardIndex;
            do {
                cardIndex = Math.floor(Math.random() * tarotDeck.length);
            } while (usedIndices.has(cardIndex));
            
            usedIndices.add(cardIndex);
            const isInverted = Math.random() < 0.5;
            reading.push([cardIndex, isInverted]);
        }

        // Create canvas
        const canvas = createCanvas(720, 540);
        const ctx = canvas.getContext('2d');

        try {
            // Load and draw background
            const background = await loadImage('images/tarot/table.jpg');
            ctx.drawImage(background, 0, 0, 720, 540);

            // Load and draw cards
            const cardWidth = 208;
            const cardHeight = 360;
            
            // Calculate positions to evenly space cards
            const padding = (720 - (cardWidth * 3)) / 4; // Space between cards and edges
            const positions = [
                [padding, 90],  // Left card
                [padding * 2 + cardWidth, 90],  // Middle card
                [padding * 3 + cardWidth * 2, 90]  // Right card
            ];
            
            for (let i = 0; i < 3; i++) {
                const [cardIndex, isInverted] = reading[i];
                const card = tarotDeck[cardIndex];
                const img = await loadImage(`images/tarot/cards/${card.file}`);
                
                ctx.save();
                ctx.translate(positions[i][0] + cardWidth/2, positions[i][1] + cardHeight/2);
                if (isInverted) ctx.rotate(Math.PI);
                ctx.drawImage(img, -cardWidth/2, -cardHeight/2, cardWidth, cardHeight);
                ctx.restore();
            }

            // Prepare reading text
            const cards = reading.map(([index, inverted], i) => {
                const position = ['Past', 'Present', 'Future'][i];
                const card = tarotDeck[index];
                return `${position}: ${card.name}${inverted ? ' (Inverted)' : ''}`;
            }).join('\n');

            const prompt = `Interpret this tarot reading:\n${cards}\n\nProvide a mystical interpretation that connects all three cards into a cohesive narrative. Keep it under 500 characters. Make sure your response is appropriate for all ages.`;

            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a mystical tarot reader who provides insightful, thoughtful, and appropriate interpretations of tarot spreads."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 128,
            });

            const interpretation = response.choices[0].message.content;

            // Create attachment
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'tarot-reading.png' });

            // Send response
            await interaction.editReply({
                content: `## Your Tarot Reading\n${cards}\n## Interpretation\n${interpretation}`,
                files: [attachment]
            });

        } catch (error) {
            console.error('Error with tarot command:', error);
            await interaction.editReply({
                content: 'The cards refuse to be read... (There was an error processing your reading)',
                ephemeral: true
            });
        }
    },
};
