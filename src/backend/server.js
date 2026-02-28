const path = require('path');
const express = require('express');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('./config/db');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend'), { index: false }));

app.use('/api/auth', require('./routes/authRoutes'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/landing.html'));
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`GymSync is running on http://localhost:${PORT}`);
});