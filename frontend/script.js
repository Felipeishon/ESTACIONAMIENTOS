import { getParkingSpots, createReservation, getReservations, deleteReservation, deleteAllReservations, deleteAllReservationsForUser, login, register, forgotPassword, resetPassword, getUsers, updateUser } from './api.js';
import { displayReservations, showView, displayUsers } from './ui.js';
import { showToast } from './toast.js';
import { setAppState, getUser, getAllReservations, getSelectedSpotDetails, subscribe, getAllUsers } from './store.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const loginForm = document.getElementById('loginForm');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    
    const registerForm = document.getElementById('registerForm');

    const showRegisterLink = document.getElementById('showRegisterLink');
    const showLoginLink = document.getElementById('showLoginLink');
    const loginView = document.getElementById('loginView');
    const registerView = document.getElementById('registerView');

    const logoutButton = document.getElementById('logoutButton');
    const themeToggleButton = document.getElementById('theme-toggle');

    const reservationHeading = document.getElementById('reservation-heading');
    const parkingGrid = document.getElementById('parkingGrid');
    const reservationsList = document.getElementById('reservationsList');
    const gridDateInput = document.getElementById('gridDate');
    const deleteAllButton = document.getElementById('deleteAllButton');
    const adminFilters = document.getElementById('adminFilters');
    const userFilter = document.getElementById('userFilter');

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

    // Elementos de Admin
    const adminSection = document.getElementById('adminSection');
    const usersTableBody = document.getElementById('usersTableBody');
    const editUserModal = document.getElementById('editUserModal');
    const editUserForm = document.getElementById('editUserForm');
    const userSearchInput = document.getElementById('userSearchInput');

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
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value.trim();

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

    const handleRegister = async (event) => {
        event.preventDefault();
        
        const formData = new FormData(registerForm);
        const data = Object.fromEntries(formData.entries());

        if (!data.name || !data.email || !data.password) {
            return showToast('Por favor, complete al menos nombre, correo y contraseña.');
        }

        // Formatear el número de teléfono antes de enviar
        if (data.phone_number) {
            data.phone_number = `+56${data.phone_number.replace(/\s/g, '')}`;
        }

        try {
            await register(data); // Enviamos el objeto completo con todos los campos
            showToast('Registro exitoso. Ahora puede iniciar sesión.');
            registerForm.reset();
            loginView.style.display = 'block';
            registerView.style.display = 'none';
        } catch (error) {
            handleError(error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setAppState({ token: null, user: null });
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
                setAppState({ token: token, user: decodeToken(token) });
                logoutButton.style.display = 'block';
                reservationHeading.textContent = `Reservar Estacionamiento (${getUser().name})`;
                showView('reservationSection');
                if (getUser().role === 'admin') {
                    adminSection.style.display = 'block'; // Usar display directo en lugar de showView
                    loadUsers();
                }
                initializeGridAndReservations();
            } else {
                setAppState({ token: null, user: null });
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
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    logoutButton.addEventListener('click', handleLogout);
    window.addEventListener('hashchange', handleRouteChange);

    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.style.display = 'none';
        registerView.style.display = 'block';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerView.style.display = 'none';
        loginView.style.display = 'block';
    });

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
                    // This function needs to be created in api.js
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

    // --- Lógica de Admin ---
    async function loadUsers() {
        try {
            setAppState({ allUsers: [] }); // Limpiar estado previo
            const users = await getUsers();
            setAppState({ allUsers: users }); // Guardar usuarios en el store
            displayUsers(usersTableBody, users, openEditUserModal);
        } catch (error) {
            handleError(error, 'Error al cargar los usuarios.');
        }
    }

    function openEditUserModal(user) {
        editUserForm.innerHTML = `
            <input type="hidden" id="editUserId" value="${user.id}">
            <div class="form-group"><label>Nombre:</label><input type="text" id="editUserName" value="${user.name}"></div>
            <div class="form-group"><label>Email:</label><input type="email" id="editUserEmail" value="${user.email}" disabled></div>
            <div class="form-group"><label>RUT:</label><input type="text" id="editUserRut" value="${user.rut || ''}"></div>
            <div class="form-group"><label>Patente:</label><input type="text" id="editUserPlate" value="${user.license_plate || ''}"></div>
            <div class="form-group"><label>Teléfono:</label><input type="text" id="editUserPhone" value="${user.phone_number || ''}"></div>
            <div class="form-group">
                <label>Rol:</label>
                <select id="editUserRole">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>Usuario</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </div>
            <button type="submit">Guardar Cambios</button>
        `;
        editUserModal.style.display = 'block';
    }

    document.getElementById('editUserModalClose').addEventListener('click', () => editUserModal.style.display = 'none');
    editUserForm.addEventListener('submit', handleUpdateUser);
    userSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const allUsers = getAllUsers();
        const filteredUsers = allUsers.filter(user => 
            user.name.toLowerCase().includes(searchTerm) || 
            user.email.toLowerCase().includes(searchTerm)
        );
        displayUsers(usersTableBody, filteredUsers, openEditUserModal);
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
        if (error.status === 401) {
            showToast('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
            handleLogout();
        } else {
            showToast(userMessage || error.message);
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
        userFilter.innerHTML = '<option value="">Todos los usuarios</option>';
        const userEmails = [...new Set(reservations.map(res => res.email))];
        userEmails.sort().forEach(email => {
            addOption(userFilter, email, email);
        });
    }

    // --- FUNCIONES PRINCIPALES DE LA APP ---
    function initializeGridAndReservations() {
        if (getUser()?.role === 'admin') {
            document.getElementById('my-reservations-heading').textContent = 'Reservas';
            deleteAllButton.style.display = 'block';
        }
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayISO = `${year}-${month}-${day}`;

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
        const { spotId, date } = getSelectedSpotDetails();
        const reservationData = {
            spotId: spotId,
            date: date,
            startTime: startTimeInput.value,
            endTime: endTimeInput.value,
        };

        try {
            const result = await createReservation(reservationData);
            const user = getUser();
            showToast(result.message || 'Reserva creada exitosamente!');
            closeModal();
            // Actualizar la grilla y la lista de reservas para todos los usuarios
            redrawParkingGrid(result.gridState);
            loadAndDisplayReservations(); // <-- ESTA ES LA LÍNEA CLAVE
        } catch (error) {
            handleError(error);
        }
    }

    function openModal(spot) {
        setAppState({
            allTimeSlotsForSpot: spot.timeSlots, // Guardar los horarios del spot seleccionado
            selectedSpotId: spot.id,
            selectedDate: gridDateInput.value
        });
        document.getElementById('modalSpotName').textContent = spot.name;
        document.getElementById('modalDateDisplay').textContent = gridDateInput.value;
        populateTimeSelects(spot, gridDateInput.value);
        reservationModal.style.display = 'block';
    }

    function closeModal() {
        reservationModal.style.display = 'none';
    }

    function populateTimeSelects(spot, date) {
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

        // El primer slot de salida es el final del slot de entrada
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

    async function handleUpdateUser(event) {
        event.preventDefault();
        const userId = document.getElementById('editUserId').value;
        const userData = {
            name: document.getElementById('editUserName').value,
            rut: document.getElementById('editUserRut').value,
            license_plate: document.getElementById('editUserPlate').value,
            phone_number: document.getElementById('editUserPhone').value,
            role: document.getElementById('editUserRole').value,
        };

        try {
            const result = await updateUser(userId, userData);
            showToast(result.message);
            editUserModal.style.display = 'none';
            loadUsers(); // Recargar la lista de usuarios
        } catch (error) {
            handleError(error, 'Error al actualizar el usuario.');
        }
    }


    async function loadAndDisplayReservations() {
        try {
            document.getElementById('myReservationsSection').classList.remove('hidden');
            const reservations = await getReservations();
            const user = getUser();
            setAppState({ allReservations: reservations }); // Store all reservations

            if (user?.role === 'admin') {
                adminFilters.style.display = 'block';
                populateUserFilter(reservations);
            }

            displayReservations(reservations, user?.role === 'admin', user?.email);
        } catch (error) {
            handleError(error);
        }
    }

    initializeApp();
});
