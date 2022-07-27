module.exports = {
    sleep(m){ return new Promise(r => setTimeout(r, m))},
    randInt(max, min){
        min = min || 0;
        return min + Math.round(Math.random() * (max - min));
    },
    async getJSONResponse(body) {
        let fullBody = '';
        for await (const data of body) {
            fullBody += data.toString();
        }
        return JSON.parse(fullBody);
    },
    shuffle(array){
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    },
    getEmojiIdByNumber(int){
        let emoji;
        switch(int){
            case 0:
                emoji = '<:zero:1000499679743709335>';
            break;
            case 1:
                emoji = '<:one:1000499606918017034>';
            break;
            case 2:
                emoji = '<:two:1000499696080519228>';
            break;
            case 3:
                emoji = '<:three:1000499706205581423>';
            break;
            case 4:
                emoji = '<:four:1000499714598387863>';
            break;
            case 5:
                emoji = '<:five:1000499728317952010>';
            break;
            case 6:
                emoji = '<:six:1000499736949829632>';
            break;
            case 7:
                emoji = '<:seven:1000499752993042532>';
            break;
            case 8:
                emoji = '<:eight:1000499761977233448>';
            break;
            case 9:
                emoji = '<:nine:1000499776204312726>';
            break;
        }
        return emoji;
    },
    getEmojiByNumber(int){
        let reaction;
        switch(int){
            case 0:
                reaction = '0️⃣';
            break;
            case 1:
                reaction = '1️⃣';
            break;
            case 2:
                reaction = '2️⃣';
            break;
            case 3:
                reaction = '3️⃣';
            break;
            case 4:
                reaction = '4️⃣';
            break;
            case 5:
                reaction = '5️⃣';
            break;
            case 6:
                reaction = '6️⃣';
            break;
            case 7:
                reaction = '7️⃣';
            break;
            case 8:
                reaction = '8️⃣';
            break;
            case 9:
                reaction = '9️⃣';
            break;
        }
        return reaction;
    },
    getNumberByEmoji(emoji){
        let item;
        switch(emoji){
            case '0️⃣':
                item = 0;
            break;
            case '1️⃣':
                item = 1;
            break;
            case '2️⃣':
                item = 2;
            break;
            case '3️⃣':
                item = 3;
            break;
            case '4️⃣':
                item = 4;
            break;
            case '5️⃣':
                item = 5;
            break;
            case '6️⃣':
                item = 6;
            break;
            case '7️⃣':
                item = 7;
            break;
            case '8️⃣':
                item = 8;
            break;
            case '9️⃣':
                item = 9;
            break;
        }
        return item;
    },
}