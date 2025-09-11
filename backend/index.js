const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const reservationsRouter = require('./routes/reservations');
const parkingRouter = require('./routes/parking');
const authRouter = require('./routes/auth');

const app = express();
const PORT = config.port;

app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/api/config', (req, res) => {
  res.json({
    allowedEmailDomain: config.allowedEmailDomain
  });
});

app.use('/api/auth', authRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/parking-spots', parkingRouter);

// Ruta para servir el index.html para cualquier ruta no manejada por API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
