const API_BASE_URL = `http://${window.location.hostname}:3001/api`;

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

async function handleResponse(response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        // Usamos el primer mensaje de error detallado como mensaje principal si existe.
        const mainErrorMessage = errorData.errors ? Object.values(errorData.errors)[0] : (errorData.message || 'Ocurrió un error');
        const error = new Error(mainErrorMessage);
        error.status = response.status;
        error.details = errorData.errors; // Adjuntamos todos los errores detallados.
        throw error;
    }
    return response.json();
}

export async function login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });
    return handleResponse(response);
}

export async function register(userData) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
    });
    return handleResponse(response);
}

export async function forgotPassword(email) {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
    });
    return handleResponse(response);
}

export async function resetPassword(token, password) {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, password })
    });
    return handleResponse(response);
}

export async function getParkingSpots(date) {
    const response = await fetch(`${API_BASE_URL}/parking-spots?date=${date}`, {
        headers: getAuthHeaders(),
        cache: 'no-cache'
    });
    return handleResponse(response);
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
    return handleResponse(response);
}

export async function getReservations() {
    const response = await fetch(`${API_BASE_URL}/reservations`, {
        headers: getAuthHeaders(),
        cache: 'no-cache'
    });
    return handleResponse(response);
}

export async function deleteReservation(reservationId) {
    const response = await fetch(`${API_BASE_URL}/reservations/${reservationId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        }
    });
    return handleResponse(response);
}

export async function deleteAllReservations() {
    const response = await fetch(`${API_BASE_URL}/reservations/admin/all`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        }
    });
    return handleResponse(response);
}

export async function deleteAllReservationsForUser(email) {
    const response = await fetch(`${API_BASE_URL}/reservations/admin/user/${email}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        }
    });
    return handleResponse(response);
}

export async function getConfig() {
    const response = await fetch(`${API_BASE_URL}/config`, {
        cache: 'no-cache'
    });
    return handleResponse(response);
}

export async function getUsers() {
    const response = await fetch(`${API_BASE_URL}/users`, {
        headers: getAuthHeaders(),
        cache: 'no-cache'
    });
    return handleResponse(response);
}

export async function updateUser(userId, userData) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify(userData)
    });
    return handleResponse(response);
}

export async function deleteUser(userId) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        }
    });
    return handleResponse(response);
}