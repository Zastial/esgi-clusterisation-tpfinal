const express = require('express');
const { Pool } = require('pg');
const client = require('prom-client');

const app = express();
const port = process.env.PORT || 3001;

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

app.get('/orders', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, item, quantity, created_at FROM orders ORDER BY id DESC LIMIT 50'
    );
    res.json({ message: 'Orders API is healthy', orders: result.rows });
  } catch (err) {
    console.error('Failed to query orders', err);
    res.status(500).json({ message: 'Database error' });
  }
});

app.post('/orders', async (req, res) => {
  const { item, quantity } = req.body || {};
  if (!item) {
    return res.status(400).json({ message: 'item is required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO orders (item, quantity) VALUES ($1, $2) RETURNING id, item, quantity, created_at',
      [item, quantity || 1]
    );
    res.status(201).json({ message: 'Order created', order: result.rows[0] });
  } catch (err) {
    console.error('Failed to insert order', err);
    res.status(500).json({ message: 'Database error' });
  }
});

app.listen(port, () => {
  console.log(`Orders API listening on port ${port}`);
});
