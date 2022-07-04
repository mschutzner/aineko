const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '..', '.env') });
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
	host: process.env.MYSQL_HOST,
	user: process.env.MYSQL_USER,
	database: process.env.MYSQL_DB,
	password: process.env.MYSQL_PASSWORD,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
});

async function downtime(){
    const conn = await pool.getConnection();
    try{
        await conn.query('UPDATE `guild` SET `online` = ?;', [0]);
    } finally{
        conn.release();
    }
}

downtime();