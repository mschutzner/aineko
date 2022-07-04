const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageAttachment } = require('discord.js');
const { sleep, shuffle } = require("../utils.js");
const { createCanvas, loadImage, Image } = require('canvas');
const axios = require('axios');

function addCards(hand){
    let total = 0;
    let aces = 0;

    for(const card of hand){
        if(card[1] == 1) aces++;
    }

    for(const card of hand){
        switch(card[1]){
            case 1:
                total += 11;
            break;
            case 11:
            case 12:
            case 13:
                total += 10;
            break;
            default:
                total += card[1];
            break;
        }
    }
    if(total > 21 && aces){
        for(let i = 0; i < aces; i++){
            total -= 10;
            if(total <= 21) break;
        }
    }
    return total;
}

async function turn(player){
    
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('blackjack')
		.setDescription('Starts a game of blackjack.')
		.addIntegerOption(option =>
			option.setName('wager')
				.setDescription("The amount of scritch bucks you'd like to wager.")
				.setRequired(true)),
    game: true,
	async execute(interaction, pool) {
        const channel = interaction.channel;

        const wager = interaction.options.getInteger('wager');

        const conn = await pool.getConnection();
		try{
            const gameDB = await conn.query('SELECT `game` FROM `game` WHERE `channel_id` = ?;', [channel.id]);
            if(gameDB[0].length) return interaction.reply({ 
                content: `There is already a game of ${gameDB[0][0].game} running in this channel.`,
                ephemeral: true 
            });
            
			await conn.query('INSERT INTO `game` (channel_id, game) VALUES (?, ?);', [channel.id, "blackjack"]);

            const userDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [interaction.member.id]);

            if(wager > userDB[0][0].scritch_bucks) return interaction.reply({content: "You don't have enough scritch bucks.", ephemeral: true});

            const players = [interaction.member]
            players[0].wager = wager;
            await interaction.reply(`${interaction.member.displayName} has started a game of blackjack with a wager of ฅ${wager}! Reply with join followed by the amount of SB you'd like to wager. The game starts in one minute or when a player replies with "start".`);
    
            let deck = [];
            let dealerHand = [];
            for(let i = 0; i < 6; i++){
                for(let j = 0; j < 4; j++){
                    for(let k = 1; k < 14; k++){
                        deck.push([j,k]);
                    }
                }
            }
            deck = shuffle(deck);
    
            const joinFilter = msg => msg.content.match(/^join ฅ?[1-9]+[0-9]*/i) && !players.some(player => player.id == msg.member.id)
            const joinCollector = channel.createMessageCollector({ filter: joinFilter, time: 60000});
    
            joinCollector.on('collect', async msg => {
                const regex = msg.content.match(/^join ฅ?([1-9]+[0-9]*)/i);
                const userDB2 = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [msg.member.id]);
                if(regex[1] > userDB2[0][0].scritch_bucks) return channel.send("You don't have enough scritch bucks.");
                msg.member.wager = regex[1];
                players.push(msg.member);
                if(players.length >= 3) joinCollector.stop();
                channel.send(`${msg.member.displayName} has joined the game with a wager of ฅ${regex[1]}!`);
            });
    
            const startFilter = msg => msg.content.toLowerCase() == "start" && players.some(player => player.id == msg.member.id)
            const startCollector = channel.createMessageCollector({ filter: startFilter, time: 30000, max: 1 });
    
            startCollector.on('collect', () => {
                joinCollector.stop();
            });
    
            joinCollector.on('end', async collected => {
                await sleep(500);
                for await (const player of players){
                    await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', [player.wager, player.id]);
                    player.hand = [];
                    player.hand.push(deck.splice(0, 1)[0]);
                }
                dealerHand.push(deck.splice(0, 1)[0]);
                for (const player of players){
                    player.hand.push(deck.splice(0, 1)[0]);
                    player.value = addCards(player.hand);
                }
                dealerHand.push(deck.splice(0, 1)[0]);
                
                const canvas = createCanvas(720, 540);
                const ctx = canvas.getContext('2d');
                ctx.save();

                const tableImg = await loadImage("images/blackjack/table.png");
                const cardSheet = await loadImage("images/blackjack/card-sheet.png");
                const cardBack = await loadImage("images/blackjack/card-back.png");
                const arrow = await loadImage("images/blackjack/arrow.png");

                ctx.drawImage(tableImg, 0, 0);

                ctx.beginPath();
                ctx.arc(285, 55, 40, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();

                const dealerAvatarResponse = await axios.get(interaction.client.user.displayAvatarURL({ format: 'png' }), { responseType: 'arraybuffer' });
                const dealerAvatar = new Image();
                dealerAvatar.src = dealerAvatarResponse.data;
                ctx.drawImage(dealerAvatar, 245, 15, 80, 80);
                
                ctx.restore();
                ctx.drawImage(cardSheet, (dealerHand[0][1]-1)*64, dealerHand[0][0]*100, 64, 100, 338, 10, 64, 100);
                ctx.drawImage(cardBack, 352, 10);


                players.reverse();
                for(let i = 0; i < players.length; i++){
                    players[i].x = (i+1)*720/(players.length+1)-120;
                }
                players.reverse();

                for await (const player of players){
                    ctx.save();

                    ctx.beginPath();
                    ctx.arc(player.x+45, 350, 40, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();
                    
                    const avatarResponse = await axios.get(player.user.displayAvatarURL({ format: 'png' }), { responseType: 'arraybuffer' });
                    const avatar = new Image();
                    avatar.src = avatarResponse.data;

                    ctx.drawImage(avatar, player.x+5, 310, 80, 80);

                    ctx.restore();

                    ctx.drawImage(cardSheet, (player.hand[0][1]-1)*64, player.hand[0][0]*100, 64, 100, player.x+98, 310, 64, 100);
                    ctx.drawImage(cardSheet, (player.hand[1][1]-1)*64, player.hand[1][0]*100, 64, 100, player.x+112, 310, 64, 100);
                }
                
                for await(const player of players){
                    ctx.drawImage(tableImg, 0, 260, 720, 40, 0, 260, 720, 40);
                    ctx.drawImage(arrow, player.x+25, 260);

                    const attachment = new MessageAttachment(canvas.toBuffer(), 'blackjack-table.png');
                    await channel.send({ content: `It is ${player.displayName}'s turn.`, files: [attachment] });

                    await turn(player);
                }

			    await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);
            });
		} finally{
			conn.release();
		}
	},
}