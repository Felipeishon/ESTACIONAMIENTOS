const API_BASE_URL = `http://${window.location.hostname}:3001/api`;

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export async function login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al iniciar sesión');
    }
    return await response.json();
}

export async function register(name, email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al registrarse');
    }
    return await response.json();
}

export async function forgotPassword(email) {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al solicitar el restablecimiento de contraseña');
    }
    return await response.json();
}

export async function resetPassword(token, password) {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, password })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al restablecer la contraseña');
    }
    return await response.json();
}

export async function getParkingSpots(date) {
    const response = await fetch(`${API_BASE_URL}/parking-spots?date=${date}`, {
        headers: getAuthHeaders(),
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
            'Content-Type': 'application/json',
            ...getAuthHeaders()
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
        headers: getAuthHeaders(),
        cache: 'no-cache'
    });
    if (!response.ok) {
        throw new Error('Error al obtener reservas');
    }
    return await response.json();
}

export async function deleteReservation(reservationId) {
    const response = await fetch(`${API_BASE_URL}/reservations/${reservationId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al cancelar la reserva');
    }
    return await response.json();
}

export async function deleteAllReservations() {
    const response = await fetch(`${API_BASE_URL}/reservations/admin/all`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        }
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
