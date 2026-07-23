"""
Django settings for Bomberos project.
"""

from pathlib import Path
from decouple import config
import dj_database_url

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-bomberos-2024-change-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default='True').lower() in ('true', '1', 'yes')

# Hosts permitidos: por env (coma-separado). Default '*' para dev/Render.
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='*').split(',')

# ---- Endurecimiento de seguridad (seguro sin HTTPS aún) ----
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
X_FRAME_OPTIONS = 'SAMEORIGIN'
# Cuando haya dominio + SSL, activar también:
#   SECURE_SSL_REDIRECT = True
#   SESSION_COOKIE_SECURE = True
#   CSRF_COOKIE_SECURE = True
#   SECURE_HSTS_SECONDS = 31536000

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'voluntarios',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database - SQLite en local, PostgreSQL (DATABASE_URL) en Render/produccion
DATABASES = {
    'default': dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# MySQL config (producción)
"""
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'bomberos_p6p',
        'USER': 'bomberos_user',
        'PASSWORD': 'Bomberos2025!',
        'HOST': 'localhost',
        'PORT': '3306',
        'OPTIONS': {
            'charset': 'utf8mb4',
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        }
    }
}
"""

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'es-cl'
TIME_ZONE = 'America/Santiago'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']

# WhiteNoise: comprime y sirve los estaticos en produccion (Render)
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage'},
}

# Media files
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',  # Cambiar a AllowAny temporalmente
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 500,
}

# CORS - SIMPLIFICADO para desarrollo local
CORS_ALLOW_ALL_ORIGINS = True  # Permitir todos los orígenes en desarrollo
CORS_ALLOW_CREDENTIALS = True  # Permitir cookies

# Login
LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'dashboard'
LOGOUT_REDIRECT_URL = 'login'

# SESSION CONFIGURATION
SESSION_ENGINE = 'django.contrib.sessions.backends.db'  # Guardar en base de datos
SESSION_COOKIE_NAME = 'sessionid'
SESSION_COOKIE_AGE = 86400  # 24 horas
SESSION_SAVE_EVERY_REQUEST = True  # Actualizar cookie en cada request
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'  # Permitir cookies en navegación normal
SESSION_COOKIE_SECURE = False  # False para localhost (HTTP)

# CSRF CONFIGURATION
CSRF_COOKIE_HTTPONLY = False  # Permitir leer desde JavaScript
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = False  # False para localhost (HTTP)
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'https://*.pythonanywhere.com',
    'https://*.onrender.com',
]

# EMAIL CONFIGURATION - Para envío de comprobantes

# ====================================================================
# OPCIÓN 1: DESARROLLO - Solo imprime en consola (ACTUAL)
# ====================================================================
# EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# ====================================================================
# OPCIÓN 2: PRODUCCIÓN - Envío REAL por Gmail (ACTIVAR ESTA)
# ====================================================================
# INSTRUCCIONES:
# 1. Ve a https://myaccount.google.com/apppasswords
# 2. Genera una "Contraseña de aplicación" para Correo
# 3. Copia la contraseña (16 caracteres)
# 4. Descomenta las siguientes 5 líneas
# 5. Reemplaza 'tu_email@gmail.com' y 'tu_contraseña_app'
# 6. Reinicia el servidor Django

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')

DEFAULT_FROM_EMAIL = 'Sistema Bomberos <noreply@bomberos.cl>'
EMAIL_SUBJECT_PREFIX = '[Bomberos] '
