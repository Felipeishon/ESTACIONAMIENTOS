import { getParkingSpots, deleteReservation, deleteAllReservations, deleteAllReservationsForUser } from '../api.js';
import { displayReservations } from '../ui.js';
import { showToast } from '../toast.js';
import { setAppState, getUser, getAllReservations } from '../store.js';
import { openModal } from './modal.js';

function handleError(error, userMessage) {
    console.error("Error capturado:", error);
    const message = error?.data?.message || error?.message || userMessage || 'Ocurrió un error inesperado.';

    if (error.status === 401) {
        showToast('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
        handleLogout();
    } else {
        showToast(message);
    }
}

function addOption(select, text, value = '', disabled = false, selected = false) {
    const option = document.createElement('option');
    option.textContent = text;
    option.value = value;
    option.disabled = disabled;
    option.selected = selected;
    select.appendChild(option);
}

function populateUserFilter(reservations) {
    const userFilter = document.getElementById('userFilter');
    userFilter.innerHTML = '<option value="">Todos los usuarios</option>';
    const userEmails = [...new Set(reservations.map(res => res.email))];
    userEmails.sort().forEach(email => {
        addOption(userFilter, email, email);
    });
}

async function loadParkingGrid(date) {
    const parkingGrid = document.getElementById('parkingGrid');
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
    const parkingGrid = document.getElementById('parkingGrid');
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

async function loadAndDisplayReservations() {
    try {
        document.getElementById('myReservationsSection').classList.remove('hidden');
        const reservations = await getReservations();
        const user = getUser();
        setAppState({ allReservations: reservations }); // Store all reservations

        if (user?.role === 'admin') {
            document.getElementById('adminFilters').style.display = 'block';
            populateUserFilter(reservations);
        }

        displayReservations(reservations, user?.role === 'admin', user?.email);
    } catch (error) {
        handleError(error);
    }
}

export function initializeGridAndReservations() {
    if (getUser()?.role === 'admin') {
        document.getElementById('my-reservations-heading').textContent = 'Reservas';
        document.getElementById('deleteAllButton').style.display = 'block';
    }
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayISO = `${year}-${month}-${day}`;

    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 14);
    const maxDateISO = maxDate.toISOString().split('T')[0];
    const gridDateInput = document.getElementById('gridDate');

    gridDateInput.setAttribute('min', todayISO);
    gridDateInput.setAttribute('max', maxDateISO);
    gridDateInput.value = todayISO; // Set default to today

    loadParkingGrid(todayISO);
    loadAndDisplayReservations();
}

export function initReservations() {
    const gridDateInput = document.getElementById('gridDate');
    const userFilter = document.getElementById('userFilter');
    const reservationsList = document.getElementById('reservationsList');
    const deleteAllButton = document.getElementById('deleteAllButton');

    gridDateInput.addEventListener('change', () => loadParkingGrid(gridDateInput.value));
    userFilter.addEventListener('change', () => {
        const selectedEmail = userFilter.value;
        const allReservations = getAllReservations();
        const filteredReservations = selectedEmail
            ? allReservations.filter(res => res.email === selectedEmail)
            : allReservations;
        displayReservations(filteredReservations, getUser()?.role === 'admin', getUser()?.email);
    });
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
        if (getUser()?.role !== 'admin') return;

        const selectedUser = userFilter.value;
        if (selectedUser) {
            if (confirm(`¿Está seguro de que desea eliminar TODAS las reservas para ${selectedUser}? Esta acción no se puede deshacer.`)) {
                try {
                    await deleteAllReservationsForUser(selectedUser);
                    showToast(`Todas las reservas para ${selectedUser} han sido eliminadas.`);
                    initializeGridAndReservations();
                } catch (error) {
                    handleError(error);
                }
            }
        } else {
            if (confirm('¿Está seguro de que desea eliminar TODAS las reservas? Esta acción no se puede deshacer.')) {
                try {
                    await deleteAllReservations();
                    showToast('Todas las reservas han sido eliminadas.');
                    initializeGridAndReservations();
                } catch (error) {
                    handleError(error);
                }
            }
        }
    });
}
