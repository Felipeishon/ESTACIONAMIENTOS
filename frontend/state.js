
// Módulo para gestionar el estado de la aplicación de forma centralizada.

export const state = {
    token: null,
    user: null,
    selectedSpotId: null,
    selectedDate: null,
    allTimeSlotsForSpot: [],
    allReservations: [],
};

/**
 * Actualiza el estado de la aplicación de forma segura.
 * @param {object} newState - Un objeto con las claves del estado a actualizar.
 */
export function setAppState(newState) {
    Object.assign(state, newState);
}
