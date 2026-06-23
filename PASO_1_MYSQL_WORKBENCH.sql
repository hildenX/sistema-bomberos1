-- =========================================================
-- PASO 1: CREAR BASE DE DATOS EN MYSQL WORKBENCH
-- Sistema de Gestión de Bomberos P6P
-- =========================================================

-- INSTRUCCIONES:
-- 1. Abre MySQL Workbench
-- 2. Haz clic en tu conexión local (Local instance MySQL)
-- 3. Copia TODO este script
-- 4. Pégalo en el editor de consultas (Query tab)
-- 5. Presiona el rayo ⚡ o Ctrl+Shift+Enter para ejecutar
-- 6. Verifica que no haya errores en el panel inferior

-- =========================================================

-- Eliminar base de datos si existe (para empezar limpio)
DROP DATABASE IF EXISTS bomberos_p6p;

-- Crear base de datos con codificación UTF-8
CREATE DATABASE bomberos_p6p
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- Seleccionar la base de datos
USE bomberos_p6p;

-- Crear usuario para Django (si ya existe, lo eliminamos primero)
DROP USER IF EXISTS 'bomberos_user'@'localhost';
CREATE USER 'bomberos_user'@'localhost' IDENTIFIED BY 'Bomberos2025!';

-- Dar permisos completos al usuario sobre la base de datos
GRANT ALL PRIVILEGES ON bomberos_p6p.* TO 'bomberos_user'@'localhost';

-- Aplicar cambios
FLUSH PRIVILEGES;

-- =========================================================
-- VERIFICACIÓN
-- =========================================================

-- Ver las bases de datos (debes ver bomberos_p6p)
SHOW DATABASES;

-- Ver el usuario creado
SELECT User, Host FROM mysql.user WHERE User = 'bomberos_user';

-- =========================================================
-- DATOS DE CONEXIÓN PARA DJANGO
-- =========================================================
-- Base de datos: bomberos_p6p
-- Usuario:       bomberos_user
-- Contraseña:    Bomberos2025!
-- Host:          localhost
-- Puerto:        3306
-- =========================================================

-- ✅ Si ves bomberos_p6p en la lista, continúa con el PASO 2
