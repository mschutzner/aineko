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
    }
}