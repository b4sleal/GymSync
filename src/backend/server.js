const path = require('path');
const express = require('express');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('./config/db');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend'), { index: false }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/workouts', require('./routes/workoutRoutes'));
app.use('/api/schedules', require('./routes/scheduleRoutes'));
app.use('/api/social', require('./routes/socialRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/assistant', require('./routes/assistantRoutes'));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok'});
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/landing.html'));
});

const PORT = process.env.PORT || 8000;


if (require.main == module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`GymSync is running on http://localhost:${PORT}`);
    });
}

module.exports = app;

