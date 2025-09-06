const API_BASE_URL = 'http://localhost:3001/api';

export async function getParkingSpots(date) {
    const response = await fetch(`${API_BASE_URL}/parking-spots?date=${date}`, {
        cache: 'no-cache'
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
    return await response.json(); 
}

export async function getReservations() {
    const response = await fetch(`${API_BASE_URL}/reservations`, {
        cache: 'no-cache'
    });
    if (!response.ok) {
        throw new Error('Error al obtener reservas');
    }
    return await response.json();
}

export async function deleteReservation(reservationId, adminPassword = null, userEmail = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    const options = {
        method: 'DELETE',
        headers: headers
    };

    if (adminPassword) {
        headers['X-Admin-Password'] = adminPassword;
    } else if (userEmail) {
        options.body = JSON.stringify({ email: userEmail });
    }

    const response = await fetch(`${API_BASE_URL}/reservations/${reservationId}`, options);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al cancelar la reserva');
    }
    return await response.json();
}

export async function deleteAllReservations(adminPassword) {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (adminPassword) {
        headers['X-Admin-Password'] = adminPassword;
    }

    const response = await fetch(`${API_BASE_URL}/reservations/admin/all`, {
        method: 'DELETE',
        headers: headers
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar todas las reservas');
    }
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