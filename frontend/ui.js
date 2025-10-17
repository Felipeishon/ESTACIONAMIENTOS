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
        const dateA = new Date(`${a.date}T${a.start_time}`);
        const dateB = new Date(`${b.date}T${b.start_time}`);
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
            <p>Fecha: <span class="reservation-date">${new Date(reservation.date).toLocaleDateString('es-CL')}</span></p>
            <p>Horario: <span class="reservation-time">${reservation.start_time} - ${reservation.end_time}</span></p>
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

    emailSection.style.display = 'block';
    reservationSection.style.display = 'none';
    parkingGrid.innerHTML = '';
}

export function showLoginForm() {
    const userNameInput = document.getElementById('userName');
    const registerButton = document.getElementById('registerButton');

    if (userNameInput) {
        userNameInput.parentElement.style.display = 'none';
    }
    if (registerButton) {
        registerButton.style.display = 'none';
    }
}

const allViews = ['authSection', 'reservationSection', 'forgotPasswordView', 'resetPasswordView', 'userManagementSection'];

export function showView(viewId) {
    allViews.forEach(id => {
        const view = document.getElementById(id);
        if (view) {
            view.style.display = 'none';
        }
    });

    const activeView = document.getElementById(viewId);
    if (activeView) {
        activeView.style.display = 'block';
    }
}

export function displayUsers(tableBody, users, onEdit) {
    tableBody.innerHTML = '';

    if (!users || users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No se encontraron usuarios.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.rut || 'No especificado'}</td>
            <td>${user.role}</td>
            <td>
                <button class="edit-user-btn" data-user-id="${user.id}">Editar</button>
            </td>
        `;
        
        const editButton = row.querySelector('.edit-user-btn');
        if (editButton) {
            editButton.addEventListener('click', () => {
                onEdit(user);
            });
        }
        tableBody.appendChild(row);
    });
}
