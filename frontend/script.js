import { getParkingSpots, createReservation, getReservations, deleteReservation, deleteAllReservations, login, register, forgotPassword, resetPassword } from './api.js';
import { displayReservations, showView } from './ui.js';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const authForm = document.getElementById('authForm');
    const userNameInput = document.getElementById('userName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const logoutButton = document.getElementById('logoutButton');
    const themeToggleButton = document.getElementById('theme-toggle');
    const registerButton = document.getElementById('registerButton');

    const reservationHeading = document.getElementById('reservation-heading');
    const parkingGrid = document.getElementById('parkingGrid');
    const reservationsList = document.getElementById('reservationsList');
    const gridDateInput = document.getElementById('gridDate');
    const deleteAllButton = document.getElementById('deleteAllButton');

    const reservationModal = document.getElementById('reservationModal');
    const modalCloseBtn = reservationModal.querySelector('.close');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const confirmModalReservationBtn = document.getElementById('confirmModalReservation');

    // Elementos para restablecer contraseña
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const backToLoginButton = document.getElementById('backToLogin');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const forgotEmailInput = document.getElementById('forgotEmail');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const resetTokenInput = document.getElementById('resetToken');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    // Estado de la aplicación
    const appState = {
        token: null,
        user: null,
        selectedSpotId: null,
        selectedDate: null,
        allTimeSlotsForSpot: [],
    };

    // --- Lógica de Tema ---
    const applyTheme = (theme) => {
        document.body.classList.toggle('dark-theme', theme === 'dark');
    };

    const toggleTheme = () => {
        const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    };

    // --- Lógica de Autenticación y Routing ---
    const decodeToken = (token) => {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            return null;
        }
    };

    const handleLogin = async (event) => {
        event.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            return showToast('Por favor, ingrese su correo y contraseña.');
        }

        try {
            const data = await login(email, password);
            localStorage.setItem('token', data.token);
            showToast('Inicio de sesión exitoso.');
            handleRouteChange(); // Redirige a la vista principal
        } catch (error) {
            handleError(error);
        }
    };

    const handleRegister = async () => {
        const name = userNameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!name || !email || !password) {
            return showToast('Por favor, complete todos los campos para registrarse.');
        }

        try {
            await register(name, email, password);
            showToast('Registro exitoso. Ahora puede iniciar sesión.');
            authForm.reset();
        } catch (error) {
            handleError(error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        appState.token = null;
        appState.user = null;
        window.location.hash = '';
        handleRouteChange();
        window.location.reload(); // Forzar recarga para limpiar estado complejo
    };

    const handleForgotPassword = async (event) => {
        event.preventDefault();
        const email = forgotEmailInput.value.trim();
        if (!email) return showToast('Por favor, ingresa tu correo electrónico.');

        try {
            const result = await forgotPassword(email);
            showToast(result.message);
            forgotPasswordForm.reset();
            showView('authSection');
        } catch (error) {
            handleError(error);
        }
    };

    const handleResetPassword = async (event) => {
        event.preventDefault();
        const token = resetTokenInput.value;
        const password = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!password || password.length < 6) {
            return showToast('La contraseña debe tener al menos 6 caracteres.');
        }
        if (password !== confirmPassword) {
            return showToast('Las contraseñas no coinciden.');
        }

        try {
            const result = await resetPassword(token, password);
            showToast(result.message);
            resetPasswordForm.reset();
            window.location.hash = ''; // Limpiar hash para volver al login
            handleRouteChange();
        } catch (error) {
            handleError(error);
        }
    };

    const handleRouteChange = () => {
        const hash = window.location.hash;

        if (hash.startsWith('#reset-password?token=')) {
            const token = hash.substring('#reset-password?token='.length);
            resetTokenInput.value = token;
            showView('resetPasswordView');
        } else {
            const token = localStorage.getItem('token');
            if (token) {
                appState.token = token;
                appState.user = decodeToken(token);
                logoutButton.style.display = 'block';
                reservationHeading.textContent = `Reservar Estacionamiento (${appState.user.name})`;
                showView('reservationSection');
                initializeGridAndReservations();
            } else {
                appState.token = null;
                appState.user = null;
                logoutButton.style.display = 'none';
                showView('authSection');
            }
        }
    };

    // --- INICIALIZACIÓN ---
    const initializeApp = () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) applyTheme(savedTheme);
        
        handleRouteChange(); // Punto de entrada principal para la lógica de vistas
    };

    // --- MANEJADORES DE EVENTOS ---
    themeToggleButton.addEventListener('click', toggleTheme);
    authForm.addEventListener('submit', handleLogin);
    registerButton.addEventListener('click', handleRegister);
    logoutButton.addEventListener('click', handleLogout);
    window.addEventListener('hashchange', handleRouteChange);

    // Navegación para restablecer contraseña
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        showView('forgotPasswordView');
    });
    backToLoginButton.addEventListener('click', () => showView('authSection'));
    forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    resetPasswordForm.addEventListener('submit', handleResetPassword);

    // Eventos de la aplicación principal
    gridDateInput.addEventListener('change', () => loadParkingGrid(gridDateInput.value));
    reservationsList.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const reservationId = event.target.dataset.reservationId;
            try {
                const result = await deleteReservation(reservationId);
                showToast('Reserva cancelada exitosamente!');
                gridDateInput.value = result.gridDate;
                loadAndDisplayReservations();
                redrawParkingGrid(result.gridState);
            } catch (error) {
                handleError(error);
            }
        }
    });

    deleteAllButton.addEventListener('click', async () => {
        if (appState.user?.role !== 'admin') return;
        if (confirm('¿Está seguro de que desea eliminar TODAS las reservas? Esta acción no se puede deshacer.')) {
            try {
                await deleteAllReservations();
                showToast('Todas las reservas han sido eliminadas.');
                initializeGridAndReservations();
            } catch (error) {
                handleError(error);
            }
        }
    });

    // --- Lógica de Modal ---
    modalCloseBtn.addEventListener('click', () => closeModal());
    window.addEventListener('click', (event) => {
        if (event.target === reservationModal) closeModal();
    });
    startTimeInput.addEventListener('change', () => updateEndTimeOptions());
    confirmModalReservationBtn.addEventListener('click', handleConfirmReservation);

    function handleError(error, userMessage) {
        console.error(error);
        showToast(userMessage || error.message);
    }

    function addOption(select, text, value = '', disabled = false, selected = false) {
        const option = document.createElement('option');
        option.textContent = text;
        option.value = value;
        option.disabled = disabled;
        option.selected = selected;
        select.appendChild(option);
    }

    // --- FUNCIONES PRINCIPALES DE LA APP ---
    function initializeGridAndReservations() {
        if (appState.user?.role === 'admin') {
            deleteAllButton.style.display = 'block';
        }
        const today = new Date();
        const todayISO = today.toISOString().split('T')[0];

        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + 14);
        const maxDateISO = maxDate.toISOString().split('T')[0];

        gridDateInput.setAttribute('min', todayISO);
        gridDateInput.setAttribute('max', maxDateISO);
        gridDateInput.value = todayISO; // Set default to today

        loadParkingGrid(todayISO);
        loadAndDisplayReservations();
    }

    async function loadParkingGrid(date) {
        parkingGrid.innerHTML = '<div class="spinner"></div>';
        try {
            const spots = await getParkingSpots(date);
            redrawParkingGrid(spots);
        } catch (error) {
            handleError(error, 'Error al cargar los espacios de estacionamiento.');
            parkingGrid.innerHTML = '<p class="error">No se pudieron cargar los estacionamientos. Intente de nuevo más tarde.</p>';
        }
    }

    function redrawParkingGrid(spots) {
        parkingGrid.innerHTML = '';
        if (!spots || spots.length === 0) {
            parkingGrid.innerHTML = '<p>No hay información de estacionamientos disponible.</p>';
            return;
        }

        spots.forEach(spot => {
            const spotElement = document.createElement('div');
            spotElement.className = 'spot';
            spotElement.textContent = spot.name || `Espacio ${spot.id}`;
            spotElement.tabIndex = 0;
            spotElement.dataset.spotId = spot.id;

            const reservedSlots = spot.timeSlots.filter(slot => slot.isReserved);
            const isFullyReserved = reservedSlots.length === spot.timeSlots.length;
            const isPartiallyReserved = reservedSlots.length > 0 && !isFullyReserved;

            let tooltipText = '';
            if (isFullyReserved) {
                spotElement.classList.add('reserved');
                tooltipText = 'Espacio reservado todo el día';
                spotElement.tabIndex = -1;
            } else if (isPartiallyReserved) {
                spotElement.classList.add('partial');
                tooltipText = 'Reservas parciales:\n';

                const reservationsByUser = reservedSlots.reduce((acc, slot) => {
                    const user = slot.reservedBy || 'Desconocido';
                    if (!acc[user]) acc[user] = [];
                    acc[user].push(slot);
                    return acc;
                }, {});

                Object.entries(reservationsByUser).forEach(([user, slots]) => {
                    const timeBlocks = slots.reduce((blocks, slot) => {
                        if (blocks.length > 0 && blocks[blocks.length - 1].endTime === slot.startTime) {
                            blocks[blocks.length - 1].endTime = slot.endTime;
                        } else {
                            blocks.push({ startTime: slot.startTime, endTime: slot.endTime });
                        }
                        return blocks;
                    }, []);
                    const timeRanges = timeBlocks.map(block => `${block.startTime}-${block.endTime}`);
                    tooltipText += `- ${user} (${timeRanges.join(', ')})\n`;
                });
            }

            spotElement.title = tooltipText.trim() || 'Haga clic para reservar este espacio';
            spotElement.setAttribute('aria-label', spotElement.title);

            if (!isFullyReserved) {
                const openModalHandler = () => openModal(spot);
                spotElement.addEventListener('click', openModalHandler);
                spotElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openModalHandler();
                    }
                });
            }
            parkingGrid.appendChild(spotElement);
        });
    }

    async function handleConfirmReservation() {
        const reservationData = {
            spotId: appState.selectedSpotId,
            date: appState.selectedDate,
            startTime: startTimeInput.value,
            endTime: endTimeInput.value,
        };

        try {
            const result = await createReservation(reservationData);
            showToast('Reserva creada exitosamente!');
            closeModal();
            displayReservations(result.myReservations, appState.user?.role === 'admin', appState.user?.email);
            redrawParkingGrid(result.gridState);
        } catch (error) {
            handleError(error);
        }
    }

    function openModal(spot) {
        appState.selectedSpotId = spot.id;
        appState.selectedDate = gridDateInput.value;
        document.getElementById('modalSpotName').textContent = spot.name;
        document.getElementById('modalDateDisplay').textContent = appState.selectedDate;
        populateTimeSelects(spot, appState.selectedDate);
        reservationModal.style.display = 'block';
    }

    function closeModal() {
        reservationModal.style.display = 'none';
    }

    function populateTimeSelects(spot, date) {
        startTimeInput.innerHTML = '';
        endTimeInput.innerHTML = '';

        if (!date || !spot) return;

        appState.allTimeSlotsForSpot = spot.timeSlots; // Bug fix: This line was missing
        let availableStartSlots = spot.timeSlots.filter(slot => !slot.isReserved);

        if (date === new Date().toISOString().split('T')[0]) {
            const currentTime = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            availableStartSlots = availableStartSlots.filter(slot => slot.startTime >= currentTime);
        }

        confirmModalReservationBtn.disabled = availableStartSlots.length === 0;
        startTimeInput.disabled = availableStartSlots.length === 0;
        endTimeInput.disabled = true;

        if (availableStartSlots.length === 0) {
            addOption(startTimeInput, 'No hay horarios disponibles', '', true);
            addOption(endTimeInput, 'No hay horarios disponibles', '', true);
            return;
        }

        addOption(startTimeInput, 'Seleccione...', '', true, true);
        availableStartSlots.forEach(slot => addOption(startTimeInput, slot.startTime, slot.startTime));
        addOption(endTimeInput, 'Seleccione entrada', '', true, true);
    }

    function updateEndTimeOptions() {
        const selectedStartTime = startTimeInput.value;
        endTimeInput.innerHTML = '';
        endTimeInput.disabled = true;

        if (!selectedStartTime) {
            addOption(endTimeInput, 'Seleccione entrada', '', true, true);
            return;
        }

        const startIndex = appState.allTimeSlotsForSpot.findIndex(slot => slot.startTime === selectedStartTime);
        if (startIndex === -1) return;

        for (let i = startIndex; i < appState.allTimeSlotsForSpot.length; i++) {
            const slot = appState.allTimeSlotsForSpot[i];
            if (slot.isReserved) {
                break;
            }
            addOption(endTimeInput, slot.endTime, slot.endTime);
        }

        if (endTimeInput.options.length > 0) {
            endTimeInput.disabled = false;
        } else {
            addOption(endTimeInput, 'No disponible', '', true);
        }
    }

    async function loadAndDisplayReservations() {
        try {
            const reservations = await getReservations();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const reservationsToDisplay = appState.user?.role === 'admin'
                ? reservations.filter(r => new Date(`${r.date}T00:00:00`) >= today)
                : reservations.filter(r => r.email === appState.user?.email && new Date(`${r.date}T00:00:00`) >= today);
            
            displayReservations(reservationsToDisplay, appState.user?.role === 'admin', appState.user?.email);
        } catch (error) {
            handleError(error);
        }
    }

    initializeApp();
});