const { Client } = require('pg');

const client = new Client({
  user: 'venus',
  host: 'localhost',
  database: 'meditrace',
  password: 'password123',
  port: 5432,
});

client.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch(err => console.error(err));
