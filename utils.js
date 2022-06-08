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
    }
}