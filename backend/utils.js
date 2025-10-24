/**
 * Crea un objeto de error estandarizado para la API.
 * @param {string} message - El mensaje de error.
 * @param {number} statusCode - El código de estado HTTP.
 * @returns {Error} - Un objeto Error con una propiedad `statusCode`.
 */
const createApiError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

/**
 * Envuelve una función de ruta asíncrona para capturar errores y pasarlos a Express.
 * @param {Function} fn - La función de ruta asíncrona (req, res, next).
 * @returns {Function} Una nueva función de ruta con manejo de errores.
 */
const asyncWrapper = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    createApiError,
    asyncWrapper,
};