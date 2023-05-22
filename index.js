require('dotenv').config();
const fs = require("fs");
const { Client, Collection, GatewayIntentBits, InteractionType, ChannelType} = require("discord.js");
const mysql = require("mysql2/promise");
const { Campaign } = require('patreon-discord');
const { stage, lurkerMin, memberMin, regularMin, championMin, decayRate, tickRate, facepalms } = require("./config.json");
const { sleep, randInt, unixToMysqlDatetime} = require("./utils.js");

// Create a new client instance
const client = new Client({ 
	intents: [
		GatewayIntentBits.Guilds, 
		GatewayIntentBits.GuildMembers, 
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.MessageContent
	],
	partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

//create mysql2 pool
const pool = mysql.createPool({
	port: 3306,
	host: process.env.MYSQL_HOST,
	user: process.env.MYSQL_USER,
	database: process.env.MYSQL_DB,
	password: process.env.MYSQL_PASSWORD,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
});

const myCampaign = new Campaign({ 
    patreonToken: process.env.PATREON_TOKEN,
    campaignId: process.env.PATREON_CAMPAIGN_ID
})


//Load Commands
client.commands = new Collection();
const commandFiles = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	// Set a new item in the Collection
	// With the key as the command name and the value as the exported module
	client.commands.set(command.data.name, command);
}
client.cooldowns = [];

client.on("interactionCreate", async interaction => {
	if (interaction.type !== InteractionType.ApplicationCommand) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	const guild = interaction.guild;
	const channel = interaction.channel;
	const member = interaction.member;
	const user = interaction.user;

	const conn = await pool.getConnection();
	try {
		if(command.game){
			const guildDB = await conn.query('SELECT `online` FROM `guild` WHERE `guild_id` = ?;', [guild.id]);
			if(guildDB[0].length == 0 || !guildDB[0][0].online) return interaction.reply({ 
				content: "The bot is currently down for maintenance.",
				ephemeral: true 
			}); 
			
            const gameDB = await conn.query('SELECT * FROM `game` WHERE `channel_id` = ?;', [channel.id]);
            if(gameDB[0].length){
				const timeElapsed = Date.now() - gameDB[0][0].start_time.getTime();
				if(timeElapsed > 300000){
					await conn.query('DELETE FROM `game` WHERE `channel_id` = ?;', [channel.id]);
				} else {
					return interaction.reply({ 
						content: `There is already a game of ${gameDB[0][0].game} running in this channel.`,
						ephemeral: true 
					});
				}
			}
		}

		if(command.catId){
			const catDB = await conn.query('SELECT * FROM `cat` WHERE `_id` = ?;', [command.catId]);
			if(catDB[0].length > 0){
				const userCatDB = await conn.query('SELECT * FROM `user_cat` WHERE (`user_id`, `cat_id`) = (?, ?);', [member.id, command.catId]);
				if(userCatDB[0].length == 0)
					return  interaction.reply({ 
						content: `You need to own ${catDB[0][0].name} to use /${interaction.commandName}.`,
						ephemeral: true 
					}); 
			}
		}

		if(command.cooldown){
			const timerDB = await conn.query('SELECT * FROM `command_timer` WHERE `user_id` = ? AND `guild_id` = ? AND `command_name` = ?;',
				[user.id, guild.id, command.data.name]);

			if(timerDB[0].length > 0){
				const prevEndTime = timerDB[0][0].end_time.getTime();
				const timeRemaining = prevEndTime - Date.now();
				if(timeRemaining > 3600000 ){
					const hours = Math.round(timeRemaining / 3600000 );
					return  interaction.reply({content: `You must wait ${hours} more hours before you can use this command again.`, ephemeral: true});
				}
				if(timeRemaining > 60000){
					const minutes = Math.round(timeRemaining / 60000);
					return  interaction.reply({content: `You must wait ${minutes} more minutes before you can use this command again.`, ephemeral: true});
				} else if(timeRemaining > 0) {
					const seconds = Math.round(timeRemaining / 1000);
					return interaction.reply({content: `You must wait ${seconds} more seconds before you can use this command again.`, ephemeral: true});
				}
			}

			const endTime = unixToMysqlDatetime(Date.now() + command.cooldown);
			await conn.query('INSERT INTO `command_timer` (user_id, guild_id, command_name, end_time) VALUES (?, ?, ?, ?);',
				[user.id, guild.id, command.data.name, endTime]);

			setTimeout(async () => {
				await conn.query('DELETE FROM `command_timer` WHERE `user_id` = ? AND `guild_id` = ? AND `command_name` = ?;',
					[user.id, guild.id, command.data.name]);
			}, command.cooldown);
		} 

		await command.execute(interaction, pool);
		
	} catch (error) {
		console.error(error);
		await interaction.reply({ 
			content: "There was an error while executing this command!",
			ephemeral: true 
		});
	} finally{
		//release pool connection
		conn.release();
	}
});


client.on('messageCreate', async message => {
	if (message.partial) await message.fetch();

	//ignore non guild channel message
	if(message.channel.type !== ChannelType.GuildText) return;

	//ignore bots
	if (message.author.bot) return;

	const guild = message.guild;
	const member = message.member;
	const channel = message.channel;

	const conn = await pool.getConnection();
	try{		
		//activity tracking
		if(message.type != 'APPLICATION_COMMAND') 
			await conn.query('UPDATE `member` SET `active` = 1 WHERE `guild_id` = ? AND `user_id` = ?;', [guild.id, member.id]);

		const guildDB = await conn.query('SELECT `count_channel` FROM `guild` WHERE `guild_id` = ?;', [guild.id]);
		//counting game
		if(channel.id == guildDB[0][0].count_channel){
			await sleep(2000);
			let messages = await channel.messages.fetch({ limit: 100 });
			messages = [...messages.values()];
			let wrongNum = false;
			let wrongMem = false;
			let hundread = false;
			for( let i = 1; i < messages.length; i++){
				const prevNum = Number(messages[i-1].content);
				const num = Number(messages[i].content);
				if(prevNum == 100) hundread = true;
				if(isNaN(prevNum) || isNaN(num)|| prevNum != num+1){
					wrongNum = true;
					break;
				}
				if(num == 0) break;
				if(messages[i-1].author.id == messages[i].author.id){
					wrongMem = true;
					break;
				}
				if(messages[i+1] && messages[i-1].author.id == messages[i+1].author.id){
					wrongMem = true;
					break;
				}
			}
			if(wrongNum){
				const failImg = facepalms[randInt(facepalms.length-1)];
				await channel.send({content: "You must reply with the next number! New game starting now. Messages must be the next number and you must wait two members between messages. Tupperbox messages always counts as the same member.",files: [failImg]});
				channel.send('0');
			} else if (wrongMem){
				const failImg = facepalms[randInt(facepalms.length-1)];
				await channel.send({content: "You must wait two members between messages! New game starting now. Messages must be the next number and you must wait two members between messages. Tupperbox messages always counts as the same member.",files: [failImg]});
				channel.send('0');
			} else if (hundread){
				const players = [];
				let messages = await channel.messages.fetch({ limit: 100 });
				messages = [...messages.values()];
				for (const msg of messages){
					if(players.includes(msg.author.id)) continue;

					const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [msg.author.id]);
					if(!userDB[0][0]) continue;
					
					const newScritchBucks = userDB[0][0].scritch_bucks + 200;
					const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
					await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;', 
						[newScritchBucks, highestScritchBucks, msg.author.id]);
					conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
						[msg.author.id, newScritchBucks, msg.author.username]);

					players.push(msg.author.id);
				}
				await channel.send({content: 'Great job! You all get ฅ200. New game starting now. Messages must be the next number and you must wait two members between messages. Tupperbox messages always counts as the same member.', files: [`images/success-kid.gif`] });
				channel.send('0');
			}
		}
	} finally{
		//release pool connection
		conn.release();
	}

	if(message.content.toLowerCase().includes('uwu')) message.channel.send('UwU')
	else if (message.content.toLowerCase().includes('owo')) message.channel.send('OWO Bwaah! get out of my face!');

});


client.on('messageReactionAdd', async (reaction, user) => {
	if (reaction.message.partial) await reaction.message.fetch();
	if (reaction.partial) await reaction.fetch();

	//ignore dms
	if(reaction.message.channel.type == 'dm') return;

	//ignore self
	if(user.id == client.user.id) return;

	const guild = reaction.message.guild;
	const member = await guild.members.cache.get(user.id);

	const conn = await pool.getConnection();
	try{
		const menuDB = await conn.query('SELECT * FROM `menu` WHERE `message_id`=?;', [reaction.message.id]);
		if(menuDB[0].length < 1) return;

		switch(menuDB[0][0].type){
			case 'color':
				//identifiy color
				const colorDB = await conn.query('SELECT * FROM `color` WHERE `emoji_id` = ?;', [reaction.emoji.id]);
				//remove reaction if not a color reaction
				if(colorDB[0].length < 1) return reaction.users.remove(member.id);

				//look up color from DB
				const color = colorDB[0][0]._id;
				const colorRoleDB = await conn.query('SELECT `role_id` FROM `color_role` WHERE `color_id` = ? AND `guild_id` = ?;',
					[color, guild.id]);
				const colorRoleId = colorRoleDB[0][0].role_id;

				//get existing member if any
				const memberDB = await conn.query('SELECT `color_id`, `activity_points` FROM `member` WHERE `guild_id` = ? AND `user_id` = ?;',
					[guild.id, member.id]);

				if(memberDB[0].length > 0){ //member exists

					//remove existing reaction
					const curColor = memberDB[0][0].color_id;
					const curColorDB = await conn.query('SELECT `emoji_id` FROM `color` WHERE `_id` = ?;', [curColor]);
					const curColorEmojiId = curColorDB[0][0].emoji_id;
					await reaction.message.reactions.cache.find(r => r.emoji.id == curColorEmojiId).users.remove(member.id);

					//remove existing role
					const curColorRoleDB = await conn.query('SELECT `role_id` FROM `color_role` WHERE `guild_id`= ? AND `color_id` = ?;',
						[guild.id, curColor]);
					await member.roles.remove(curColorRoleDB[0][0].role_id);

					//add color role to member
					await member.roles.add(colorRoleId);

					if(memberDB[0][0].activity_points < 4){
						await conn.query('UPDATE `member` SET `color_id` = ?, `activity_points` = 4 WHERE `guild_id` = ? AND `user_id` = ?;',
							[color, guild.id, member.id]);
					} else {
						await conn.query('UPDATE `member` SET `color_id` = ? WHERE `guild_id` = ? AND `user_id` = ?;',
							[color, guild.id, member.id]);
					}

					//add member role
					const guildDB = await conn.query('SELECT `member_role_id` FROM `guild` WHERE `guild_id` = ?;',
						[guild.id]);
					const memberRoleId = guildDB[0][0].member_role_id;
					await member.roles.add(memberRoleId)
				} else { //member doesn't exist yet

					//add color role to member
					await member.roles.add(colorRoleId);

					//add member role
					const guildDB = await conn.query('SELECT `member_role_id` FROM `guild` WHERE `guild_id` = ?;',
						[guild.id]);
					const memberRoleId = guildDB[0][0].member_role_id;
					await member.roles.add(memberRoleId);

					//add member to DB
					await conn.query('INSERT IGNORE INTO `member` (guild_id, user_id, name, color_id) VALUES (?, ?, ?, ?);',
						[guild.id, member.id, member.displayName, color]);
				}
			break;
			case 'role':
				const emoji = (reaction.emoji.id) ? reaction.emoji.id : reaction.emoji.name;
				//identifiy role
				const roleButtonDB = await conn.query('SELECT * FROM `role_button` WHERE `message_id` = ? AND `emoji` = ?;',
					[reaction.message.id, emoji]);
				//remove reaction if not a role button
				if(roleButtonDB[0].length < 1) return reaction.users.remove(member.id);
				//add new role
				member.roles.add(roleButtonDB[0][0].role_id);
				//remove existing roles and reactions if exclusive
				if(menuDB[0][0].exclusive){
					//remove users existing reactions
					reaction.message.reactions.cache.forEach(async existingReaction => {
						const existingEmoji = (existingReaction.emoji.id) ? existingReaction.emoji.id : existingReaction.emoji.name;
						//don't remove new reaction
						if(existingEmoji != emoji){
							//remove reaction
							await existingReaction.users.remove(member.id);
							//remove existing role
							const existingRoleButtonDB = await conn.query('SELECT `role_id` FROM `role_button` WHERE `message_id` = ? AND `emoji` = ?;',
								[reaction.message.id, existingEmoji]);
							member.roles.remove(existingRoleButtonDB[0][0].role_id);
						}
					});
				}
			break;
		}
	} finally{
		//release pool connection
		conn.release();
	}
});


client.on('messageReactionRemove', async (reaction, user) => {
	if (reaction.message.partial) await reaction.message.fetch();
	if (reaction.partial) await reaction.fetch();

	//ignore dms
	if(reaction.message.channel.type == 'dm') return;

	//ignore self
	if(user.id == client.user.id) return;

	const guild = reaction.message.guild;
	const member = await guild.members.cache.get(user.id);

	const conn = await pool.getConnection();
	try{
		const menuDB = await conn.query('SELECT * FROM `menu` WHERE `message_id`=?;', [reaction.message.id]);
		if(menuDB[0].length < 1) return;

		switch(menuDB[0][0].type){
			case 'role':
				const emoji = (reaction.emoji.id) ? reaction.emoji.id : reaction.emoji.name;
				//identifiy role
				const roleButtonDB = await conn.query('SELECT `role_id` FROM `role_button` WHERE `message_id` = ? AND `emoji` = ?;',
					[reaction.message.id, emoji]);
				if(roleButtonDB[0].length < 1) return;
				//remove role from member
				member.roles.remove(roleButtonDB[0][0].role_id);
			break;
		}
	} finally{
		//release pool connection
		conn.release();
	}
});

client.on('guildMemberAdd', async member => {
	const conn = await pool.getConnection();
	try{
		await conn.query('INSERT IGNORE INTO `user` (user_id, name) VALUES (?, ?);',
			[member.id, member.displayName]);
		//add Aineko cat to user;
		const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
			[member.id, 1, member.displayName, 'Aineko']);
		if(userCatDB[0].affectedRows){
			member.send({content: 'You just gained ownership of Aineko by joining your first server with Aineko in it. Aineko is your first cat but you can collect many more by interacting with the bot. Owning Aineko unlocks the /scritch command which you can use to earn "scritch bucks", an in bot currency represented by ฅ.', files: ['images/cats/Aineko.jpg']});
		}

		const guildDB = await conn.query('SELECT * FROM `guild` WHERE `guild_id` = ?;', 
			[member.guild.id]);
		if(guildDB[0][0].welcome_message){
			const msg = `Welcome, ${member.toString()}. ${guildDB[0][0].welcome_message}`;
			if(guildDB[0][0].welcome_image){
				await member.guild.systemChannel.send( { content: msg, files: [guildDB[0][0].welcome_image] } );
			} else {
				await member.guild.systemChannel.send(msg);
			}
		}
	} finally{
		//release pool connection
		conn.release();
	}
});

client.on('guildMemberRemove', async member => {
	const conn = await pool.getConnection();
	try{
		await conn.query('DELETE FROM `member` WHERE `guild_id` = ? AND `user_id` = ?;',
			[member.guild.id, member.id]);
	} finally{
		//release pool connection
		conn.release();
	}
});

client.on('guildCreate', async guild => {
	guildCreate(guild);
});



client.on('guildDelete', async guild => {
	const conn = await pool.getConnection();
	try{
		await conn.query('UPDATE `guild` SET `active` = 0 WHERE `guild_id` = ?;',[guild.id]);
		await conn.query('DELETE FROM `member` WHERE `guild_id` = ?;', [guild.id]);
	} finally{
		//release pool connection
		conn.release();
	}
	console.log(`Removed from server: ${guild.name}`);
});

const guildCreate = async (guild) => {
	//get the bots highest role
	const hightestRole = guild.me.roles.highest;

	//grab connection from pool for multiple queries.
	const conn = await pool.getConnection();
	try{
		//see if the guild already exists in the database.
		const guildDB = await conn.query('SELECT * FROM `guild` WHERE `guild_id` = ?;', [guild.id]);
		if(guildDB[0].length > 0){//Guild is already in DB
			//see if champion role still exists
			const championRole = await guild.roles.fetch(guildDB[0][0].champion_role_id);
			if(!championRole){
				//make a new champion role
				const newRole = await guild.roles.create({
					name: "Champion",
					permissions: "0",
					hoist: true,
					position: hightestRole-1
				});
				await conn.query(
					'UPDATE `guild` SET `champion_role_id` = ? WHERE `guild_id` = ?;',
					[newRole.id, guild.id]
				);
			}
			//see if regular role still exists
			const regularRole = await guild.roles.fetch(guildDB[0][0].regular_role_id);
			if(!regularRole){
				//make a new regular role
				const newRole = await guild.roles.create({
					name: "Regular",
					permissions: "0",
					hoist: true,
					position: hightestRole-2
				});
				await conn.query(
					'UPDATE `guild` SET `regular_role_id` = ? WHERE `guild_id` = ?;',
					[newRole.id, guild.id]
				);
			}
			//see if member role still exists
			const memberRole = await guild.roles.fetch(guildDB[0][0].member_role_id);
			if(!memberRole){
				//make a new member role
				const newRole = await guild.roles.create({
					name: "Member",
					permissions: "1024",
					hoist: true,
					position: hightestRole-3
				});
				await conn.query(
					'UPDATE `guild` SET `member_role_id` = ? WHERE `guild_id` = ?;',
					[newRole.id, guild.id]
				);
			}
			await conn.query(
				'UPDATE `guild` SET `active` = 1 WHERE `guild_id` = ?;',
				[guild.id]
			);
		} else { //guild is not in DB
			const championRole = await guild.roles.create({
				name: "Champion",
				permissions: "0",
				hoist: true,
				position: hightestRole-1
			});
			const regularRole = await guild.roles.create({
				name: "Regular",
				permissions: "0",
				hoist: true,
				position: hightestRole-2
			});
			//make a member role
			const memberRole = await guild.roles.create({
				name: "Member",
				permissions: "1024",
				hoist: true,
				position: hightestRole-3
			});
			//add the guild to the database
			await conn.query(
				'INSERT IGNORE INTO `guild` (guild_id, name, member_role_id, regular_role_id, champion_role_id) VALUES (?, ?, ?, ?, ?);',
				[guild.id, guild.name, memberRole.id, regularRole.id, championRole.id]
			);
		}

		//get the list of colors
		const colors = await conn.query('SELECT * FROM `color` ORDER BY `_id`;');
		//make roles for each color
		if(colors[0].length < 1) throw new Error(`No colors found when joining guild: ${guild.name}.`)
		for await (const color of colors[0]){
			//see if there are existing roles and if not create them
			const roleDB = await conn.query(
				'SELECT * FROM `color_role` WHERE `color_id` = ? AND `guild_id` = ?;',
				[color._id, guild.id]
			);
			//fetch the role if it already exists;
			if(roleDB[0].length > 0){
				//create a new role if it has been deleted.
				const colorRole = await guild.roles.fetch(roleDB[0][0].role_id);
				if(!colorRole){
					const newRole = await guild.roles.create({
						name: color.name,
						color: '#'+color.hex,
						permissions: "0",
						position: hightestRole-3-color._id
					});
					await conn.query(
						'UPDATE `color_role` SET `role_id` = ? WHERE `color_id` = ? AND `guild_id` = ?;',
						[newRole.id, color._id, guild.id]
					);
				}
			} else {
				//make a new role and add it to the db
				const newRole = await guild.roles.create({
					name: color.name,
					color: '#'+color.hex,
					permissions: "0",
					position: hightestRole-3-color._id
				});
				await conn.query(
					'INSERT INTO `color_role` (color_id, guild_id, role_id) VALUES (?, ?, ?);',
					[color._id, guild.id, newRole.id]
				);
			}
		}

		//add all members to the user DB
		let members = await guild.members.fetch();
		members = [...members.values()];
		for await (const member of members){
			if(member.id == client.user.id) continue;
			await conn.query('INSERT IGNORE INTO `user` (user_id, name) VALUES (?, ?);',
				[member.id, member.displayName]);
			//add Aineko cat to user;
			const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
				[member.id, 1, member.displayName, 'Aineko']);
			if(userCatDB[0].affectedRows){
				member.send({content: 'You just gained ownership of Aineko having Aineko added to a server you are in. Aineko is your first cat but you can collect many more by interacting with the bot. Owning Aineko unlocks the /scritch command which you can use to earn "scritch bucks", an in bot currency represented by ฅ.', files: ['images/cats/Aineko.jpg']});
			}
		}
	} finally{
		//release pool connection
		conn.release();
	}

	await guild.systemChannel.send("Meow! I'm Aineko. Thank you for adding me to your server.");
	console.log(`Added to server: ${guild.name}`);
}


async function activityLoop(){
	const conn = await pool.getConnection();
	try{
		const currTime = Date.now();
		const patrons = await myCampaign.fetchPatrons(['active_patron', 'former_patron']);

		for(var patron of patrons){
			if(patron.discord_user_id){
				const lastCharge = new Date(patron.last_charge_date).getTime();
				const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [patron.discord_user_id]);
				if(userDB[0].length > 0 && lastCharge){
					if(!userDB[0][0].patron_join_time){
						await conn.query('UPDATE `user` SET `patron_join_time` = ?, `is_patron` = 1 WHERE `user_id` = ?;', [unixToMysqlDatetime(lastCharge), patron.discord_user_id]);
					}

					if(!userDB[0][0].last_payout_time){
						const newScritchBucks = userDB[0][0].scritch_bucks + 1000;
						const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
						await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
						[patron.discord_user_id, newScritchBucks, userDB[0][0].name]);
						await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` + 1000, `scritch_bucks_highscore` = ? `last_payout_time` = ? WHERE `user_id` = ?;', [highestScritchBucks,unixToMysqlDatetime(currTime), patron.discord_user_id]);

						const user = client.users.cache.get(patron.discord_user_id);
						if(user) await user.send(`You have just recieved your first 1000 Scritch Bucks in the Aineko bot for joining MadMonkey's Patreon! https://www.patreon.com/monkeymakes`);
						
						const owner = client.users.cache.get(process.env.BOT_OWNER_ID);
						if(owner) await owner.send(`${userDB[0][0].name} just got 1000 Sritch Bucks for joining the Patreon.`);
					} else {
						const lastPayout = new Date(userDB[0][0].last_payout_time).getTime();
						if(lastCharge > lastPayout){
							const newScritchBucks = userDB[0][0].scritch_bucks + 1000;
							const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
							await conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
							[patron.discord_user_id, newScritchBucks, userDB[0][0].name]);
							await conn.query('UPDATE `user` SET `scritch_bucks` = `scritch_bucks` + 1000, `scritch_bucks_highscore` = ? `last_payout_time` = ? WHERE `user_id` = ?;', [highestScritchBucks,unixToMysqlDatetime(currTime), patron.discord_user_id]);
							
							const user = client.users.cache.get(patron.discord_user_id);
							if(user) await user.send(`You have just recieved 1000 Scritch Bucks in the Aineko bot for renewing your Patreon subscription to MadMonkey! https://www.patreon.com/monkeymakes`);
							
							const owner = client.users.cache.get(process.env.BOT_OWNER_ID);
							if(owner) await owner.send(`${userDB[0][0].name} just got 1000 Sritch Bucks for renewing their Patreon.`);
						}
					}
				}
			}
		}

		const guildsDB = await conn.query('SELECT * FROM `guild` WHERE `active` = 1;');
		for await(const guildDB of guildsDB[0]){
			const guild = await client.guilds.fetch(guildDB.guild_id);

			const colorMenuDB = await conn.query('SELECT * FROM `menu` where `type` = "color" AND `guild_id` = ?;', [guild.id]);
			let colorMsg;
			if(colorMenuDB[0].length > 0){
				const colorChannel = await guild.channels.fetch(colorMenuDB[0][0].channel_id);
				colorMsg = await colorChannel.messages.fetch(colorMenuDB[0][0].message_id);
			}

			const membersDB = await conn.query('SELECT * FROM `member` where `guild_id` = ?;', [guild.id]);
			for await(const memberDB of membersDB[0]){
				try{
					const member = await guild.members.fetch(memberDB.user_id);

					const prevActivityPoints = memberDB.activity_points;
					let activityPoints = prevActivityPoints*decayRate;
	
					if(memberDB.active){
						activityPoints ++; 
						if(activityPoints < memberMin) activityPoints = memberMin;
					}
	
					if(member.roles.cache.has(guildDB.member_role_id) && activityPoints < lurkerMin ){
						await member.roles.remove(guildDB.member_role_id);
	
						//remove existing reaction
						const curColor = memberDB.color_id;
						const curColorDB = await conn.query('SELECT `emoji_id` FROM `color` WHERE `_id` = ?;', [curColor]);
						const curColorEmojiId = curColorDB[0][0].emoji_id;
						if(colorMsg) await colorMsg.reactions.cache.find(r => r.emoji.id == curColorEmojiId).users.remove(member.id);
	
						//remove existing color role
						const curColorRoleDB = await conn.query('SELECT `role_id` FROM `color_role` WHERE `guild_id`= ? AND `color_id` = ?;',
							[guild.id, curColor]);
						await member.roles.remove(curColorRoleDB[0][0].role_id);
	
						member.send(`You're member status has lapsed on ${guild.name} because of inactivity. You can reclaim your member status by simply agreeing to the rules again by choosing a name color.`);
					}
					if(!member.roles.cache.has(guildDB.regular_role_id) && activityPoints > regularMin) await member.roles.add(guildDB.regular_role_id);
					if(member.roles.cache.has(guildDB.regular_role_id) && activityPoints < regularMin) await member.roles.remove(guildDB.regular_role_id);
					if(!member.roles.cache.has(guildDB.champion_role_id) && activityPoints > championMin) await member.roles.add(guildDB.champion_role_id);
					if(member.roles.cache.has(guildDB.champion_role_id) && activityPoints < championMin) await member.roles.remove(guildDB.champion_role_id);
	
					await conn.query('UPDATE `member` SET `activity_points` = ?, `active` = 0, `prev_active` = ? WHERE `guild_id` = ? AND `user_id` = ?;',
						[activityPoints, memberDB.active, guild.id, member.id]);
				} catch (err){
					continue;
				}
			}
		}
	} finally{
		//release pool connection
		conn.release();
	}

	setTimeout(activityLoop, tickRate);
}

async function questionLoop(){
	let questionTime = new Date();
	if (questionTime.getHours() >= 14) questionTime.setDate(questionTime.getDate() + 1);
	questionTime.setHours(14, 0, 0, 0);
	questionTime = questionTime.getTime();
	
	const curTime = new Date().getTime();

	setTimeout(async () => {
		const conn = await pool.getConnection();
		try{
			const questionDB = await conn.query('SELECT * FROM `question` WHERE `asked` = 0;');

			if(questionDB[0].length < 1){
				console.error("No question of the day!");
			} else {
				//random question.
				const questionId = Math.floor(Math.random() * questionDB[0].length) 

				const guildsDB = await conn.query('SELECT * FROM `guild` WHERE `active` = 1;');
				for await(const guildDB of guildsDB[0]){
					if(!guildDB.question_channel) continue;
					
					const guild = await client.guilds.fetch(guildDB.guild_id);
					const channel = await guild.channels.fetch(guildDB.question_channel);
					channel.send(`It's now <t:${questionTime/1000}> and it's time for the **question of the day!** \`\`\`${questionDB[0][questionId].question}\`\`\``);
				}
				await conn.query('UPDATE `question` SET `asked` = 1 WHERE `_id` = ?;', [questionDB[0][questionId]._id]);
			}
		} finally{
			//release pool connection
			conn.release();
			
			questionLoop();
		}
	}, questionTime - curTime);
}

async function timerSetup(){
	const conn = await pool.getConnection();
	try{
		const commandTimerDB = await conn.query('SELECT * FROM `command_timer`;');
		
		for await(const commandTimer of commandTimerDB[0]){
			const timeRemaining = commandTimer.end_time - Date.now();

			if(timeRemaining > 0){
				setTimeout(async () => {
					await conn.query('DELETE FROM `command_timer` WHERE `user_id` = ? AND `guild_id` = ? AND `command_name` = ?;',
						[commandTimer.user_id, commandTimer.guild_id, commandTimer.command_name]);
				}, timeRemaining);
			} else {
				await conn.query('DELETE FROM `command_timer` WHERE `user_id` = ? AND `guild_id` = ? AND `command_name` = ?;',
					[commandTimer.user_id, commandTimer.guild_id, commandTimer.command_name]);
			}
		}	
	} finally{
		//release pool connection
		conn.release();
	}
}

// Login to Discord with your client's token
client.once("ready", async () => {
	client.user.setPresence({
		status: "available",
		activities: [{
			name: "Blackjack",
			type: "PLAYING"
		}]
	});
  
	const conn = await pool.getConnection();
	try{
		//set up any new guilds that were
		client.guilds.cache.forEach(async guild => {
			const guildDB = await conn.query('SELECT * FROM `guild` WHERE guild_id=?;',[guild.id]);
			if(guildDB[0].length < 1) return guildCreate(guild);
			if(guildDB[0][0].active == 0){
				guildCreate(guild);
			} else {
				//guild exists in db but we still need to add any new members
				let members = await guild.members.fetch();
				members = [...members.values()];
				for await (const member of members){
					if(member.id == client.user.id) continue;
					await conn.query('INSERT IGNORE INTO `user` (user_id, name) VALUES (?, ?);',
						[member.id, member.displayName]);
					//add Aineko cat to user;
					const userCatDB = await conn.query('INSERT IGNORE INTO `user_cat` (user_id, cat_id, user_name, cat_name) VALUES (?, ?, ?, ?);',
						[member.id, 1, member.displayName, 'Aineko']);
					if(userCatDB[0].affectedRows){
						member.send({content: 'You just gained ownership of Aineko by joining your first server with Aineko in it. Aineko is your first cat but you can collect many more by interacting with the bot. Owning Aineko unlocks the /scritch command which you can use to earn "scritch bucks", an in bot currency represented by ฅ.', files: ['images/cats/Aineko.jpg']});
					}
				}
			}
		});
	} finally{
		//release pool connection
		conn.release();
	}
	
	// const guild = await client.guilds.fetch('825883828798881822');
	// const channel = await guild.channels.fetch('865713507136045117');
	// const msg = await channel.messages.fetch('1000499776204312726');
	// const colorsDB = await conn.query('SELECT * FROM `color`;');
	// for await (const color of colorsDB[0]){
	// 	msg.react(color.emoji_id)
	// // }
	// const reactions = await msg.reactions.cache;
	// for(const reaction of reactions){
	// 	console.log(reaction)
	// }




	setTimeout(activityLoop, tickRate);
	//activityLoop();
	
	questionLoop();

	timerSetup();

	const startMsg = (stage == 'production') ? 'Aineko is ready!' : 'Aineko Beta is ready!';
	console.log(startMsg);
});




client.login(process.env.TOKEN);