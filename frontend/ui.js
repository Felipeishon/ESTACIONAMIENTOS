export function displayReservations(reservations) {
    const reservationsList = document.getElementById('reservationsList');
    reservationsList.innerHTML = '';

    if (reservations.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No hay reservas existentes.';
        reservationsList.appendChild(emptyMessage);
        return;
    }

    const sortedReservations = [...reservations].sort((a, b) =>
        new Date(a.date) - new Date(b.date)
    );

    sortedReservations.forEach(reservation => {
        const reservationElement = document.createElement('div');
        reservationElement.className = 'reservation-card';
        const userDisplay = reservation.name || reservation.user || reservation.email; // Fallback for older reservations

        reservationElement.innerHTML = `
            <button class="delete-btn" data-reservation-id="${reservation.id}" aria-label="Cancelar reserva del espacio ${reservation.spotId} para ${userDisplay}">Cancelar</button>
            <h3>${reservation.spotName || `Espacio #${reservation.spotId}`}</h3>
            <p>Fecha: <span class="reservation-date">${reservation.date}</span></p>
            <p>Horario: <span class="reservation-time">${reservation.startTime} - ${reservation.endTime}</span></p>
            <p>Reservado por: <span class="reservation-user">${userDisplay}</span></p>
        `;

        reservationsList.appendChild(reservationElement);
    });
}

export function resetForm() {
    const emailSection = document.getElementById('emailSection');
    const emailForm = document.getElementById('emailForm');
    const reservationSection = document.getElementById('reservationSection');
    const parkingGrid = document.getElementById('parkingGrid');

    emailForm.reset();
    emailSection.style.display = 'block';
    reservationSection.style.display = 'none';
    parkingGrid.innerHTML = '';
}