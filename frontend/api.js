const API_BASE_URL = 'http://localhost:3001/api';

export async function getParkingSpots(date) {
    const response = await fetch(`${API_BASE_URL}/parking-spots?date=${date}`, {
        cache: 'no-cache' // Evita que el navegador use una respuesta cacheada y asegura datos frescos.
    });
    if (!response.ok) {
        throw new Error('Error al obtener espacios de estacionamiento');
    }
    return await response.json();
}

export async function createReservation(reservationData) {
    const response = await fetch(`${API_BASE_URL}/reservations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(reservationData)
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al crear la reserva');
    }
    // The backend now returns the full updated state.
    return await response.json(); 
}

export async function getReservations() {
    const response = await fetch(`${API_BASE_URL}/reservations`, {
        cache: 'no-cache' // Asegura que la lista de reservas esté siempre actualizada.
    });
    if (!response.ok) {
        throw new Error('Error al obtener reservas');
    }
    return await response.json();
}

export async function deleteReservation(reservationId) {
    const response = await fetch(`${API_BASE_URL}/reservations/${reservationId}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al cancelar la reserva');
    }
    // The backend now returns the full updated state on delete as well.
    return await response.json();
}

export async function getConfig() {
    const response = await fetch(`${API_BASE_URL}/config`, {
        cache: 'no-cache'
    });
    if (!response.ok) {
        throw new Error('Error al obtener la configuración');
    }
    return await response.json();
}