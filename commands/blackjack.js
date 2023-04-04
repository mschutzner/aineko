const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder } = require('discord.js');
const { sleep, shuffle } = require("../utils.js");
const { createCanvas, loadImage, Image } = require('canvas');

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

async function turn(deck, channel, ctx, canvas, cardSheet, player, conn){
    if(player.hand.length == 2){
        const userDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [player.id]);
        if(userDB[0][0].scritch_bucks >= player.wager){
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
            await channel.send({ content: `It is <@${player.id}>'s turn. They have 30 seconds to reply with hit, stand, double down, or surrender.`, files: [attachment] });
            
            const filter = msg => msg.author.id == player.id && msg.content.match(/^(hit|stand|surrender|double down)/i);
            const collected = await channel.awaitMessages({ filter, max: 1, time: 30000 });
            
            if(collected.first() && collected.first().content.toLowerCase() !== 'stand'){
                if (collected.first().content.toLowerCase() == 'surrender') {
                    player.surrendered = true;
                    const attachment2 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                    await channel.send({ content: `${player.displayName} has surrendered.`, files: [attachment2] });
                    await sleep(2000);
                    const obj = { deck, player};
                    return obj;
                } else if (collected.first().content.toLowerCase() == 'double down'){
                    player.wager *= 2;
    
                    await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', [player.wager, player.id]);
    
                    player.hand.push(deck.splice(0, 1)[0]);
                    // player.hand.push([0,1]);
                    
                    if(player.value == 20){
                        //add Murphy to user;
                        const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
                            [player.id, 4, player.displayName, 'Murphy']);
                        if(userCatDB[0].affectedRows){
                            channel.send({content: `<@${player.id}> just gained ownership of Murphy by hitting on 20 in blackjack! This unlocks the /beg command.`, files: ['images/cats/Murphy.jpg']});
                        }
                    }

                    player.hand.reverse();
                    for (const index in player.hand){
                        ctx.drawImage(cardSheet, (player.hand[index][1]-1)*64, player.hand[index][0]*100, 64, 100, player.x+92+20*(player.hand.length-index-1), 415-50*(player.hand.length-index-1), 64, 100);
                    }
                    player.hand.reverse();
            
                    player.value = addCards(player.hand);
                    if(player.value == 21){
                        const attachment2 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                        await channel.send({ content: `${player.displayName} has doubled down and got blackjack!`, files: [attachment2] });
                        await sleep(3000);
                        const obj = { deck, player};
                        return obj;
                    } else if(player.value > 21){
                        player.busted = true;
                        const attachment2 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                        await channel.send({ content: `${player.displayName} has doubled down and busted.`, files: [attachment2] });
                        await sleep(3000);
                        const obj = { deck, player};
                        return obj;
                    } else {
                        const attachment2 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                        await channel.send({ content: `${player.displayName} has doubled down.`, files: [attachment2] });
                        await sleep(3000);
                        const obj = { deck, player};
                        return obj;
                    }
                } else {
                    player.hand.push(deck.splice(0, 1)[0]);
                    // player.hand.push([0,1]);
                    
                    if(player.value == 20){
                        //add Murphy to user;
                        const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
                            [player.id, 4, player.displayName, 'Murphy']);
                        if(userCatDB[0].affectedRows){
                            channel.send({content: `<@${player.id}> just gained ownership of Murphy by hitting on 20 in blackjack! This unlocks the /beg command.`, files: ['images/cats/Murphy.jpg']});
                        }
                    }
        
                    player.hand.reverse();
                    for (const index in player.hand){
                        ctx.drawImage(cardSheet, (player.hand[index][1]-1)*64, player.hand[index][0]*100, 64, 100, player.x+92+20*(player.hand.length-index-1), 415-50*(player.hand.length-index-1), 64, 100);
                    }
                    player.hand.reverse();
    
                    player.value = addCards(player.hand);
                    if(player.value == 21){
                        const attachment2 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                        await channel.send({ content: `${player.displayName} got blackjack!`, files: [attachment2] });
                        await sleep(3000);
                        const obj = { deck, player};
                        return obj;
                    } else if(player.value > 21){
                        player.busted = true;
                        const attachment2 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                        await channel.send({ content: `${player.displayName} busted.`, files: [attachment2] });
                        await sleep(3000);
                        const obj = { deck, player};
                        return obj;
                    } else {
                        const obj = await turn(deck, channel, ctx, canvas, cardSheet, player, conn);
                        return obj;
                    }
                }
            } else {
                await channel.send(`${player.displayName} stood.`);
                const obj = { deck, player};
                return obj;
            }
        } else {
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
            await channel.send({ content: `It is <@${player.id}>'s turn. They have 30 seconds to reply with hit, stand, or surrender.`, files: [attachment] });
            
            const filter = msg => msg.author.id == player.id && msg.content.match(/^(hit|stand|surrender)/i);
            const collected = await channel.awaitMessages({ filter, max: 1, time: 30000 });
            if(collected.first() && collected.first().content.toLowerCase() !== 'stand'){
                if (collected.first().content.toLowerCase() == 'surrender') {
                    player.surrendered = true;
                    const attachment2 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                    await channel.send({ content: `${player.displayName} has surrendered.`, files: [attachment2] });
                    await sleep(2000);
                    const obj = { deck, player};
                    return obj;
                } else {
                    player.hand.push(deck.splice(0, 1)[0]);
                    // player.hand.push([0,1]);
                    
                    if(player.value == 20){
                        //add Murphy to user;
                        const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
                            [player.id, 4, player.displayName, 'Murphy']);
                        if(userCatDB[0].affectedRows){
                            channel.send({content: `<@${player.id}> just gained ownership of Murphy by hitting on 20 in blackjack! This unlocks the /beg command.`, files: ['images/cats/Murphy.jpg']});
                        }
                    }
       
                    player.hand.reverse();
                    for (const index in player.hand){
                        ctx.drawImage(cardSheet, (player.hand[index][1]-1)*64, player.hand[index][0]*100, 64, 100, player.x+92+20*(player.hand.length-index-1), 415-50*(player.hand.length-index-1), 64, 100);
                    }
                    player.hand.reverse();

                    player.value = addCards(player.hand);
                    if(player.value == 21){
                        const attachment2 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                        await channel.send({ content: `${player.displayName} got blackjack!`, files: [attachment2] });
                        await sleep(3000);
                        const obj = { deck, player};
                        return obj;
                    } else if(player.value > 21){
                        player.busted = true;
                        const attachment2 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                        await channel.send({ content: `${player.displayName} busted.`, files: [attachment2] });
                        await sleep(3000);
                        const obj = { deck, player};
                        return obj;
                    } else {
                        const obj = await turn(deck, channel, ctx, canvas, cardSheet, player, conn);
                        return obj;
                    }
                }
            } else {
                await channel.send(`${player.displayName} stood.`);
                const obj = { deck, player};
                return obj;
            }
        }
    } else {
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
        await channel.send({ content: `It is <@${player.id}>'s turn. They have 30 seconds to reply with hit or stand.`, files: [attachment] });
        
        const filter = msg => msg.author.id == player.id && msg.content.match(/^(hit|stand)/i);
    
        const collected = await channel.awaitMessages({ filter, max: 1, time: 30000 });
        if(collected.first() && collected.first().content.toLowerCase() == 'hit'){
            player.hand.push(deck.splice(0, 1)[0]);
            // player.hand.push([0,1]);
                    
                    if(player.value == 20){
                        //add Murphy to user;
                        const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
                            [player.id, 4, player.displayName, 'Murphy']);
                        if(userCatDB[0].affectedRows){
                            channel.send({content: `<@${player.id}> just gained ownership of Murphy by hitting on 20 in blackjack! This unlocks the /beg command.`, files: ['images/cats/Murphy.jpg']});
                        }
                    }
    
            player.hand.reverse();
            for (const index in player.hand){
                ctx.drawImage(cardSheet, (player.hand[index][1]-1)*64, player.hand[index][0]*100, 64, 100, player.x+92+20*(player.hand.length-index-1), 415-50*(player.hand.length-index-1), 64, 100);
            }
            player.hand.reverse();

            player.value = addCards(player.hand);
            if(player.value == 21){
                const attachment2 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                await channel.send({ content: `${player.displayName} got blackjack!`, files: [attachment2] });
                await sleep(3000);
                const obj = { deck, player};
                return obj;
            } else if(player.value > 21){
                player.busted = true;
                const attachment2 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                await channel.send({ content: `${player.displayName} busted.`, files: [attachment2] });
                await sleep(3000);
                const obj = { deck, player};
                return obj;
            } else {
                const obj = await turn(deck, channel, ctx, canvas, cardSheet, player, conn);
                return obj;
            }
        } else {
            await channel.send(`${player.displayName} stood.`);
            const obj = { deck, player};
            return obj;
        }
    }

}

async function dealerTurn(deck, channel, ctx, cardSheet, tableImg, dealerAvatar, dealerHand){
    ctx.drawImage(tableImg, 0, 0, 720, 140, 0, 0, 720, 140);

    dealerHand.push(deck.splice(0, 1)[0]);
    // dealerHand.push([0,1]);

    const x = (720/2)-(85+69*dealerHand.length)/2
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(x+40, 55, 40, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(dealerAvatar, x, 15, 80, 80);
    ctx.restore();

    for(const index in dealerHand){
        ctx.drawImage(cardSheet, (dealerHand[index][1]-1)*64, dealerHand[index][0]*100, 64, 100, x+85+69*index, 10, 64, 100);
    }

    const dealerValue = addCards(dealerHand);
    if(dealerValue < 17){
        deck = await dealerTurn(deck, channel, ctx, cardSheet, tableImg, dealerAvatar, dealerHand);
    }
    
    return deck;
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
        
        if(wager <= 0 ) return interaction.reply({ 
			content: "Wager must be positive.",
			ephemeral: true 
		});

        const players = [interaction.member]
        players[0].wager = wager;

        const conn = await pool.getConnection();
		try{
            //check if player has enough scritch bucks and return if not.
            const userDB = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [interaction.member.id]);
            if(userDB[0].length === 0) throw("That user does not exist in the database.");
            if(wager > userDB[0][0].scritch_bucks) return interaction.reply({content: "You don't have enough scritch bucks.", ephemeral: true});

            await conn.query('INSERT INTO `game` (channel_id, game) VALUES (?, "blackjack");', [channel.id]);

            await interaction.reply(`${interaction.member.displayName} has started a game of blackjack with a wager of ฅ${wager}! Reply with join followed by the amount of scritch bucks you'd like to wager. The game starts in one minute or when a player replies with "start". ${interaction.member.displayName} can cancel the game by responding with "cancel".`);
    
            let deck = [];
            for(let i = 0; i < 6; i++){
                for(let j = 0; j < 4; j++){
                    for(let k = 1; k <= 13; k++){
                        deck.push([j,k]);
                    }
                }
            }
            deck = shuffle(deck);
    
            const joinFilter = msg => msg.content.match(/^join ฅ?[1-9]+[0-9]*/i) && !players.some(player => player.id == msg.member.id);
            const joinCollector = channel.createMessageCollector({ filter: joinFilter, time: 60000});
    
            joinCollector.on('collect', async msg => {
                const regex = msg.content.match(/^join ฅ?([1-9]+[0-9]*)/i);
                const wager = parseInt(regex[1]);
                const userDB2 = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [msg.member.id]);
                if(userDB2[0].length === 0) return channel.send("That user does not exist in the database.");
                if(wager > userDB2[0][0].scritch_bucks) return channel.send("You don't have enough scritch bucks.");
                players.push(msg.member);
                players[players.length-1].wager = wager;
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

                joinCollector.stop('canceled');
                startCollector.stop();
                
			    await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);

                await channel.send(`Game of blackjack canceled!`);
            });

    
            joinCollector.on('end', async (collected, reason) => {
                if(reason && reason === 'canceled') return;
                await sleep(500);

                //clear out previous games and remove wagers from DB
                for await (const player of players){
                    player.busted = false;
                    player.surrendered = false;
                    player.insurance = false;
                    await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', [player.wager, player.id]);
                }

                let dealerHand = [];
                for await (const player of players){
                    player.hand = [];
                    player.hand.push(deck.splice(0, 1)[0]);
                    // player.hand.push([0,10]);
                }
                dealerHand.push(deck.splice(0, 1)[0]);
                // dealerHand.push([0,1]);
                for await (const player of players){
                    player.hand.push(deck.splice(0, 1)[0]);
                    // player.hand.push([0,10]);
                    player.value = addCards(player.hand);
                }
                dealerHand.push(deck.splice(0, 1)[0]);
                // dealerHand.push([0,1]);
                const canvas = createCanvas(720, 540);
                const ctx = canvas.getContext('2d');
                ctx.save();

                const tableImg = await loadImage("images/blackjack/table.png");
                const cardSheet = await loadImage("images/blackjack/card-sheet.png");
                const cardBack = await loadImage("images/blackjack/card-back.png");
                const arrow = await loadImage("images/blackjack/arrow.png");

                ctx.drawImage(tableImg, 0, 0);

                ctx.beginPath();
                ctx.arc(284, 55, 40, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();

                const dealerAvatar = await loadImage(interaction.client.user.displayAvatarURL().replace('webp', 'png'));
                ctx.drawImage(dealerAvatar, 244, 15, 80, 80);
                
                ctx.restore();
                ctx.drawImage(cardSheet, (dealerHand[0][1]-1)*64, dealerHand[0][0]*100, 64, 100, 329, 10, 64, 100);
                ctx.drawImage(cardBack, 398, 10);

                players.reverse();
                for(let i = 0; i < players.length; i++){
                    players[i].x = (i+1)*720/(players.length+1)-120;
                }
                players.reverse();

                for await (const player of players){
                    ctx.save();

                    ctx.beginPath();
                    ctx.arc(player.x+45, 475, 40, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();

                    const avatar = await loadImage(player.displayAvatarURL().replace('webp', 'png'));
                    ctx.drawImage(avatar, player.x+5, 435, 80, 80);


                    ctx.restore();

                    ctx.drawImage(cardSheet, (player.hand[1][1]-1)*64, player.hand[1][0]*100, 64, 100, player.x+92+20, 415-50, 64, 100);
                    ctx.drawImage(cardSheet, (player.hand[0][1]-1)*64, player.hand[0][0]*100, 64, 100, player.x+92, 415, 64, 100);
                }
                
                for await(const player of players){
                    ctx.drawImage(arrow, player.x+25, 385);

                    if(dealerHand[0][1] == 1){
                        const userDB3 = await conn.query('SELECT `scritch_bucks` FROM `user` WHERE `user_id` = ?;', [player.id]);
                        if(userDB3[0][0].scritch_bucks < Math.ceil(player.wager/2)){
                            await channel.send(`${player.displayName} doesn't have enough scritch bucks for insurance.`);
                        } else {
                            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                            await channel.send({ content: `<@${player.id}>, do you want insurance? Reply with yes or no.`, files: [attachment] });
    
                            const filter = msg => msg.author.id == player.id && msg.content.match(/^(yes|no)/i);
    
                            const collected = await channel.awaitMessages({ filter, max: 1, time: 20000 });

                            if(collected.first() && collected.first().content.toLowerCase() == 'yes'){
                                player.insurance = Math.ceil(player.wager/2);
                                await channel.send(`${player.displayName} has opted for insurance and put forward ${player.insurance}.`);
                                await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` - ? WHERE `user_id` = ?;', [player.insurance, player.id]);
                            }
                        }
                    }

                    if(player.value == 21){
                        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                        await channel.send({ content: `${player.displayName} got blackjack!`, files: [attachment] });
                        await sleep(3000);
                    } else {
                        const obj = await turn(deck, channel, ctx, canvas, cardSheet, player, conn);
                        Object.assign(deck, obj.deck);
                        Object.assign(player, obj.player);
                        player.value = addCards(player.hand);
                    }
                    ctx.drawImage(tableImg, player.x+25, 385, 40, 40, player.x+25, 385, 40, 40);
                }

                let dealerValue = addCards(dealerHand);
                ctx.drawImage(cardSheet, (dealerHand[1][1]-1)*64, dealerHand[1][0]*100, 64, 100, 398, 10, 64, 100);
                
                if(dealerHand[0][1] == 1){
                    let msg = '';
                    if(dealerValue == 21){
                        for await (const player of players){
                            if(player.insurance){
                                msg += `${player.displayName} won ${2*player.insurance} in insurance.\n`;
                                await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` + ? WHERE `user_id` = ?;', [2*player.insurance, player.id]);
                            }
                        }
                    } else {
                        for await (const player of players){
                            if(player.insurance){
                                msg += `${player.displayName} lost ${player.insurance} in insurance.`;
                            }
                        }
                    }
                    if(msg){
                        const attachment2 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                        await channel.send({ content: msg, files: [attachment2] });
                        await sleep(4000);
                    }
                }

                if(dealerValue < 17){
                    deck = await dealerTurn(deck, channel, ctx, cardSheet, tableImg, dealerAvatar, dealerHand);
                } 
                dealerValue = addCards(dealerHand);

                let msg2;
                if(dealerValue > 21){
                    msg2 = `The dealer busted!\n`;
                    for await (const player of players){
                        const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [player.id]);
                        if(player.busted){
                            msg2 += `${player.displayName} lost ฅ${player.wager}.\n`;
                            
                            conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
                                [player.id, userDB[0][0].scritch_bucks, player.user.username]);

                        } else if(player.surrendered){
                            const loss = Math.ceil(player.wager/2);
                            msg2 += `${player.displayName} lost ฅ${loss}.\n`;
                            
                            const newScritchBucks = userDB[0][0].scritch_bucks + player.wager-loss;
                            await conn.query('UPDATE `user` SET `scritch_bucks` = ? WHERE `user_id` = ?;', 
                                [newScritchBucks, player.id]);
                            conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
                                [player.id, newScritchBucks, player.user.username]);
                        } else {
                            const win = (player.value == 21) ? Math.ceil(player.wager*1.5) : player.wager;
                            msg2 += `${player.displayName} won ฅ${win}.\n`;

                            const newScritchBucks = userDB[0][0].scritch_bucks + player.wager + win;
                            const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
                            await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                                [newScritchBucks, highestScritchBucks, player.id]);
                            conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
                                [player.id, newScritchBucks, player.user.username]);
                        }
                    }
                } else {
                    msg2 = `Dealer got ${dealerValue}.\n`;
                    for await (const player of players){
                        const userDB3 = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [player.id]);

                        if(player.busted){
                            msg2 += `${player.displayName} lost ฅ${player.wager}.\n`;
                        
                            conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
                                [player.id, userDB3[0][0].scritch_bucks, player.user.username]);

                        } else if(player.surrendered){
                            const loss = Math.ceil(player.wager/2);
                            msg2 += `${player.displayName} lost ฅ${loss}.\n`;

                            const newScritchBucks = userDB3[0][0].scritch_bucks + player.wager-loss;
                            await conn.query('UPDATE `user` SET `scritch_bucks` = ? WHERE `user_id` = ?;', 
                                [newScritchBucks, player.id]);
                            conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
                                [player.id, newScritchBucks, player.user.username]);

                        } else {
                            if(player.value > dealerValue){
                                const win = (player.value == 21) ? Math.ceil(player.wager*1.5) : player.wager;
                                msg2 += `${player.displayName} won ฅ${win}.\n`;
                                
                                const newScritchBucks = userDB3[0][0].scritch_bucks + player.wager + win;
                                const highestScritchBucks = (newScritchBucks > userDB3[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB3[0][0].scritch_bucks_highscore;
                                await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
                                    [newScritchBucks, highestScritchBucks, player.id]);
                                conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
                                    [player.id, newScritchBucks, player.user.username]);

                            } else if(player.value == dealerValue){
                                msg2 += `${player.displayName} pushed.\n`;

                                await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` + ? WHERE `user_id` = ?;', [player.wager, player.id]);

                            } else {
                                msg2 += `${player.displayName} lost ฅ${player.wager}.\n`;

                                await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
                                    [player.id, userDB3[0][0].scritch_bucks, player.user.username]);
                            }
                        }
                    }
                }
                const attachment3 = new AttachmentBuilder(canvas.toBuffer(), { name: 'blackjack-table.png' });
                await channel.send({ content: msg2, files: [attachment3] });

                await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);
            });
		} catch(err){              
           await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);
           throw err;
        } finally{
			conn.release();
		}
	},
}