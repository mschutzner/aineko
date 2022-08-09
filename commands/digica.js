const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageAttachment } = require('discord.js');
const { sleep, shuffle } = require("../utils.js");
const { createCanvas, loadImage, Image } = require('canvas');
const axios = require('axios');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('digica')
		.setDescription('Starts a game of Digica.'),
    game: true,
	async execute(interaction, pool) {
        const channel = interaction.channel;

        const wager = interaction.options.getInteger('wager');

        const conn = await pool.getConnection();
		try{
            const players = [interaction.member];

            await interaction.reply(`${interaction.member.displayName} has started a game of Digica Reply with join if you'd like to play. The game starts in one minute or when a player replies with "start". ${interaction.member.displayName} can cancel the game by responding with "cancel".`);
    
            const joinFilter = msg => msg.content.match(/^join/i) && !players.some(player => player.id == msg.member.id);
            const joinCollector = channel.createMessageCollector({ filter: joinFilter, time: 60000});
    
            joinCollector.on('collect', async msg => {
                players.push(msg.member);
                if(players.length >= 3) joinCollector.stop();
                channel.send(`${msg.member.displayName} has joined the game with a wager of ฅ${wager}!`);
            });
    
            const startFilter = msg => msg.content.toLowerCase() == "start" && players.some(player => player.id == msg.member.id);
            const startCollector = channel.createMessageCollector({ filter: startFilter, time: 60000, max: 1 });
    
            startCollector.on('collect', async msg => {
                joinCollector.stop();
            });
    
            let gameCanceled = false;
            const cancelFilter = msg => msg.content.toLowerCase() == "cancel" && msg.member.id == players[0].id;
            const cancelCollector = channel.createMessageCollector({ filter: cancelFilter, time: 60000, max: 1 });
    
            cancelCollector.on('collect', async msg => {
                gameCanceled = true;

                joinCollector.stop();
                startCollector.stop();
                
			    await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);

                await channel.send(`Game of Digica canceled!`);
            });

    
            joinCollector.on('end', async collected => {
                if(gameCanceled) return;
                try{

                    sleep(3000);

                    await channel.send(`Game over!`);

                    await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);
                } catch(err){  
			       await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);
                   throw err;
                }
            });
		} finally{
			conn.release();
		}
	},
}