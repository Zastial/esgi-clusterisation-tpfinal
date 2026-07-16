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

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Nombre total de requêtes HTTP',
  labelNames: ['method', 'route', 'status_code'],
});

app.use(express.json());

// Log structuré + métriques par requête (exclut /healthz pour ne pas noyer les
// logs avec les pings de la liveness probe toutes les 10s).
app.use((req, res, next) => {
  if (req.path === '/healthz') return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route ? req.route.path : req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
    console.log(JSON.stringify({
      level: 'info',
      msg: 'request',
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Math.round(durationSeconds * 1000),
      ts: new Date().toISOString(),
    }));
  });
  next();
});

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
