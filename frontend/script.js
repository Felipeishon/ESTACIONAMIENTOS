import { getParkingSpots, createReservation, getReservations, deleteReservation, deleteAllReservations, getConfig } from './api.js';
import { displayReservations, resetForm } from './ui.js';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const mainElement = document.querySelector('main');
    const emailSection = document.getElementById('emailSection');
    const emailForm = document.getElementById('emailForm');
    const emailInput = document.getElementById('email');
    const userNameInput = document.getElementById('userName');
    const reservationSection = document.getElementById('reservationSection');
    const parkingGrid = document.getElementById('parkingGrid');
    const reservationsList = document.getElementById('reservationsList');
    const gridDateInput = document.getElementById('gridDate');
    const reservationHeading = document.getElementById('reservation-heading');
    const deleteAllButton = document.getElementById('deleteAllButton');

    const reservationModal = document.getElementById('reservationModal');
    const modalCloseBtn = reservationModal.querySelector('.close');    
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const confirmModalReservationBtn = document.getElementById('confirmModalReservation');

    // Estado de la aplicación
    const appState = {
        allowedEmailDomain: '',
        userEmail: '',
        userName: '',
        adminPassword: null,
        selectedSpotId: null,
        selectedDate: null,
        allTimeSlotsForSpot: [],
    };
    const ADMIN_EMAIL = 'reservas.estacionamiento.iansa@gmail.com';

    // --- Lógica de Sesión ---
    function saveSession(data) {
        sessionStorage.setItem('parkingUser', JSON.stringify(data));
    }

    function loadSession() {
        const userData = sessionStorage.getItem('parkingUser');
        if (userData) {
            return JSON.parse(userData);
        }
        return null;
    }

    function clearSession() {
        sessionStorage.removeItem('parkingUser');
        // Recargar la página para volver al formulario de login
        window.location.reload();
    }

    function createLogoutButton() {
        const logoutButton = document.createElement('button');
        logoutButton.textContent = 'Cerrar Sesión';
        logoutButton.className = 'logout-button'; // Puedes añadir estilos para este botón
        logoutButton.addEventListener('click', clearSession);
        mainElement.appendChild(logoutButton);
    }


    // --- INICIALIZACIÓN ---
    getConfig()
        .then(config => {
            appState.allowedEmailDomain = config.allowedEmailDomain;
            // Se elimina la validación de patrón HTML5 para permitir el email de admin.
            // La validación de dominio se hace en el evento de submit.
            emailInput.title = `Por favor, use una dirección de correo electrónico de ${appState.allowedEmailDomain}`;
        })
        .catch(error => {
            handleError(error, 'No se pudo cargar la configuración del servidor.');
        });

    // Al cargar la página, intentar restaurar la sesión
    const savedUser = loadSession();
    if (savedUser) {
        appState.userEmail = savedUser.email;
        appState.userName = savedUser.name;
        appState.adminPassword = savedUser.adminPassword;

        emailSection.style.display = 'none';
        reservationSection.style.display = 'block';
        reservationHeading.textContent = `Reservar Estacionamiento (${savedUser.adminPassword ? 'Admin' : appState.userName})`;
        deleteAllButton.style.display = appState.adminPassword ? 'block' : 'none';

        createLogoutButton();
        initializeGridAndReservations(!!appState.adminPassword);
    }


    // --- MANEJADORES DE EVENTOS ---
    emailForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = emailInput.value.trim();
        const name = userNameInput.value.trim();

        // Flujo de Administrador
        if (email === ADMIN_EMAIL && name === ADMIN_EMAIL) {
            const password = prompt('Ingrese la contraseña de administrador:');
            if (password) {
                appState.adminPassword = password;
                appState.userEmail = email;
                appState.userName = name;
                
                saveSession({ email: appState.userEmail, name: appState.userName, adminPassword: appState.adminPassword });
                showToast('Modo administrador activado.');
                deleteAllButton.style.display = 'block';
                emailSection.style.display = 'none';
                reservationSection.style.display = 'block';
                reservationHeading.textContent = `Reservar Estacionamiento (Admin)`;
                createLogoutButton();
                initializeGridAndReservations(true); // Iniciar como admin
            }
            return; // Terminar el flujo aquí para el admin
        }

        // Flujo de Usuario Normal
        const nameParts = name.split(' ').filter(part => part.length > 0);
        if (name.length < 5 || nameParts.length < 2) {
            showToast('Por favor, ingrese un nombre y apellido válidos.');
            return;
        }

        const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
        if (!emailRegex.test(email)) {
            showToast('Por favor, ingrese un correo electrónico válido.');
            return;
        }

        if (!email.endsWith(appState.allowedEmailDomain)) {
            showToast(`Por favor, use una dirección de correo electrónico de ${appState.allowedEmailDomain}`);
            return;
        }

        // Si es un usuario válido, proceder
        appState.userEmail = email;
        appState.userName = name;
        appState.adminPassword = null; // Asegurarse que no está en modo admin
        deleteAllButton.style.display = 'none';
        saveSession({ email: appState.userEmail, name: appState.userName, adminPassword: null });

        emailSection.style.display = 'none';
        reservationSection.style.display = 'block';
        reservationHeading.textContent = `Reservar Estacionamiento (${appState.userName})`;
        createLogoutButton();
        initializeGridAndReservations(false); // Iniciar como no-admin
    });

    deleteAllButton.addEventListener('click', async () => {
        if (!appState.adminPassword) return;
        const confirmation = confirm('¿Está seguro de que desea eliminar TODAS las reservas? Esta acción no se puede deshacer.');
        if (confirmation) {
            try {
                await deleteAllReservations(appState.adminPassword);
                showToast('Todas las reservas han sido eliminadas.');
                initializeGridAndReservations(true);
            } catch (error) {
                handleError(error);
            }
        }
    });

    gridDateInput.addEventListener('change', () => {
        loadParkingGrid(gridDateInput.value);
    });

    reservationsList.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const reservationId = event.target.dataset.reservationId;
            const isAdmin = !!appState.adminPassword;

            try {
                const result = await deleteReservation(reservationId, appState.adminPassword, appState.userEmail);
                showToast('Reserva cancelada exitosamente!');
                gridDateInput.value = result.gridDate;
                loadAndDisplayReservations(isAdmin);
                redrawParkingGrid(result.gridState);
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

    // --- FUNCIONES PRINCIPALES ---
    /**
     * Inicializa la grilla de estacionamientos y la lista de reservaciones.
     * @param {boolean} isAdmin - Indica si el usuario es administrador.
     */
    function initializeGridAndReservations(isAdmin = false) {
        const today = new Date().toISOString().split('T')[0];
        gridDateInput.value = today;
        loadParkingGrid(today);
        loadAndDisplayReservations(isAdmin);
    }

    /**
     * Carga y muestra los estacionamientos para una fecha dada.
     * @param {string} date - Fecha en formato YYYY-MM-DD
     */
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

    /**
     * Dibuja o redibuja la grilla de estacionamientos.
     * @param {Array<object>} spots - Array de objetos de estacionamiento.
     */
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
                    if (!acc[user]) {
                        acc[user] = [];
                    }
                    acc[user].push(slot);
                    return acc;
                }, {});

                Object.entries(reservationsByUser).forEach(([user, slots]) => {
                    const timeBlocks = [];
                    let currentBlock = null;
                    slots.forEach(slot => {
                        if (currentBlock && currentBlock.endTime === slot.startTime) {
                            currentBlock.endTime = slot.endTime;
                        } else {
                            if (currentBlock) timeBlocks.push(currentBlock);
                            currentBlock = { startTime: slot.startTime, endTime: slot.endTime };
                        }
                    });
                    if (currentBlock) timeBlocks.push(currentBlock);

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

    /**
     * Maneja la confirmación de una reserva.
     */
    async function handleConfirmReservation() {
        const reservationData = {
            spotId: appState.selectedSpotId,
            date: appState.selectedDate,
            startTime: startTimeInput.value,
            endTime: endTimeInput.value,
            name: appState.userName,
            email: appState.userEmail,
        };

        try {
            const result = await createReservation(reservationData);
            showToast('Reserva creada exitosamente!');
            closeModal();
            displayReservations(result.myReservations, !!appState.adminPassword, appState.userEmail);
            redrawParkingGrid(result.gridState);
        } catch (error) {
            handleError(error);
        }
    }

    /**
     * Abre el modal de reserva para un estacionamiento específico.
     * @param {number} spotId - ID del estacionamiento.
     * @param {string} spotName - Nombre del estacionamiento.
     */
    function openModal(spot) {
        appState.selectedSpotId = spot.id;
        appState.selectedDate = gridDateInput.value;
        document.getElementById('modalSpotName').textContent = spot.name;
        document.getElementById('modalDateDisplay').textContent = appState.selectedDate;
        populateTimeSelects(spot, appState.selectedDate);
        reservationModal.style.display = 'block';
    }

    /**
     * Cierra el modal de reserva.
     */
    /**
     * Cierra el modal de reserva.
     */
    function closeModal() {
        reservationModal.style.display = 'none';
    }

    /**
     * Popula los selects de hora de inicio y fin para un estacionamiento y fecha específicos.
     * @param {number} spotId - ID del estacionamiento.
     * @param {string} date - Fecha en formato YYYY-MM-DD.
     */
    /**
     * Popula los selects de hora de inicio y fin para un estacionamiento y fecha específicos.
     * @param {number} spotId - ID del estacionamiento.
     * @param {string} date - Fecha en formato YYYY-MM-DD.
     */
    function populateTimeSelects(spot, date) {
        startTimeInput.innerHTML = '<option>Cargando...</option>';
        endTimeInput.innerHTML = '<option>Cargando...</option>';
        startTimeInput.disabled = true;
        endTimeInput.disabled = true;

        if (!date || !spot) {
            startTimeInput.innerHTML = '';
            endTimeInput.innerHTML = '';
            return;
        }

        startTimeInput.innerHTML = '';
        endTimeInput.innerHTML = '';

        appState.allTimeSlotsForSpot = spot.timeSlots;
        let availableStartSlots = appState.allTimeSlotsForSpot.filter(slot => !slot.isReserved);

        const today = new Date().toISOString().split('T')[0];
        if (date === today) {
            const now = new Date();
            const currentTime = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            availableStartSlots = availableStartSlots.filter(slot => slot.startTime >= currentTime);
        }

        if (availableStartSlots.length === 0) {
            addOption(startTimeInput, 'No hay horarios disponibles', '', true);
            addOption(endTimeInput, 'No hay horarios disponibles', '', true);
            confirmModalReservationBtn.disabled = true;
            return;
        }
        confirmModalReservationBtn.disabled = false;

        addOption(startTimeInput, 'Seleccione...', '', true, true);

        availableStartSlots.forEach(slot => {
            addOption(startTimeInput, `${slot.startTime}`, slot.startTime);
        });
        startTimeInput.disabled = false;

        addOption(endTimeInput, 'Seleccione entrada', '', true, true);
        endTimeInput.disabled = true;
    }

    /**
     * Actualiza las opciones del select de hora de fin basándose en la hora de inicio seleccionada.
     */
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

    async function loadAndDisplayReservations(isAdmin = false) {
        try {
            const reservations = await getReservations();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let reservationsToDisplay;
            if (isAdmin) {
                reservationsToDisplay = reservations.filter(r => new Date(`${r.date}T00:00:00`) >= today);
            } else {
                reservationsToDisplay = reservations.filter(r => {
                    const reservationDate = new Date(`${r.date}T00:00:00`);
                    return r.email === appState.userEmail && reservationDate >= today;
                });
            }
            displayReservations(reservationsToDisplay, isAdmin, appState.userEmail);
        } catch (error) {
            handleError(error);
        }
    }
});