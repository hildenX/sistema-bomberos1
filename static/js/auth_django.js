// ==================== SISTEMA DE AUTENTICACIÓN - DJANGO VERSION ====================
// Migrado desde auth.js del p6p para usar APIs de Django

// URL base de la API
const API_BASE_URL = '/api';

// Variable global para el usuario actual
let currentUser = null;

// ==================== PERMISOS (se obtienen del backend) ====================
let userPermissions = null;

// Función para obtener permisos del usuario actual
function getUserPermissions() {
    return userPermissions;
}

// ==================== FUNCIONES DE API ====================

// Helper para hacer requests a la API
async function apiRequest(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        credentials: 'include', // CRÍTICO: Incluir cookies
    };
    
    // Merge options
    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {}),
        },
    };
    
    // Agregar CSRF token si es necesario
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(finalOptions.method)) {
        const csrfToken = getCookie('csrftoken');
        if (csrfToken) {
            finalOptions.headers['X-CSRFToken'] = csrfToken;
        }
    }
    
    const fullUrl = API_BASE_URL + url;
    console.log('[API Request]', finalOptions.method || 'GET', fullUrl);
    
    try {
        const response = await fetch(fullUrl, finalOptions);
        
        console.log('[API Response]', response.status, response.statusText);
        
        if (!response.ok && response.status !== 401) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Error en la solicitud');
        }
        
        return response.json();
    } catch (error) {
        console.error('[API Error]', error);
        console.error('[API Error] URL:', fullUrl);
        console.error('[API Error] Options:', finalOptions);
        throw error;
    }
}

// Obtener cookie por nombre
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// ==================== AUTENTICACIÓN ====================

// Verificar si el usuario está autenticado
async function checkAuth() {
    console.log('[checkAuth] Iniciando verificación...');
    console.log('[checkAuth] Cookies:', document.cookie);
    console.log('[checkAuth] URL base:', window.location.origin);
    
    try {
        const checkUrl = '/api/auth/check/';
        console.log('[checkAuth] URL completa:', window.location.origin + checkUrl);
        
        // Hacer fetch DIRECTO sin helper, para debug
        console.log('[checkAuth] Haciendo fetch...');
        const response = await fetch(checkUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
            }
        });
        
        console.log('[checkAuth] Response recibido:', response.status, response.statusText);
        
        if (!response.ok) {
            console.error('[checkAuth] Response not OK:', response.status);
            return false;
        }
        
        const data = await response.json();
        console.log('[checkAuth] Data parseado:', data);
        
        if (data.authenticated && data.user) {
            currentUser = data.user;
            userPermissions = data.user.permissions;
            
            // Actualizar variable global de window
            window.currentUser = currentUser;
            window.userPermissions = userPermissions;
            
            // Guardar en localStorage para compatibilidad
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            console.log('[AUTH] Usuario autenticado:', currentUser.username, '| Rol:', currentUser.role);
            
            return true;
        }
        
        console.log('[checkAuth] Usuario NO autenticado según data');
        // Limpiar localStorage si no está autenticado
        localStorage.removeItem('currentUser');
        window.currentUser = null;
        window.userPermissions = null;
        return false;
        
    } catch (error) {
        console.error('[checkAuth] ERROR CATCH:', error);
        console.error('[checkAuth] Error name:', error.name);
        console.error('[checkAuth] Error message:', error.message);
        console.error('[checkAuth] Error stack:', error.stack);
        localStorage.removeItem('currentUser');
        window.currentUser = null;
        window.userPermissions = null;
        return false;
    }
}

// Redirigir si no está autenticado
async function requireAuth() {
    const isAuth = await checkAuth();
    if (!isAuth) {
        window.location.href = '/';
        return false;
    }
    return true;
}

// ==================== LOGIN ====================

// Manejar login
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    
    // Limpiar mensajes
    errorMessage.classList.remove('show');
    successMessage.classList.remove('show');
    
    // Estado de carga
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'VALIDANDO...';
    submitBtn.disabled = true;
    
    try {
        // Llamar a la API de login
        const data = await apiRequest('/auth/login/', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (data.success) {
            // Login exitoso
            currentUser = data.user;
            userPermissions = data.user.permissions;
            
            // Actualizar variable global de window
            window.currentUser = currentUser;
            window.userPermissions = userPermissions;
            
            // Guardar en localStorage para compatibilidad
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            console.log('[LOGIN] Exitoso:', currentUser.username, '| Rol:', currentUser.role);
            
            // Mostrar mensaje de éxito
            successMessage.textContent = data.message || `¡Bienvenido, ${data.user.role}!`;
            successMessage.classList.add('show');
            
            // Redirigir automáticamente después de 1 segundo
            setTimeout(() => {
                window.location.href = '/sistema.html';
            }, 1000);
        } else {
            throw new Error(data.error || 'Error de autenticación');
        }
        
    } catch (error) {
        // Error de login
        errorMessage.textContent = error.message || 'Usuario o contraseña incorrectos';
        errorMessage.classList.add('show');
        
        // Animación de shake
        document.querySelector('.login-container').style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            document.querySelector('.login-container').style.animation = '';
        }, 500);
        
        submitBtn.classList.remove('loading');
        submitBtn.textContent = 'INICIAR SESIÓN';
        submitBtn.disabled = false;
    }
}

// ==================== LOGOUT ====================

async function logout() {
    try {
        await apiRequest('/auth/logout/', { method: 'POST' });
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    } finally {
        // Limpiar datos locales
        localStorage.removeItem('currentUser');
        currentUser = null;
        userPermissions = null;
        
        // Redirigir al login
        window.location.href = '/';
    }
}

// ==================== UI ====================

// Crear partículas de fondo
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
        particlesContainer.appendChild(particle);
    }
}

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('[INIT] Página cargada:', window.location.pathname);
    
    // Si estamos en la página de login
    if (document.getElementById('loginForm')) {
        console.log('[LOGIN] Inicializando formulario de login');
        createParticles();
        document.getElementById('loginForm').addEventListener('submit', handleLogin);
        
        // NO verificar autenticación automáticamente
        console.log('[LOGIN] Esperando que usuario ingrese credenciales...');
    }
    
    // Console info (solo en desarrollo)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('=== SISTEMA DE LOGIN (DJANGO) ===');
        console.log('API Base URL:', API_BASE_URL);
        console.log('Para ver usuarios disponibles:');
        console.log('  Ejecuta: python manage.py crear_usuarios_p6p');
    }
});

// Exportar funciones para usar en otros módulos
window.checkAuth = checkAuth;
window.requireAuth = requireAuth;
window.logout = logout;
window.getUserPermissions = getUserPermissions;

// Inicializar variables globales
if (!window.currentUser) {
    window.currentUser = null;
}
if (!window.userPermissions) {
    window.userPermissions = null;
}
