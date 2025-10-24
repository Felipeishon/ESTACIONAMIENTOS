/**
 * Valida un RUT chileno.
 * Limpia el formato (puntos y guion) y verifica el dígito verificador.
 * @param {string} rut - El RUT a validar.
 * @returns {string|null} El RUT limpio (ej: '12345678-9') o null si es inválido.
 */
function validateRut(rut) {
    if (!rut || typeof rut !== 'string') return null;

    const cleanRut = rut.replace(/[\.\-]/g, '').toLowerCase();
    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1);

    if (!/^\d+$/.test(body)) return null;

    let sum = 0;
    let multiplier = 2;

    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body.charAt(i), 10) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const calculatedDv = 11 - (sum % 11);
    let expectedDv;

    if (calculatedDv === 11) {
        expectedDv = '0';
    } else if (calculatedDv === 10) {
        expectedDv = 'k';
    } else {
        expectedDv = calculatedDv.toString();
    }

    return dv === expectedDv ? `${body}-${dv}` : null;
}

/**
 * Valida un número de teléfono chileno.
 * Acepta el formato internacional E.164 (ej: +56912345678).
 * @param {string} phone - El número de teléfono.
 * @returns {string|null} El número validado o null si es inválido.
 */
function validatePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return null;
    // Regex para formato E.164: un '+' seguido de 1 a 15 dígitos.
    const phoneRegex = /^\+\d{1,15}$/;
    return phoneRegex.test(phone) ? phone : null;
}

/**
 * Valida una patente vehicular chilena.
 * Acepta formatos como 'ABCD12' o 'AB-CD-12'.
 * @param {string} plate - La patente a validar.
 * @returns {string|null} La patente en formato estándar 'AB - CD - 12' o null si es inválida.
 */
function validateLicensePlate(plate) {
    if (!plate || typeof plate !== 'string') return null;
    const cleanPlate = plate.replace(/[\s\-]/g, '').toUpperCase();
    const plateRegex = /^[A-Z]{4}\d{2}$/;
    if (!plateRegex.test(cleanPlate)) return null;
    // Se retorna la patente limpia y sin formato para asegurar consistencia en la DB.
    return cleanPlate;
}

/**
 * Valida la fortaleza de una contraseña.
 * Mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número, 1 símbolo.
 * @param {string} password - La contraseña a validar.
 * @returns {string|null} La contraseña si es válida, o null si no lo es.
 */
function validatePassword(password) {
    if (!password || password.length < 8) return null;
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password) ? password : null;
}

module.exports = {
    validateRut,
    validatePhoneNumber,
    validateLicensePlate,
    validatePassword,
};