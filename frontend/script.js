import { getParkingSpots, createReservation, getReservations, deleteReservation, getConfig } from './api.js';
import { displayReservations, resetForm } from './ui.js';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
    const emailSection = document.getElementById('emailSection');
    const emailForm = document.getElementById('emailForm');
    const emailInput = document.getElementById('email');
    const userNameInput = document.getElementById('userName');
    const reservationSection = document.getElementById('reservationSection');
    const parkingGrid = document.getElementById('parkingGrid');
    const reservationsList = document.getElementById('reservationsList');
    const gridDateInput = document.getElementById('gridDate');

    const reservationModal = document.getElementById('reservationModal');
    const modalCloseBtn = reservationModal.querySelector('.close');    
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const confirmModalReservationBtn = document.getElementById('confirmModalReservation');

    let allowedEmailDomain = '';
    let userEmail = '';
    let userName = '';
    let selectedSpotId = null;
    let selectedDate = null;
    let allTimeSlotsForSpot = [];

    // Fetch config and set allowed email domain
    getConfig()
        .then(config => {
            allowedEmailDomain = config.allowedEmailDomain;
            emailInput.pattern = `.+${allowedEmailDomain.replace('.', '\\.')}`;
            emailInput.title = `Por favor, use una dirección de correo electrónico de ${allowedEmailDomain}`;
        })
        .catch(error => {
            console.error('Error fetching config:', error);
            showToast('No se pudo cargar la configuración del servidor.');
        });

    emailForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = emailInput.value.trim();
        const name = userNameInput.value.trim();

        if (email.endsWith(allowedEmailDomain)) {
            userEmail = email;
            userName = name;
            emailSection.style.display = 'none';
            reservationSection.style.display = 'block';
            initializeGridAndReservations();
            loadAndDisplayReservations();
        } else {
            showToast(`Por favor, use una dirección de correo electrónico de ${allowedEmailDomain}`);
        }
    });

    modalCloseBtn.addEventListener('click', () => {
        closeModal();
    });

    window.addEventListener('click', (event) => {
        if (event.target === reservationModal) {
            closeModal();
        }
    });

    gridDateInput.addEventListener('change', () => {
        loadParkingGrid(gridDateInput.value);
    });

    startTimeInput.addEventListener('change', () => {
        updateEndTimeOptions();
    });

    confirmModalReservationBtn.addEventListener('click', async () => {
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;

        if (!startTime || !endTime) {
            showToast('Por favor, seleccione un horario de entrada y salida.');
            return;
        }

        const reservationData = {
            spotId: selectedSpotId,
            date: selectedDate,
            startTime: startTime,
            endTime: endTime,
            name: userName,
            email: userEmail,
        };

        try {
            const result = await createReservation(reservationData);
            showToast('Reserva creada exitosamente!');
            closeModal();
            // The API now returns the full state, so we just need to redraw.
            displayReservations(result.myReservations);
            redrawParkingGrid(result.gridState);
        } catch (error) {
            console.error('Error:', error);
            showToast(error.message);
        }
    });

    function initializeGridAndReservations() {
        const today = new Date().toISOString().split('T')[0];
        gridDateInput.value = today;
        loadParkingGrid(today);
        loadAndDisplayReservations();
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
                spotElement.tabIndex = -1; // Not focusable if fully reserved
            } else if (isPartiallyReserved) {
                spotElement.classList.add('partial');
                tooltipText = 'Reservas parciales:\n';

                // Group consecutive slots to form reservation blocks
                const reservationBlocks = [];
                let currentBlock = null;

                reservedSlots.forEach(slot => {
                    // A block is consecutive if the user is the same and the times touch
                    if (currentBlock && currentBlock.reservedBy === slot.reservedBy && currentBlock.endTime === slot.startTime) {
                        // Extend the current block
                        currentBlock.endTime = slot.endTime;
                    } else {
                        // Finish the previous block (if any) and start a new one
                        if (currentBlock) {
                            reservationBlocks.push(currentBlock);
                        }
                        currentBlock = {
                            reservedBy: slot.reservedBy,
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                        };
                    }
                });
                if (currentBlock) {
                    reservationBlocks.push(currentBlock); // Add the last block
                }

                // Create a summary for the tooltip from the blocks
                const summary = reservationBlocks.reduce((acc, block) => {
                    if (!acc[block.reservedBy]) acc[block.reservedBy] = [];
                    acc[block.reservedBy].push(`${block.startTime}-${block.endTime}`);
                    return acc;
                }, {});

                Object.entries(summary).forEach(([user, times]) => {
                    tooltipText += `- ${user || 'Desconocido'} (${times.join(', ')})\n`;
                });
            }

            if (isFullyReserved || isPartiallyReserved) {
                spotElement.title = tooltipText.trim();
            } else {
                spotElement.title = 'Haga clic para reservar este espacio';
            }

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

    async function openModal(spotId, spotName) {
        selectedSpotId = spotId;
        selectedDate = gridDateInput.value;

        document.getElementById('modalSpotName').textContent = spotName;
        document.getElementById('modalDateDisplay').textContent = selectedDate;

        startTimeInput.innerHTML = '';
        endTimeInput.innerHTML = '';
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
            startTimeInput.innerHTML = ''; // Clear loading message
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

            // Add a default placeholder option
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

        // Iterate through possible end points
        for (let i = startIndex; i < allTimeSlotsForSpot.length; i++) {
            const slot = allTimeSlotsForSpot[i];
            if (slot.isReserved) {
                // We've hit a reserved slot, so we can't book any further.
                break;
            }

            // The end time of the current slot is a valid end time for the reservation.
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

    async function loadAndDisplayReservations() {
        try {
            const reservations = await getReservations();
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set to the beginning of today to compare dates only

            // Filter reservations to show only those belonging to the current user and are for today or a future date
            const myReservations = reservations.filter(r => {
                // Timezone-safe parsing to avoid off-by-one day errors
                const reservationDate = new Date(`${r.date}T00:00:00`);
                return r.email === userEmail && reservationDate >= today;
            });
            displayReservations(myReservations);
        } catch (error) {
            console.error('Error:', error);
            showToast(error.message);
        }
    }

    reservationsList.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const reservationId = event.target.dataset.reservationId;
            try {
                const result = await deleteReservation(reservationId);
                showToast('Reserva cancelada exitosamente!');
                // The API returns the state for the date of the deleted reservation.
                // Update the grid date selector and redraw everything.
                gridDateInput.value = result.gridDate;
                displayReservations(result.myReservations);
                redrawParkingGrid(result.gridState);
            } catch (error) {
                console.error('Error:', error);
                showToast(error.message);
            }
        }
    });
});
