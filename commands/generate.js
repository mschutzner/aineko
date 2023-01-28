require('dotenv').config();
const { Configuration, OpenAIApi } = require("openai");
const { AttachmentBuilder } = require('discord.js');

const { SlashCommandBuilder } = require('@discordjs/builders')

module.exports = {
	data: new SlashCommandBuilder()
        .setName('generate')
        .setDescription('Use AI to draw am image based on a text input.')
        .addStringOption(option => option.setName('text')
            .setDescription('Describe the image to be generated.')
            .setRequired(true)),
  async execute(interaction, pool) {
    const member = interaction.member;
    const text = interaction.options.getString('text');
    const conn = await pool.getConnection();
		try{
      const userDB = await conn.query('SELECT * FROM `user` WHERE `user_id` = ?;', [interaction.user.id]);
      
      if(userDB[0][0].scritch_bucks < 100){
        return interaction.reply('You do not have enough scritch bucks to generate an image. It costs 100 per image');
      }

      const msg = await interaction.reply({ content: `Would you like to spend 100 to generate an image from the text prompt *"${text}"*?`,
        fetchReply: true
      });
      msg.react("👍");
      
      const filter = (reaction, user) => {
        return reaction.id = '1038276972129824909' && user.id === interaction.user.id;
      };
      
      msg.awaitReactions({ filter, max: 1 })
        .then(async collected => {
          const waitingmsg = await interaction.channel.send('Generating image. This could take some time...');

          const newScritchBucks = userDB[0][0].scritch_bucks - 100;
          const highestScritchBucks = (newScritchBucks > userDB[0][0].scritch_bucks_highscore) ? newScritchBucks : userDB[0][0].scritch_bucks_highscore;
          await conn.query('UPDATE `user` SET `scritch_bucks` = ?, `scritch_bucks_highscore` = ? WHERE `user_id` = ?;',
            [newScritchBucks, highestScritchBucks, member.id]);
          conn.query('INSERT INTO `user_scritch` (`user_id`, `amount`, `user_name`) VALUES (?, ?, ?);', 
            [member.id, newScritchBucks, member.user.username]);

          const configuration = new Configuration({
            apiKey: process.env.OPENAI_API_KEY,
          });
          const openai = new OpenAIApi(configuration);
          const response = await openai.createImage({
            prompt: text,
            n: 1,
            size: "1024x1024",
          });

          msg.delete();
          waitingmsg.delete();

          const attachment = new AttachmentBuilder(response.data.data[0].url, { name: 'openai-response.png' });
          await interaction.channel.send({content: `<@${member.id}> generated *"${text}"*`, files: [attachment]});
        })

  } finally{
			//release pool connection
			conn.release();
		}
  }
}