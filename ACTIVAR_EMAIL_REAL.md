# 📧 Activar Envío REAL de Emails - Paso a Paso

## ✅ YA ESTÁ CASI LISTO

El sistema ya está configurado para enviar emails reales por Gmail.
Solo necesitas completar TUS credenciales.

---

## 🔑 PASO 1: Conseguir Contraseña de Aplicación de Gmail

1. **Abre tu navegador** e inicia sesión en Gmail

2. **Ve a la configuración de seguridad:**
   ```
   https://myaccount.google.com/apppasswords
   ```

3. **Si te pide verificación en 2 pasos:**
   - Actívala primero en: https://myaccount.google.com/security
   - Sigue las instrucciones de Google
   - Vuelve a https://myaccount.google.com/apppasswords

4. **Crear contraseña de aplicación:**
   - En "Seleccionar app": Elige **"Correo"**
   - En "Seleccionar dispositivo": Elige **"Otro"** y escribe: "Django Bomberos"
   - Haz clic en **"Generar"**

5. **Copiar la contraseña:**
   - Te mostrará algo como: `abcd efgh ijkl mnop` (16 caracteres)
   - **COPIA ESTA CONTRASEÑA** (la necesitas en el siguiente paso)

---

## ⚙️ PASO 2: Editar config/settings.py

1. **Abre el archivo:**
   ```
   fase2\bomberos_django\config\settings.py
   ```

2. **Busca las líneas 180-181** (están al final del archivo):
   ```python
   EMAIL_HOST_USER = 'tu_email@gmail.com'  # ← CAMBIA ESTO
   EMAIL_HOST_PASSWORD = 'xxxx xxxx xxxx xxxx'  # ← CAMBIA ESTO
   ```

3. **Reemplaza con TUS datos:**
   ```python
   EMAIL_HOST_USER = 'tuemailreal@gmail.com'  # Tu email de Gmail
   EMAIL_HOST_PASSWORD = 'abcd efgh ijkl mnop'  # La contraseña de app que copiaste
   ```

4. **Guarda el archivo** (Ctrl + S)

---

## 🚀 PASO 3: Reiniciar Django

1. **Para el servidor Django** (Ctrl + C en la terminal donde está corriendo)

2. **Vuelve a iniciarlo:**
   ```bash
   python manage.py runserver
   ```

---

## ✅ PASO 4: Probar el Envío

1. **Entra al sistema:** http://localhost:8000/sistema.html

2. **Selecciona un voluntario** que TENGA email configurado

3. **Haz clic en "💰 Cuotas"**

4. **Registra un pago** de cualquier mes

5. **Revisa el email del voluntario** - Debería llegar el comprobante en HTML bonito 🎉

---

## 🔍 Verificar en la Consola

Cuando registres el pago, en la terminal de Django deberías ver algo como:

```
[26/Nov/2025 03:45:00] "POST /api/voluntarios/pagos-cuotas-simple/ HTTP/1.1" 201 150
Enviando email a: cristian.vera@email.com
✅ Email enviado exitosamente
```

---

## ⚠️ IMPORTANTE

1. **El voluntario DEBE tener email configurado** en su perfil
   - Si no tiene, el comprobante no se envía (pero el pago sí se registra)

2. **Gmail tiene límite de 500 emails por día** en cuentas gratuitas

3. **NUNCA uses tu contraseña normal de Gmail**, solo la contraseña de aplicación

4. **Si tienes problemas:**
   - Verifica que el email del voluntario esté correcto
   - Revisa la carpeta de Spam
   - Mira la consola de Django para ver errores

---

## 🎯 Ejemplo Completo

```python
# En settings.py líneas 180-181:
EMAIL_HOST_USER = 'sistema.bomberos@gmail.com'
EMAIL_HOST_PASSWORD = 'abcd efgh ijkl mnop'
```

---

## 📱 El Email que se Envía

El voluntario recibirá un email con:

- 🚒 Logo y encabezado profesional
- 📋 N° de comprobante único
- 👤 Datos del voluntario
- 📅 Período y fecha de pago
- 💰 Monto destacado en grande
- 📄 Diseño bomberil (rojo y blanco)

---

¡Listo! Ahora sí se enviarán emails REALES 📧🚀
