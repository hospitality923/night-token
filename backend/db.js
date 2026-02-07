const { Pool } = require('pg');

// These variables match the ones in your docker-compose.yml
const pool = new Pool({
  user: process.env.DB_USER,
  host: 'db', // This matches the service name in docker-compose
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
