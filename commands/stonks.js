const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, Image } = require('canvas');
const { unixToMysqlDatetime } = require("../utils.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stonks')
		.setDescription('Track your stonks over time!')
		.addSubcommand(subcommand =>
			subcommand
				.setName('hours')
				.setDescription('View stonks graph using hours ago')
				.addNumberOption(option =>
					option.setName('start')
						.setDescription('How many hours ago to start the graph from (0 for oldest entry)')
						.setRequired(true))
				.addNumberOption(option =>
					option.setName('end')
						.setDescription('How many hours ago to end the graph (defaults to now)')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('timestamp')
				.setDescription('View stonks graph using timestamps')
				.addNumberOption(option =>
					option.setName('start')
						.setDescription('Unix timestamp to start the graph from (0 for oldest entry)')
						.setRequired(true))
				.addNumberOption(option =>
					option.setName('end')
						.setDescription('Unix timestamp to end the graph (defaults to now)')
						.setRequired(false))),
	async execute(interaction, pool) {
		const conn = await pool.getConnection();
		try {
			const member = interaction.member;
			const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [member.id]);

			if(userDB[0].length == 0){
				return await interaction.reply({ 
					content: 'You weren\'t found in the database.',
					ephemeral: true 
				});
			}

			const userScritchDB = await conn.query('SELECT * FROM `user_scritch` WHERE `user_id` = ?;', [member.id]);

			if(userScritchDB[0].length == 0){
				return await interaction.reply({ 
					content: 'You weren\'t found in the database.',
					ephemeral: true 
				});
			}
			
			const canvas = createCanvas(720, 540);
			const ctx = canvas.getContext('2d');

			ctx.fillStyle = '#0f0';
			ctx.strokeStyle = '#0f0';
			ctx.lineWidth = 2;

			const scritchGraph = await loadImage("images/scritch-graph.png");
			ctx.drawImage(scritchGraph, 0, 0);		

			ctx.font = '20px Helvetica';
			ctx.fillText(userDB[0][0].scritch_bucks_highscore, 150, 40);

			ctx.font = '20px Helvetica';
			ctx.fillText(userDB[0][0].scritch_bucks, 565, 40);
	
			const curTime = new Date().getTime();
			let startTime, endTime, timeScale, startHours, endHours;

			if (interaction.options.getSubcommand() === 'hours') {
				startHours = interaction.options.getNumber('start');
				endHours = interaction.options.getNumber('end') || 0;
				
				// Validate hours
				if (startHours < 0 || endHours < 0) {
					return await interaction.reply({ 
						content: 'Hours cannot be negative. Please provide positive values.',
						ephemeral: true 
					});
				}

				// If startHours is 0, get hours since oldest entry
				if (startHours === 0) {
					startHours = (curTime - userScritchDB[0][0].timestamp.getTime()) / 3600000;
				}
				
				if (endHours >= startHours) {
					return await interaction.reply({ 
						content: 'Start time must be earlier than end time. Please provide a larger number for start hours than end hours.',
						ephemeral: true 
					});
				}
				
				startTime = curTime - (startHours * 3600000);
				endTime = curTime - (endHours * 3600000);
				timeScale = (startHours - endHours) * 3600000;
			} else {
				let startTimestamp = interaction.options.getNumber('start');
				let endTimestamp = interaction.options.getNumber('end');
				
				// Validate timestamps
				if (startTimestamp < 0) {
					return await interaction.reply({ 
						content: 'Start timestamp cannot be negative. Please provide a valid Unix timestamp.',
						ephemeral: true 
					});
				}
				// If startHours is 0, get hours since oldest entry
				if (startTimestamp === 0) {
					startTimestamp = userScritchDB[0][0].timestamp.getTime() / 1000;
				}
				
				if (endTimestamp && endTimestamp < 0) {
					return await interaction.reply({ 
						content: 'End timestamp cannot be negative. Please provide a valid Unix timestamp.',
						ephemeral: true 
					});
				}

				const currentUnixTime = Math.floor(curTime / 1000);
				if (startTimestamp > currentUnixTime) {
					return await interaction.reply({ 
						content: 'Start timestamp cannot be in the future.',
						ephemeral: true 
					});
				}
				
				if (endTimestamp && endTimestamp > currentUnixTime) {
					return await interaction.reply({ 
						content: 'End timestamp cannot be in the future.',
						ephemeral: true 
					});
				}
				
				startTime = startTimestamp * 1000; // Convert to milliseconds
				endTime = endTimestamp 
						? endTimestamp * 1000 
						: curTime;
				
				if (startTime >= endTime) {
					return await interaction.reply({ 
						content: 'Start time must be earlier than end time. Please provide a smaller timestamp for start than end.',
						ephemeral: true 
					});
				}
				
				timeScale = endTime - startTime;
				// Calculate hours for timestamp subcommand
				startHours = (curTime - startTime) / 3600000;
				endHours = (curTime - endTime) / 3600000;
			}

			ctx.font = '15px Helvetica';
			for (let i = 0; i < 7; i++) {
				const time = startHours - ((startHours - endHours)/6 * i);
				const timeLabel = `t-${time.toFixed(2)}`;
				ctx.fillText(timeLabel, 5+i*100, 500);
			}
			
			ctx.beginPath();
			ctx.moveTo(30, 270);

			if(userScritchDB[0].length == 0){
				ctx.lineTo(630, 270);
				ctx.stroke();

				const scale = 32;
			} else {
				let startScritch = 100;
				let largestDifference = 0;
				for (const scritch of userScritchDB[0]){
					if(scritch.timestamp.getTime() < startTime){
						startScritch = scritch.amount;
					} else {
						const difference = Math.abs(startScritch - scritch.amount);
						largestDifference = (difference > largestDifference) ? difference : largestDifference;
					}
				}

				const xUnits = 600/timeScale;
				let prevTime = startTime;

				let scale = largestDifference * 1.1;
				if(scale < 32/1.1) scale = 32;
				const tickScale = largestDifference/3;
				const yUnits = 210/scale;
				let prevAmount = startScritch;
				
				let firstTick = largestDifference+startScritch;
				ctx.font = '15px Helvetica';
				for ( let i = 0; i < 7; i++){
					ctx.fillText(Math.round(firstTick-tickScale*i), 645, 83+64*i);
				}

				let x = 30;
				let y = 270
				let nextX;
				let nextY;

				for(let i = 0; i < userScritchDB[0].length; i++){
					if(userScritchDB[0][i].timestamp.getTime() < startTime) continue;
					if(userScritchDB[0][i].timestamp.getTime() > endTime) break;  // Stop if we exceed end time
					
					let nextTimestamp = userScritchDB[0][i].timestamp.getTime();
					nextX = x + (nextTimestamp - prevTime) * xUnits;
					prevTime = nextTimestamp;
					ctx.lineTo(Math.round(nextX), Math.round(y));
					x = nextX;

					nextY = y - (userScritchDB[0][i].amount - prevAmount) * yUnits;
					prevAmount = userScritchDB[0][i].amount;
					ctx.lineTo(Math.round(x), Math.round(nextY));
					y = nextY;
				}

				// Only extend to the end time, not full width
				let finalX = x + (endTime - prevTime) * xUnits;
				finalX = Math.min(finalX, 630);  // Cap at 630 to stay within graph
				ctx.lineTo(finalX, y);
				ctx.stroke();

				attachment = new AttachmentBuilder(canvas.toBuffer(), { name: "scritch-graph.png"});
				await interaction.reply({ files: [attachment] });
			}
		} finally {
			conn.release();
		}
	},
}