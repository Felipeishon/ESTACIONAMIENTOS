import { showView } from '../ui.js';
import { setAppState, getUser } from '../store.js';
import { initializeGridAndReservations } from './reservations.js';

const decodeToken = (token) => {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
};

export const handleRouteChange = () => {
    const hash = window.location.hash;
    const logoutButton = document.getElementById('logoutButton');
    const reservationHeading = document.getElementById('reservation-heading');
    const resetTokenInput = document.getElementById('resetToken');


    if (hash.startsWith('#reset-password?token=')) {
        const token = hash.substring('#reset-password?token='.length);
        resetTokenInput.value = token;
        showView('resetPasswordView');
    } else {
        const token = localStorage.getItem('token');
        if (token) {
            setAppState({ token: token, user: decodeToken(token) });
            logoutButton.style.display = 'block';
            reservationHeading.textContent = `Reservar Estacionamiento (${getUser().name})`;
            showView('reservationSection');
            initializeGridAndReservations();
        } else {
            setAppState({ token: null, user: null });
            logoutButton.style.display = 'none';
            showView('authSection');
        }
    }
};
