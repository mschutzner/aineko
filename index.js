require('dotenv').config();
const fs = require("fs");
const { Client, Collection, Intents } = require("discord.js");
const mysql = require("mysql2/promise");
const { stage, lurkerMin, memberMin, regularMin, championMin, decayRate, tickRate } = require("./config.json");

// Create a new client instance
const client = new Client({ 
	intents: [
		Intents.FLAGS.GUILDS, 
		Intents.FLAGS.GUILD_MEMBERS, 
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS
	],
	partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

//create mysql2 pool
const pool = mysql.createPool({
	host: process.env.MYSQL_HOST,
	user: process.env.MYSQL_USER,
	database: process.env.MYSQL_DB,
	password: process.env.MYSQL_PASSWORD,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
});

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
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	const guild = interaction.guild;
	const member = interaction.member;

	const conn = await pool.getConnection();
	try{
		conn.query('UPDATE `member` SET `active` = 1 WHERE `guild_id` = ? AND `user_id` = ?;', [guild.id, member.id]);
	} finally{
		//release pool connection
		conn.release();
	}

	try {
		if(command.cooldown){
			const user = interaction.user;
			const cooldown = client.cooldowns.find(c => c.user == user.id && c.cmd == command.name);
			if(cooldown){
				const timeRemaining = cooldown.endTime - Date.now();
				if(timeRemaining > 60000){
					const minutes = Math.round(timeRemaining / 60000);
					interaction.reply(`You must wait ${minutes} more minutes before you can use this command again.`);
				} else {
					const seconds = Math.round(timeRemaining / 1000);
					interaction.reply(`You must wait ${seconds} more seconds before you can use this command again.`);
				}
			} else {
				await command.execute(interaction, pool);
				client.cooldowns.push({ 
					user: user.id, 
					cmd: command.name,
					endTime: Date.now() + command.cooldown
				});
				setTimeout(() => {
					for(const i in client.cooldowns){
						const obj = client.cooldowns[i];
						if(obj.user == user.id && obj.cmd == command.name) client.cooldowns.splice(i,1);
					}
				}, command.cooldown);
			}
		} else {
			await command.execute(interaction, pool);
		}
	} catch (error) {
		console.error(error);
		await interaction.reply({ 
			content: "There was an error while executing this command!",
			ephemeral: true 
		});
	}
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
		} else {
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
		}
	} finally{
		//release pool connection
		conn.release();
	}

	await guild.systemChannel.send("Meow! I'm Aineko. Thank you for adding me to your server.");
	console.log(`Added to server: ${guild.name}`);
}


client.on('messageCreate', async message => {
	if (message.partial) await message.fetch();

	//ignore dms
	if(message.channel.type == 'dm') return;

	if(!message.member) return;

	//ignore self
	if(message.member.id == client.user.id) return;

	const guild = message.guild;
	const member = message.member;

	const conn = await pool.getConnection();
	try{
		conn.query('UPDATE `member` SET `active` = 1 WHERE `guild_id` = ? AND `user_id` = ?;', [guild.id, member.id]);
	} finally{
		//release pool connection
		conn.release();
	}

	if(message.content.toLowerCase().includes('uwu')) message.channel.send('UwU');
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
					const curColorRoleId = curColorRoleDB[0][0].role_id;
					await member.roles.remove(curColorRoleId);

					//add color role to member
					await member.roles.add(colorRoleId);

					if(memberDB[0][0].activity_points < 4){
						await conn.query('UPDATE `member` SET `color_id` = ?, `activity_points` = 4 WHERE `guild_id` = ? AND `user_id` = ?;',
							[color, guild.id, member.id]);
					} else {
						await conn.query('UPDATE `member` SET `color_id` = ? WHERE `guild_id` = ? AND `user_id` = ?;',
							[color, guild.id, member.id]);
					}

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
		const guildDB = await conn.query('SELECT `welcome_message` FROM `guild` WHERE `guild_id` = ?;', 
			[member.guild.id]);
		if(!guildDB[0][0].welcome_message) return;
		await member.guild.systemChannel.send(`Welcome, ${member.toString()}. ${guildDB[0][0].welcome_message}`)
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



async function activityLoop(){
	const conn = await pool.getConnection();
	try{
		const guildsDB = await conn.query('SELECT * FROM `guild` WHERE `active` = 1;');
		for await(const guildDB of guildsDB[0]){
			const guild = await client.guilds.fetch(guildDB.guild_id);
			const membersDB = await conn.query('SELECT * FROM `member` where `guild_id` = ?;', [guild.id]);
			for await(const memberDB of membersDB[0]){
				const member = await guild.members.fetch(memberDB.user_id);
				
				const prevActivityPoints = memberDB.activity_points;
				let activityPoints = prevActivityPoints*decayRate;

				if(memberDB.active){
					activityPoints ++; 
					if(activityPoints < memberMin) activityPoints = memberMin;
				}

				if(member.roles.cache.has(guildDB.member_role_id) && activityPoints < lurkerMin ) await member.roles.remove(guildDB.member_role_id);
				if(!member.roles.cache.has(guildDB.regular_role_id) && activityPoints > regularMin) await member.roles.add(guildDB.regular_role_id);
				if(member.roles.cache.has(guildDB.regular_role_id) && activityPoints < regularMin) await member.roles.remove(guildDB.regular_role_id);
				if(!member.roles.cache.has(guildDB.champion_role_id) && activityPoints > championMin) await member.roles.add(guildDB.champion_role_id);
				if(member.roles.cache.has(guildDB.champion_role_id) && activityPoints < championMin) await member.roles.remove(guildDB.champion_role_id);

				await conn.query('UPDATE `member` SET `activity_points` = ?, `active` = 0 WHERE `guild_id` = ? AND `user_id` = ?;',
					[activityPoints, guild.id, member.id]);
			}
		}
	} finally{
		//release pool connection
		conn.release();
	}

	setTimeout(activityLoop, tickRate);
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
			if(guildDB[0].length < 1){
				guildCreate(guild);
			} else if(guildDB[0][0].active == 0){
				guildCreate(guild);
			} else {
				//guild exists in db but we still need to add any new members
				let members = await guild.members.fetch();
				members = [...members.values()];
				for await (const member of members){
					if(member.id == client.user.id) continue;
					conn.query('INSERT IGNORE INTO `user` (user_id, name) VALUES (?, ?);',
						[member.id, member.displayName]);
				}
			}
		});
	} finally{
		//release pool connection
		conn.release();
	}
	
	// const guild = await client.guilds.fetch('515742178216116226');
	// const channel = await guild.channels.fetch('910655271691505725');
	// const msg = await channel.messages.fetch('984218420163801198');
	// msg.edit(`React with 🔔 to recieve announcement pings.`);
	// 	msg.react('🎥');

	setTimeout(activityLoop, tickRate);
	//activityLoop();
	
	const startMsg = (stage == 'production') ? 'Aineko is ready!' : 'Aineko Beta is ready!';
	console.log(startMsg);
});




client.login(process.env.TOKEN);