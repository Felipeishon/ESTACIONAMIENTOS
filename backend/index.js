const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const reservationsRouter = require('./routes/reservations');
const parkingRouter = require('./routes/parking');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');

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
app.use('/api/users', usersRouter);

// Ruta para servir el index.html para cualquier ruta no manejada por API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Middleware de manejo de errores global. Debe ir después de todas las rutas.
app.use((err, req, res, next) => {
    console.error(`[Global Error Handler] ${req.method} ${req.path}`, err);

    // Si el error tiene un statusCode, es un error controlado (ApiError)
    const statusCode = err.statusCode || 500;
    // Para errores 500, mostramos un mensaje genérico por seguridad.
    const message = err.statusCode ? err.message : 'Ocurrió un error inesperado en el servidor.';

    res.status(statusCode).json({ message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
