// Módulo para gestionar el estado de la aplicación de forma centralizada y reactiva.

const state = {
    token: null,
    user: null,
    selectedSpotId: null,
    selectedDate: null,
    allTimeSlotsForSpot: [],
    allReservations: [],
    allUsers: [], // Nuevo estado para guardar la lista de usuarios
};

const listeners = new Set();

/**
 * Notifica a todos los suscriptores que el estado ha cambiado.
 */
function notify() {
    listeners.forEach(listener => listener());
}

/**
 * Permite que los componentes de la UI se suscriban a los cambios del estado.
 * @param {Function} callback - La función a llamar cuando el estado cambie.
 * @returns {Function} Una función para desuscribirse.
 */
export function subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback); // Devuelve una función de limpieza
}

/**
 * Actualiza el estado de la aplicación y notifica a los suscriptores.
 * @param {object} newState - Un objeto con las claves del estado a actualizar.
 */
export function setAppState(newState) {
    Object.assign(state, newState);
    notify();
}

// --- Getters (Selectores) ---
// Proporcionan acceso de solo lectura al estado.

export function getToken() {
    return state.token;
}

export function getUser() {
    return state.user;
}

export function getAllReservations() {
    return state.allReservations;
}

export function getSelectedSpotDetails() {
    return { spotId: state.selectedSpotId, date: state.selectedDate, timeSlots: state.allTimeSlotsForSpot };
}

export function getAllUsers() {
    return state.allUsers;
}