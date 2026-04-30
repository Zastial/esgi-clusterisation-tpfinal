const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/catalogue', (req, res) => {
  res.json({ message: 'Catalogue API', items: ['item1', 'item2', 'item3'] });
});

app.listen(port, () => {
  console.log(`Catalogue API listening on port ${port}`);
});