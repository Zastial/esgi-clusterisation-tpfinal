const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.post('/orders', (req, res) => {
  const order = req.body;
  // Simulate processing
  res.json({ message: 'Order created', order: order, id: Date.now() });
});

app.listen(port, () => {
  console.log(`Orders API listening on port ${port}`);
});