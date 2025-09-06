export function displayReservations(reservations, isAdmin = false, currentUserEmail = null) {
    const reservationsList = document.getElementById('reservationsList');
    reservationsList.innerHTML = '';

    if (!reservations || reservations.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No hay reservas activas.';
        reservationsList.appendChild(emptyMessage);
        return;
    }

    const sortedReservations = [...reservations].sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.startTime}`);
        const dateB = new Date(`${b.date}T${b.startTime}`);
        return dateA - dateB;
    });

    sortedReservations.forEach(reservation => {
        const reservationElement = document.createElement('div');
        reservationElement.className = 'reservation-card';
        const userDisplay = reservation.name || reservation.email;

        let deleteButtonHtml = '';
        const isOwner = currentUserEmail && reservation.email === currentUserEmail;

        // Mostrar botón si es admin, o si es la reserva del usuario
        if (isAdmin || isOwner) {
            const buttonText = isAdmin ? 'Eliminar' : 'Cancelar';
            const buttonClass = isAdmin ? 'delete-btn admin' : 'delete-btn';
            deleteButtonHtml = `
                <button class="${buttonClass}" 
                        data-reservation-id="${reservation.id}" 
                        data-user-email="${reservation.email}" 
                        aria-label="${buttonText} reserva del espacio ${reservation.spotName} para ${userDisplay}">
                    ${buttonText}
                </button>`;
        }

        reservationElement.innerHTML = `
            ${deleteButtonHtml}
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