const express = require('express');
const { Pool } = require('pg');
const client = require('prom-client');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

client.collectDefaultMetrics();

app.use(express.json());

app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.get('/catalogue', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, price FROM catalogue ORDER BY id');
    res.json({ message: 'Catalogue API', items: result.rows });
  } catch (err) {
    console.error('Failed to query catalogue', err);
    res.status(500).json({ message: 'Database error' });
  }
});

app.listen(port, () => {
  console.log(`Catalogue API listening on port ${port}`);
});
