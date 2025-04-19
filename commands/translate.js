const { SlashCommandBuilder  } = require('discord.js');
const { getKeyByValue, capitalizeFirstLetter } = require('../utils');
const translator = require("open-google-translator");
const languages = translator.supportedLanguages();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('translate')
		.setDescription('Translate text from one language to another.')
		.addStringOption(option =>
			option
				.setName('text')
				.setDescription('The text to translate.')
				.setMaxLength(750)
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('from')
				.setDescription('The language to translate from.')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('to')
				.setDescription('The language to translate to. Default is English.')
				.setRequired(false)),
	catId: 15,
	async execute(interaction) {		
		const text = interaction.options.getString('text');
		let fromInput = interaction.options.getString('from').toLowerCase();
		let toInput = interaction.options.getString('to') ? interaction.options.getString('to').toLowerCase() : 'en';
		
		let  from, to;

		if(fromInput in languages){
			from = fromInput;
			fromInput = languages[fromInput];	
		} else {
			switch(fromInput){
				case 'chinese':
					from = 'zh-cn';
					fromInput = 'Chinese';
					break;
				case 'mandarin':
					from = 'zh-cn';
					fromInput = 'Chinese';
					break;
				default:
					fromInput = capitalizeFirstLetter(fromInput)
					from = getKeyByValue(languages, fromInput);;
					break;
			}
		}
		if(!from) return await interaction.reply({content: 'Invalid from language. Please use a valid language name or abbreviation.', ephemeral: true});

		if(toInput in languages){
			to = toInput;
			toInput = languages[toInput];
		} else {
			switch(toInput){
				case 'chinese':
					to = 'zh-cn';
					toInput = 'Chinese';
					break;
				case 'mandarin':
					to = 'zh-cn';
					toInput = 'Chinese';
					break;
				default:
					toInput = capitalizeFirstLetter(toInput);
					to = getKeyByValue(languages, toInput);
					break;
					
			}	
		}
		if(!to) return await interaction.reply({content: 'Invalid to language. Please use a valid language name or abbreviation.', ephemeral: true});

		translator
			.TranslateLanguageData({
				listOfWordsToTranslate: [text],
				fromLanguage: from,
				toLanguage: to,
			})
			.then(async (data) => {
				await interaction.reply(`## Translation from ${fromInput}
${text}
## Translation to ${toInput}
${data[0].translation}`);
			});
	},
}