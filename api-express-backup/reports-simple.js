const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Reports API is working' });
});

// Placeholder for PDF endpoint
app.get('/pdf', (req, res) => {
  res.status(501).json({ error: 'PDF reports not yet implemented' });
});

// Placeholder for CSV endpoint
app.get('/csv', (req, res) => {
  res.status(501).json({ error: 'CSV reports not yet implemented' });
});

module.exports = app;