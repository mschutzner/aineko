const Discord = require('discord.js');
const Canvas = require('canvas');
const PerspT = require('perspective-transform');
const Chroma = require('chroma-js');

const { SlashCommandBuilder } = require('@discordjs/builders')

module.exports = {
	data: new SlashCommandBuilder()
        .setName('bob')
        .setDescription('Bob Ross paints a pretty little profile picture.')
        .addUserOption(option => option.setName('user')
            .setDescription('The user to be painted.')),
    async execute(interaction) {
        const size = 256;
        const canvas = Canvas.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const user = (interaction.options.getMember('user')) ? interaction.options.getMember('user') : interaction.user;
        
        const background = await Canvas.loadImage('/aineko/images/canvas.png');
        const pfp = await Canvas.loadImage(user.displayAvatarURL({format:'png'}));
        const overlay = await Canvas.loadImage('/aineko/images/bob.png');
        
        ctx.fillStyle = '#e4e4e9';
        ctx.fillRect(0,0,size,size);
        ctx.drawImage(pfp, 0 ,0, size, size);
        var imageData = ctx.getImageData(0, 0, size, size);
        var pixData = imageData.data;
        ctx.clearRect(0, 0, size, size);
        
        ctx.drawImage(background, 0 ,0, size, size);
        
        const width = size;
        const height = size;
        const radius = 3;
        const intensity = 30;
        
        const srcCorners = [0, 0, width, 0, width, height, 0, height];
        const dstCorners = [-19, 23, 152, 32, 190, 176, 3, 179];
        const perspT = PerspT(srcCorners, dstCorners);
        
        var pixelIntensityCount = [];

        //var destImageData = ctx.createImageData(width, height),
        //    destPixData = destImageData.data;
            
        var intensityLUT = [],
            rgbLUT = [];

        for (var y = 0; y < height; y++) {
            intensityLUT[y] = [];
            rgbLUT[y] = [];
            for (var x = 0; x < width; x++) {
                var idx = (y * width + x) * 4,
                    r = pixData[idx],
                    g = pixData[idx + 1],
                    b = pixData[idx + 2],
                    avg = (r + g + b) / 3;

                intensityLUT[y][x] = Math.round((avg * intensity) / 255);
                rgbLUT[y][x] = {
                    r: r,
                    g: g,
                    b: b
                };
            }
        }


        for (y = 0; y < height; y++) {
            for (x = 0; x < width; x++) {

                pixelIntensityCount = [];

                // Find intensities of nearest pixels within radius.
                for (var yy = -radius; yy <= radius; yy++) {
                    for (var xx = -radius; xx <= radius; xx++) {
                        if (y + yy > 0 && y + yy < height && x + xx > 0 && x + xx < width) {
                            var intensityVal = intensityLUT[y + yy][x + xx];

                            if (!pixelIntensityCount[intensityVal]) {
                                pixelIntensityCount[intensityVal] = {
                                    val: 1,
                                    r: rgbLUT[y + yy][x + xx].r,
                                    g: rgbLUT[y + yy][x + xx].g,
                                    b: rgbLUT[y + yy][x + xx].b
                                }
                            } else {
                                pixelIntensityCount[intensityVal].val++;
                                pixelIntensityCount[intensityVal].r += rgbLUT[y + yy][x + xx].r;
                                pixelIntensityCount[intensityVal].g += rgbLUT[y + yy][x + xx].g;
                                pixelIntensityCount[intensityVal].b += rgbLUT[y + yy][x + xx].b;
                            }
                        }
                    }
                }

                pixelIntensityCount.sort(function (a, b) {
                    return b.val - a.val;
                });

                var curMax = pixelIntensityCount[0].val;
                
                //var dIdx = (y * width + x) * 4;
                //destPixData[dIdx] = ~~ (pixelIntensityCount[0].r / curMax);
                //destPixData[dIdx + 1] = ~~ (pixelIntensityCount[0].g / curMax);
                //destPixData[dIdx + 2] = ~~ (pixelIntensityCount[0].b / curMax);
                //destPixData[dIdx + 3] = 255;
                
                var color = Chroma(pixelIntensityCount[0].r / curMax,
                pixelIntensityCount[0].g / curMax,
                pixelIntensityCount[0].b / curMax);
                ctx.fillStyle = color.hex();
                
                var dstPt = perspT.transform(x, y);
                ctx.fillRect(dstPt[0],dstPt[1],1,1);
            }
        }

        //ctx.putImageData(destImageData, 0, 0);
        
        
        ctx.drawImage(overlay, 0 ,0, size, size);
        
        const attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'bob' + user.displayName + '.jpg');
        
        interaction.reply({files: [attachment]});
    }
}