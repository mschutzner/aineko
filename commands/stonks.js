const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, Image } = require('canvas');
const { unixToMysqlDatetime } = require("../utils.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stonks')
		.setDescription('Track your stonks over time!')
		.addNumberOption(option =>
			option.setName('hours')
				.setDescription('Sets how many hours ago you want the graph to display.')
				.setRequired(true)
		),
	async execute(interaction, pool) {
		const conn = await pool.getConnection();
		try{

			const member = interaction.member;
			const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [member.id]);
			
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
	
			const hours =  interaction.options.getNumber('hours')
			const timeScale = hours*3600000;
			const curTime = new Date().getTime();
			const startTime = curTime - timeScale;

			ctx.font = '15px Helvetica';
			for ( let i = 0; i < 7; i++){
				const time = hours-hours/6*i;
				ctx.fillText(`t-${time.toFixed(2)}`, 5+i*100, 500);
			}
			
			const userScritchDB = await conn.query('SELECT * FROM `user_scritch` WHERE `user_id` = ?;', [member.id]);
			
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

				ctx.lineTo(630, y);
				ctx.stroke();

				attachment = new AttachmentBuilder(canvas.toBuffer(), { name: "scritch-graph.png"});
				await interaction.reply({ files: [attachment] });
			}
		} finally{
			//release pool connection
			conn.release();
		}
	},
}