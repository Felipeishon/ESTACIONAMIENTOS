const db = require('./db');

/**
 * Verifica si un valor es único en una columna de una tabla específica.
 * Puede excluir un ID específico de la búsqueda (útil para actualizaciones).
 * @param {string} field - El nombre de la columna a verificar (ej. 'rut').
 * @param {any} value - El valor a buscar.
 * @param {number|string} [excludeId=null] - Un ID de usuario a excluir de la búsqueda.
 * @returns {Promise<boolean>} - Devuelve true si el valor es único, false si no lo es.
 */
async function checkUniqueness(field, value, excludeId = null) {
  // Lista blanca de campos permitidos para evitar inyección SQL en el nombre de la columna.
  const allowedFields = ['rut', 'license_plate', 'email'];
  if (!allowedFields.includes(field)) {
    // Si el campo no está en la lista, lanzamos un error para no ejecutar una consulta insegura.
    throw new Error(`Invalid field "${field}" provided for uniqueness check.`);
  }

  // Construcción segura de la consulta. El nombre del campo se escapa con comillas dobles.
  // Los valores se siguen pasando como parámetros para prevenir inyección.
  let query = `SELECT id FROM users WHERE "${field}" = $1`;
  const params = [value];

  if (excludeId) {
    query += ' AND id != $2';
    params.push(excludeId);
  }

  const result = await db.query(query, params);
  return result.rows.length === 0;
}

module.exports = {
  checkUniqueness,
};