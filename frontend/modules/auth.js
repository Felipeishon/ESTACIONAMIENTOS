import { login, register, forgotPassword, resetPassword } from '../api.js';
import { showView } from '../ui.js';
import { showToast } from '../toast.js';
import { setAppState } from '../store.js';
import { handleRouteChange } from './router.js';

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

const handleLogin = async (event) => {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

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
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();

    if (!name || !email || !password) {
        return showToast('Por favor, complete todos los campos para registrarse.');
    }

    try {
        await register(name, email, password);
        showToast('Registro exitoso. Ahora puede iniciar sesión.');
        document.getElementById('registerForm').reset();
        document.getElementById('loginView').style.display = 'block';
        document.getElementById('registerView').style.display = 'none';
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
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) return showToast('Por favor, ingresa tu correo electrónico.');

    try {
        const result = await forgotPassword(email);
        showToast(result.message);
        document.getElementById('forgotPasswordForm').reset();
        showView('authSection');
    } catch (error) {
        handleError(error);
    }
};

const handleResetPassword = async (event) => {
    event.preventDefault();
    const token = document.getElementById('resetToken').value;
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!password || password.length < 6) {
        return showToast('La contraseña debe tener al menos 6 caracteres.');
    }
    if (password !== confirmPassword) {
        return showToast('Las contraseñas no coinciden.');
    }

    try {
        const result = await resetPassword(token, password);
        showToast(result.message);
        document.getElementById('resetPasswordForm').reset();
        window.location.hash = ''; // Limpiar hash para volver al login
        handleRouteChange();
    } catch (error) {
        handleError(error);
    }
};


export function initAuth() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const logoutButton = document.getElementById('logoutButton');
    const showRegisterLink = document.getElementById('showRegisterLink');
    const showLoginLink = document.getElementById('showLoginLink');
    const loginView = document.getElementById('loginView');
    const registerView = document.getElementById('registerView');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const backToLoginButton = document.getElementById('backToLogin');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');

    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    logoutButton.addEventListener('click', handleLogout);

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

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        showView('forgotPasswordView');
    });
    backToLoginButton.addEventListener('click', () => showView('authSection'));
    forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    resetPasswordForm.addEventListener('submit', handleResetPassword);
}
