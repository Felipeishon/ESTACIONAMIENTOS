// backend/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Ocurrió un error inesperado en el servidor.';

    res.status(statusCode).json({
        message,
        // Opcional: en desarrollo, puedes enviar más detalles
        ...(process.env.NODE_ENV === 'development' && { error: err.stack }),
    });
};

module.exports = errorHandler;
