const express = require('express');
const cors = require('cors');

console.log('Creating minimal Express app...');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/test', (req, res) => {
  res.json({ message: 'Reports API test endpoint' });
});

console.log('Exporting minimal app:', typeof app);
module.exports = app;