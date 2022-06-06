const { SlashCommandBuilder } = require('@discordjs/builders')

const catfacts = [
			'I stole this list of facts from YAGPDB.xyz',
			'Every year, nearly four million cats are eaten in Asia.',
			'In tigers and tabbies, the middle of the tongue is covered in backward-pointing spines, used for breaking off and gripping meat.',
			'Cats are often lactose intolerant, so stop givin\' them milk!',
			'When cats are first born, they have blue eyes. Over time, the colour changes.',
			'In Ancient Egypt, civilians would suffer a severe punishment if they hurt a cat.',
			'The normal body temperature of a cat is between 100.5 ° and 102.5 °F. A cat is sick if its temperature goes below 100 ° or above 103 °F.',
			'Cat urine glows under a black light.',
			'A cat\'s nose is ridged with a unique pattern, just like a human fingerprint',
			'Unlike dogs, cats have no sense of what is sweet. No wonder they never seem happy with cakes!',
			'\'Mau\' is the Egyptian word for cat, and the oldest surviving cat breed is known as the Egyptian Mau, translated to mean the \'Egyptian cat\'.',
			'There are about 70 different cat breeds and a staggering 500 million pet cats in the world.',
			'In the 1950\'s, Disneyland bought several cats in order to hunt mice at night. There are now more than 200 felines at the amusement park.',
			'In Holland\'s embassy in Moscow, Russia, the staff noticed that the two Siamese cats kept meowing and clawing at the walls of the building. Their owners finally investigated, thinking they would find mice. Instead, they discovered microphones hidden by Russian spies. The cats heard the microphones when they turned on.',
			'A cat’s jaw can’t move sideways, so a cat can’t chew large chunks of food.',
			'Kittens sleep even more often, since growth hormones are released when they are napping.',
			'If you put a collar on your cat, make sure it\'s not too tight. You should be able to fit two fingers between the collar and your cat\'s neck, or you could risk strangling it.',
			'The saying, \'A cat always lands on its feet\' isn\'t just an old myth. Some cats have fallen more than 320 metres onto concrete and come away unharmed.',
			'Cats which have blue eyes for the duration of their lives are likely to be deaf.',
			'Cats can run 3 mph faster than Usain Bolt.',
			'Approximately 40,000 people are bitten by cats in the U.S. annually.',
			'The most popular pedigreed cat is the Persian cat, followed by the Main Coon cat and the Siamese cat.',
			'The smallest wildcat today is the Black-footed cat. The females are less than 20 inches (50 cm) long and can weigh as little as 2.5 lbs (1.2 kg).',
			'Ancient Egyptians shaved off their eyebrows to mourn the death of their cats.',
			'The first commercially cloned pet was a cat named "Little Nicky." He cost his owner $50,000, making him one of the most expensive cats ever.',
			'Over her lifetime, a cat called Dusty had a total of 420 kittens.',
			'The group of words associated with cat (catt, cath, chat, katze) stem from the Latin catus, meaning domestic cat, as opposed to feles, or wild cat.',
			'Cats can hear the ultrasonic noises that rodents (and dolphins) make to communicate.',
			'Kittens start to dream when they’re about a week old.',
			'Cats have 1,000 times more data storage than an iPad.',
			'The world\'s richest cat is worth $13 million after his human passed away and left her fortune to him.',
			'The group of words associated with cat (catt, cath, chat, katze) stem from the Latin catus, meaning domestic cat, as opposed to feles, or wild cat.']

module.exports = {
	data: new SlashCommandBuilder()
		.setName('catfacts')
		.setDescription('The best true facts about cats.'),
	async execute(interaction) {
		await interaction.reply(catfacts[Math.floor(Math.random() * catfacts.length)])
	},
}
