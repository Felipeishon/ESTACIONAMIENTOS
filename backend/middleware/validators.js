const { body, validationResult } = require('express-validator');
const { checkUniqueness } = require('../utils/dbUtils');
const { validateRut, validateLicensePlate, validatePhoneNumber } = require('../utils/validators');

/**
 * Middleware que procesa los resultados de la validación de express-validator.
 * Si hay errores, envía una respuesta 400; de lo contrario, pasa al siguiente middleware.
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Formatea los errores en un objeto donde cada clave es el campo del formulario.
        const extractedErrors = {};
        errors.array().forEach(err => {
            extractedErrors[err.path] = err.msg;
        });
        // Se elimina el mensaje genérico "message" para enviar directamente el objeto
        // con los errores específicos de cada campo. Esto facilita que el frontend
        // muestre la información útil.
        return res.status(400).json({ errors: extractedErrors });
    }
    next();
};

/**
 * Cadena de validación y sanitización para el registro de un nuevo usuario.
 */
const registerUserChecks = [
    // 1. Nombre: Debe ser Nombre + Apellido
    body('name', 'Favor ingresar Nombre y Apellido (ej. Juan Pérez)').notEmpty().trim().matches(/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+$/).escape(),
    
    // 2. Correo: Debe ser dominio @iansa.cl
    body('email').notEmpty().withMessage('El correo electrónico es obligatorio.').isEmail({ host_whitelist: ['iansa.cl'] }).withMessage('Favor agregar el correo electrónico dominio @iansa.cl').normalizeEmail(),
    body('email').custom(async (email) => { // Esta validación de unicidad se mantiene separada para un mensaje más específico.
        if (!(await checkUniqueness('email', email))) {
            throw new Error('El correo electrónico ya está en uso');
        } return true;
    }),

    // 3. RUT: Formato completo y unicidad
    body('rut').notEmpty().withMessage('Favor ingresar el número de RUT completo').trim()
        .customSanitizer(value => validateRut(value)) // Sanitiza el RUT (ej. elimina puntos, guiones, formatea)
        .custom((sanitizedRut, { req }) => {
            if (!sanitizedRut) { // Si el sanitizador devuelve null, el formato es inválido
                throw new Error('El formato del RUT es inválido.');
            }
            req.body.rut = sanitizedRut; // Sobrescribe el RUT original con el sanitizado para consistencia
            return true;
        })
        .custom(async (sanitizedRut) => {
            if (!(await checkUniqueness('rut', sanitizedRut))) {
                throw new Error('El RUT ya está en uso');
            } return true;
        }),

    // 4. Teléfono: Formato completo con código de área
    body('phone_number').notEmpty().withMessage('Favor ingresar el número completo incluyendo el código área').trim()
        .custom((value) => {
            if (validatePhoneNumber(value) === null) {
                throw new Error('El formato del número de teléfono es inválido.');
            } return true;
        }),

    // 5. Patente: Formato completo y unicidad
    body('license_plate').notEmpty().withMessage('Favor ingresar el número de patente completa').trim()
        .customSanitizer(value => validateLicensePlate(value)) // Sanitiza la patente
        .custom((sanitizedPlate, { req }) => {
            if (!sanitizedPlate) { // Si el sanitizador devuelve null, el formato es inválido
                throw new Error('El formato de la patente es inválido.');
            }
            req.body.license_plate = sanitizedPlate; // Sobrescribe la patente original con la sanitizada
            return true;
        })
        .custom(async (sanitizedPlate) => {
            if (!(await checkUniqueness('license_plate', sanitizedPlate))) {
                throw new Error('La patente ya está en uso');
            } return true;
        }),

    // 6. Contraseña: Requisitos de fortaleza
    body('password').notEmpty().withMessage('La contraseña es obligatoria.').isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 })
        .withMessage('La contraseña debe tener al menos 8 caracteres, incluyendo una mayúscula, una minúscula, un número y un símbolo.'),
];

/**
 * Cadena de validación y sanitización para la actualización de un usuario.
 */
const updateUserChecks = [
    body('name', 'El nombre debe ser texto').optional().isString().trim().escape(),
    
    // Se aplica el sanitizador y luego se valida que el resultado no sea nulo (si el campo existe)
    body('rut').optional().trim().customSanitizer(value => validateRut(value))
        .custom((sanitizedRut, { req }) => {
            if (req.body.rut && !sanitizedRut) { // Si se proveyó un RUT pero el formato es inválido
                throw new Error('El formato del RUT es inválido.');
            }
            return true;
        })
        .custom(async (sanitizedRut, { req }) => {
            if (sanitizedRut && !(await checkUniqueness('rut', sanitizedRut, req.params.id))) {
                throw new Error('El RUT ya está en uso por otro usuario');
            }
        }),

    // Misma lógica para la patente
    body('license_plate').optional().trim().customSanitizer(value => validateLicensePlate(value))
        .custom((sanitizedPlate, { req }) => {
            if (req.body.license_plate && !sanitizedPlate) {
                throw new Error('El formato de la patente es inválido.');
            }
            return true;
        })
        .custom(async (sanitizedPlate, { req }) => {
            if (sanitizedPlate && !(await checkUniqueness('license_plate', sanitizedPlate, req.params.id))) {
                throw new Error('La patente ya está en uso por otro usuario');
            }
        }),

    // Corrección para el número de teléfono
    body('phone_number').optional({ checkFalsy: true }).trim()
        .custom(value => validatePhoneNumber(value) !== null)
        .withMessage('El teléfono debe tener un formato internacional válido (ej: +56912345678).'),

    body('role', 'El rol debe ser \'user\' o \'admin\'').optional().isIn(['user', 'admin']),
];

module.exports = {
    handleValidationErrors,
    registerUserChecks,
    updateUserChecks,
};