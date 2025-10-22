import { createReservation } from '../api.js';
import { showToast } from '../toast.js';
import { setAppState, getSelectedSpotDetails } from '../store.js';

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

function populateTimeSelects(spot, date) {
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const confirmModalReservationBtn = document.getElementById('confirmModalReservation');

    startTimeInput.innerHTML = '';
    endTimeInput.innerHTML = '';

    if (!date || !spot) return;

    let availableStartSlots = spot.timeSlots.filter(slot => !slot.isReserved);

    const requestDate = new Date(`${date}T00:00:00`);
    const isWeekend = requestDate.getDay() === 0 || requestDate.getDay() === 6; // Sunday=0, Saturday=6
    const isRadisonSpot = spot.name && spot.name.startsWith('RADISON');

    if (isWeekend && isRadisonSpot) {
        addOption(startTimeInput, 'No disponible en fin de semana', '', true);
        addOption(endTimeInput, 'No disponible en fin de semana', '', true);
        confirmModalReservationBtn.disabled = true;
        startTimeInput.disabled = true;
        endTimeInput.disabled = true;
        return;
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayISO = `${year}-${month}-${day}`;

    if (date === todayISO) {
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
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const selectedStartTime = startTimeInput.value;
    endTimeInput.innerHTML = '';
    endTimeInput.disabled = true;

    if (!selectedStartTime) {
        addOption(endTimeInput, 'Seleccione entrada', '', true, true);
        return;
    }

    const { timeSlots } = getSelectedSpotDetails();
    const startIndex = timeSlots.findIndex(slot => slot.startTime === selectedStartTime);
    if (startIndex === -1) return;

    addOption(endTimeInput, timeSlots[startIndex].endTime, timeSlots[startIndex].endTime);

    for (let i = startIndex + 1; i < timeSlots.length; i++) {
        const slot = timeSlots[i];
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

async function handleConfirmReservation() {
    const { spotId, date } = getSelectedSpotDetails();
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');

    const reservationData = {
        spotId: spotId,
        date: date,
        startTime: startTimeInput.value,
        endTime: endTimeInput.value,
    };

    try {
        const result = await createReservation(reservationData);
        showToast(result.message || 'Reserva creada exitosamente!');
        closeModal();
        // The grid and reservations are updated in the reservations module
        // so we just need to trigger the update
        const { initializeGridAndReservations } = await import('./reservations.js');
        initializeGridAndReservations();
    } catch (error) {
        handleError(error);
    }
}

export function openModal(spot) {
    const gridDateInput = document.getElementById('gridDate');
    setAppState({
        allTimeSlotsForSpot: spot.timeSlots,
        selectedSpotId: spot.id,
        selectedDate: gridDateInput.value
    });
    document.getElementById('modalSpotName').textContent = spot.name;
    document.getElementById('modalDateDisplay').textContent = gridDateInput.value;
    populateTimeSelects(spot, gridDateInput.value);
    document.getElementById('reservationModal').style.display = 'block';
}

export function closeModal() {
    document.getElementById('reservationModal').style.display = 'none';
}

export function initModal() {
    const reservationModal = document.getElementById('reservationModal');
    const modalCloseBtn = reservationModal.querySelector('.close');
    const startTimeInput = document.getElementById('startTime');
    const confirmModalReservationBtn = document.getElementById('confirmModalReservation');

    modalCloseBtn.addEventListener('click', () => closeModal());
    window.addEventListener('click', (event) => {
        if (event.target === reservationModal) closeModal();
    });
    startTimeInput.addEventListener('change', () => updateEndTimeOptions());
    confirmModalReservationBtn.addEventListener('click', handleConfirmReservation);
}
