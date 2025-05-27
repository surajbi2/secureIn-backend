import mysql from 'mysql2';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'securein_db',
  timezone: 'Asia/Kolkata', // Set timezone to IST
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Debug connection and timezone settings
pool.on('connection', function (connection) {
  connection.query('SELECT @@session.time_zone, @@global.time_zone', (error, results) => {
    if (error) {
      console.error('Error checking timezone:', error);
    } else {
      console.log('MySQL Timezone Settings:', results[0]);
    }
  });
});

const promisePool = pool.promise();

export default promisePool;
