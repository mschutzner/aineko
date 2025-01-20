require('dotenv').config();
const API_KEY = process.env.OMDB_API_KEY;

async function handleFetch(searchTerm){
    const url = `http://www.omdbapi.com/?apikey=${API_KEY}&s=${searchTerm}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log(data.Search);
}

handleFetch('The Matrix reloaded 2');