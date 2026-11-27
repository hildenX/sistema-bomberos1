"""
Utilidades para el bot de Telegram de Tesorería.
Sin dependencias externas: solo normalización de teléfono y generación de códigos.
"""
import re
import secrets
import string
from datetime import timedelta

from django.utils import timezone

# Minutos de validez del código de vinculación generado desde el portal
CODIGO_VALIDEZ_MIN = 15


def normalizar_telefono(raw):
    """
    Deja un teléfono chileno en su parte comparable: los últimos 8 dígitos
    (el número de abonado, después del 9 móvil y del código país 56).

    Ejemplos:
      '942297858'        -> '42297858'
      '+56 9 9739 1593'  -> '97391593'
      '56997391593'      -> '97391593'  (lo que entrega Telegram)
      'S/N' / ''         -> ''          (no comparable)
    """
    if not raw:
        return ''
    digitos = re.sub(r'\D', '', str(raw))
    if len(digitos) < 8:
        return ''
    return digitos[-8:]


def generar_codigo():
    """Código corto de un solo uso, fácil de tipear (sin caracteres ambiguos)."""
    alfabeto = string.ascii_uppercase.replace('O', '').replace('I', '') + '23456789'
    return ''.join(secrets.choice(alfabeto) for _ in range(6))


def asignar_codigo_vinculacion(profile):
    """Genera y guarda un código con vencimiento en el perfil del portal."""
    codigo = generar_codigo()
    profile.telegram_codigo = codigo
    profile.telegram_codigo_expira = timezone.now() + timedelta(minutes=CODIGO_VALIDEZ_MIN)
    profile.save(update_fields=['telegram_codigo', 'telegram_codigo_expira', 'updated_at'])
    return codigo


def codigo_vigente(profile, codigo):
    """True si el código coincide y no está vencido."""
    if not profile.telegram_codigo or not profile.telegram_codigo_expira:
        return False
    if profile.telegram_codigo.upper() != (codigo or '').strip().upper():
        return False
    return timezone.now() <= profile.telegram_codigo_expira
