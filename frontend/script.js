import { getParkingSpots, createReservation, getReservations, deleteReservation, deleteAllReservations, getConfig } from './api.js';
import { displayReservations, resetForm } from './ui.js';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const emailSection = document.getElementById('emailSection');
    const emailForm = document.getElementById('emailForm');
    const emailInput = document.getElementById('email');
    const userNameInput = document.getElementById('userName');
    const reservationSection = document.getElementById('reservationSection');
    const parkingGrid = document.getElementById('parkingGrid');
    const reservationsList = document.getElementById('reservationsList');
    const gridDateInput = document.getElementById('gridDate');
    const deleteAllButton = document.getElementById('deleteAllButton');

    const reservationModal = document.getElementById('reservationModal');
    const modalCloseBtn = reservationModal.querySelector('.close');    
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const confirmModalReservationBtn = document.getElementById('confirmModalReservation');

    // Estado de la aplicación
    let allowedEmailDomain = '';
    let userEmail = '';
    let userName = '';
    let selectedSpotId = null;
    let selectedDate = null;
    let allTimeSlotsForSpot = [];
    let adminPassword = null; // Contraseña de administrador
    const ADMIN_EMAIL = 'reservas.estacionamiento.iansa@gmail.com';

    // --- INICIALIZACIÓN ---
    getConfig()
        .then(config => {
            allowedEmailDomain = config.allowedEmailDomain;
            // Se elimina la validación de patrón HTML5 para permitir el email de admin.
            // La validación de dominio se hace en el evento de submit.
            emailInput.title = `Por favor, use una dirección de correo electrónico de ${allowedEmailDomain}`;
        })
        .catch(error => {
            console.error('Error fetching config:', error);
            showToast('No se pudo cargar la configuración del servidor.');
        });

    // --- MANEJADORES DE EVENTOS ---
    emailForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = emailInput.value.trim();
        const name = userNameInput.value.trim();

        // Flujo de Administrador
        if (email === ADMIN_EMAIL && name === ADMIN_EMAIL) {
            const password = prompt('Ingrese la contraseña de administrador:');
            if (password) {
                adminPassword = password;
                userEmail = email;
                userName = name;
                
                showToast('Modo administrador activado.');
                deleteAllButton.style.display = 'block';
                emailSection.style.display = 'none';
                reservationSection.style.display = 'block';
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

        if (!email.endsWith(allowedEmailDomain)) {
            showToast(`Por favor, use una dirección de correo electrónico de ${allowedEmailDomain}`);
            return;
        }

        // Si es un usuario válido, proceder
        userEmail = email;
        userName = name;
        adminPassword = null; // Asegurarse que no está en modo admin
        deleteAllButton.style.display = 'none';

        emailSection.style.display = 'none';
        reservationSection.style.display = 'block';
        initializeGridAndReservations(false); // Iniciar como no-admin
    });

    deleteAllButton.addEventListener('click', async () => {
        if (!adminPassword) return;
        const confirmation = confirm('¿Está seguro de que desea eliminar TODAS las reservas? Esta acción no se puede deshacer.');
        if (confirmation) {
            try {
                await deleteAllReservations(adminPassword);
                showToast('Todas las reservas han sido eliminadas.');
                initializeGridAndReservations(true);
            } catch (error) {
                console.error('Error deleting all reservations:', error);
                showToast(error.message);
            }
        }
    });

    gridDateInput.addEventListener('change', () => {
        loadParkingGrid(gridDateInput.value);
    });

    reservationsList.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const reservationId = event.target.dataset.reservationId;
            const isAdmin = !!adminPassword;

            try {
                const result = await deleteReservation(reservationId, adminPassword, userEmail);
                showToast('Reserva cancelada exitosamente!');
                gridDateInput.value = result.gridDate;
                loadAndDisplayReservations(isAdmin);
                redrawParkingGrid(result.gridState);
            } catch (error) {
                console.error('Error:', error);
                showToast(error.message);
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

    // --- FUNCIONES PRINCIPALES ---
    function initializeGridAndReservations(isAdmin = false) {
        const today = new Date().toISOString().split('T')[0];
        gridDateInput.value = today;
        loadParkingGrid(today);
        loadAndDisplayReservations(isAdmin);
    }

    async function loadParkingGrid(date) {
        parkingGrid.innerHTML = '<p>Cargando estacionamientos...</p>';
        try {
            const spots = await getParkingSpots(date);
            redrawParkingGrid(spots);
        } catch (error) {
            console.error('Error loading parking spots:', error);
            showToast('Error al cargar los espacios de estacionamiento.');
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

            if (!isFullyReserved) {
                spotElement.addEventListener('click', () => openModal(spot.id, spot.name));
                spotElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openModal(spot.id, spot.name);
                    }
                });
            }
            parkingGrid.appendChild(spotElement);
        });
    }

    async function handleConfirmReservation() {
        const reservationData = {
            spotId: selectedSpotId,
            date: selectedDate,
            startTime: startTimeInput.value,
            endTime: endTimeInput.value,
            name: userName,
            email: userEmail,
        };

        try {
            const result = await createReservation(reservationData);
            showToast('Reserva creada exitosamente!');
            closeModal();
            displayReservations(result.myReservations, !!adminPassword, userEmail);
            redrawParkingGrid(result.gridState);
        } catch (error) {
            console.error('Error:', error);
            showToast(error.message);
        }
    }

    async function openModal(spotId, spotName) {
        selectedSpotId = spotId;
        selectedDate = gridDateInput.value;
        document.getElementById('modalSpotName').textContent = spotName;
        document.getElementById('modalDateDisplay').textContent = selectedDate;
        await populateTimeSelects(spotId, selectedDate);
        reservationModal.style.display = 'block';
    }

    function closeModal() {
        reservationModal.style.display = 'none';
    }

    async function populateTimeSelects(spotId, date) {
        startTimeInput.innerHTML = '<option>Cargando...</option>';
        endTimeInput.innerHTML = '<option>Cargando...</option>';
        startTimeInput.disabled = true;
        endTimeInput.disabled = true;

        if (!date) {
            startTimeInput.innerHTML = '';
            endTimeInput.innerHTML = '';
            return;
        }
        try {
            const spots = await getParkingSpots(date);
            const spot = spots.find(s => s.id === spotId);
            startTimeInput.innerHTML = '';
            endTimeInput.innerHTML = '';

            if (!spot) {
                showToast('Espacio no encontrado para la fecha seleccionada.');
                return;
            }

            allTimeSlotsForSpot = spot.timeSlots;
            let availableStartSlots = allTimeSlotsForSpot.filter(slot => !slot.isReserved);

            const today = new Date().toISOString().split('T')[0];
            if (date === today) {
                const now = new Date();
                const currentTime = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                availableStartSlots = availableStartSlots.filter(slot => slot.startTime >= currentTime);
            }

            if (availableStartSlots.length === 0) {
                const option = document.createElement('option');
                option.textContent = 'No hay horarios disponibles';
                option.disabled = true;
                startTimeInput.appendChild(option.cloneNode(true));
                endTimeInput.appendChild(option.cloneNode(true));
                return;
            }

            const placeholder = document.createElement('option');
            placeholder.textContent = 'Seleccione...';
            placeholder.value = '';
            placeholder.disabled = true;
            placeholder.selected = true;
            startTimeInput.appendChild(placeholder);

            availableStartSlots.forEach(slot => {
                const optionElement = document.createElement('option');
                optionElement.textContent = `${slot.startTime}`;
                optionElement.value = slot.startTime;
                startTimeInput.appendChild(optionElement);
            });
            startTimeInput.disabled = false;

            const endPlaceholder = document.createElement('option');
            endPlaceholder.textContent = 'Seleccione entrada';
            endPlaceholder.value = '';
            endPlaceholder.disabled = true;
            endPlaceholder.selected = true;
            endTimeInput.appendChild(endPlaceholder);
            endTimeInput.disabled = true;

        } catch (error) {
            console.error('Error loading time slots:', error);
            startTimeInput.innerHTML = '';
            const option = document.createElement('option');
            option.textContent = 'Error al cargar horarios';
            option.disabled = true;
            startTimeInput.appendChild(option);
            showToast('Error al cargar los horarios disponibles.');
        }
    }

    function updateEndTimeOptions() {
        const selectedStartTime = startTimeInput.value;
        endTimeInput.innerHTML = '';
        endTimeInput.disabled = true;

        if (!selectedStartTime) {
            const endPlaceholder = document.createElement('option');
            endPlaceholder.textContent = 'Seleccione entrada';
            endPlaceholder.value = '';
            endPlaceholder.disabled = true;
            endPlaceholder.selected = true;
            endTimeInput.appendChild(endPlaceholder);
            return;
        }

        const startIndex = allTimeSlotsForSpot.findIndex(slot => slot.startTime === selectedStartTime);
        if (startIndex === -1) return;

        for (let i = startIndex; i < allTimeSlotsForSpot.length; i++) {
            const slot = allTimeSlotsForSpot[i];
            if (slot.isReserved) {
                break;
            }

            const optionElement = document.createElement('option');
            optionElement.textContent = slot.endTime;
            optionElement.value = slot.endTime;
            endTimeInput.appendChild(optionElement);
        }

        if (endTimeInput.options.length > 0) {
            endTimeInput.disabled = false;
        } else {
            const option = document.createElement('option');
            option.textContent = 'No disponible';
            option.disabled = true;
            endTimeInput.appendChild(option);
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
                    return r.email === userEmail && reservationDate >= today;
                });
            }
            displayReservations(reservationsToDisplay, isAdmin, userEmail);
        } catch (error) {
            console.error('Error:', error);
            showToast(error.message);
        }
    }
});