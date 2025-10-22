import { initAuth } from './modules/auth.js';
import { initTheme } from './modules/theme.js';
import { initReservations } from './modules/reservations.js';
import { initModal } from './modules/modal.js';
import { handleRouteChange } from './modules/router.js';

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initTheme();
    initReservations();
    initModal();

    window.addEventListener('hashchange', handleRouteChange);
    handleRouteChange(); // Handle initial page load
});
