"""
Bot de Telegram de Tesorería (long-polling, sin librerías externas de Telegram).

Etapa 1: vinculación de cuenta.
  /start -> pide USUARIO del portal -> pide CÓDIGO (generado en el portal)
         -> pide compartir TELÉFONO (botón nativo de Telegram, número verificado)
         -> si todo coincide, guarda el chat_id en el perfil del portal.

Correr como servicio:  python manage.py run_telegram_bot
Token: variable de entorno TELEGRAM_BOT_TOKEN (en el .env).
"""
import time

import requests
from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.utils import timezone
from decouple import config

from voluntarios.models import PortalVoluntarioProfile
from voluntarios.telegram_utils import normalizar_telefono, codigo_vigente

API = 'https://api.telegram.org/bot{token}/{metodo}'

# Estado de conversación en memoria: chat_id -> {'paso': ..., 'usuario': ...}
ESTADOS = {}


class Command(BaseCommand):
    help = 'Corre el bot de Telegram de Tesorería (long-polling).'

    def handle(self, *args, **options):
        token = config('TELEGRAM_BOT_TOKEN', default='')
        if not token:
            self.stderr.write('Falta TELEGRAM_BOT_TOKEN en el .env')
            return
        self.token = token
        self.stdout.write('Bot de Tesorería iniciado. Esperando mensajes...')

        offset = None
        while True:
            try:
                updates = self._get_updates(offset)
            except Exception as e:  # red caída, timeout, etc. -> reintentar
                self.stderr.write(f'getUpdates error: {e}')
                time.sleep(3)
                continue

            for upd in updates:
                offset = upd['update_id'] + 1
                close_old_connections()
                try:
                    self._procesar(upd)
                except Exception as e:
                    self.stderr.write(f'Error procesando update: {e}')

    # ---------- API de Telegram ----------
    def _get_updates(self, offset):
        r = requests.get(
            API.format(token=self.token, metodo='getUpdates'),
            params={'offset': offset, 'timeout': 30},
            timeout=40,
        )
        return r.json().get('result', [])

    def _enviar(self, chat_id, texto, pedir_contacto=False, quitar_teclado=False):
        data = {'chat_id': chat_id, 'text': texto, 'parse_mode': 'HTML'}
        if pedir_contacto:
            data['reply_markup'] = {
                'keyboard': [[{'text': '📱 Compartir mi número', 'request_contact': True}]],
                'resize_keyboard': True, 'one_time_keyboard': True,
            }
        elif quitar_teclado:
            data['reply_markup'] = {'remove_keyboard': True}
        requests.post(
            API.format(token=self.token, metodo='sendMessage'),
            json=data, timeout=20,
        )

    # ---------- Lógica ----------
    def _procesar(self, upd):
        msg = upd.get('message')
        if not msg:
            return
        chat_id = msg['chat']['id']

        # Contacto compartido (paso teléfono)
        if 'contact' in msg:
            return self._paso_telefono(chat_id, msg)

        texto = (msg.get('text') or '').strip()
        if not texto:
            return

        if texto.lower().startswith('/start'):
            return self._inicio(chat_id)

        estado = ESTADOS.get(chat_id)
        if not estado:
            return self._enviar(chat_id, 'Escribe /start para vincular tu cuenta.')

        if estado['paso'] == 'usuario':
            estado['usuario'] = texto
            estado['paso'] = 'codigo'
            self._enviar(chat_id, 'Ahora mándame el <b>código de vinculación</b> que generaste en el portal.')
        elif estado['paso'] == 'codigo':
            self._paso_codigo(chat_id, estado, texto)

    def _inicio(self, chat_id):
        ya = PortalVoluntarioProfile.objects.filter(telegram_chat_id=chat_id, activo=True).first()
        if ya:
            ESTADOS.pop(chat_id, None)
            return self._enviar(
                chat_id,
                f'Tu Telegram ya está vinculado a <b>{ya.user.username}</b>. '
                'Pronto podrás registrar pagos por aquí.',
                quitar_teclado=True,
            )
        ESTADOS[chat_id] = {'paso': 'usuario'}
        self._enviar(
            chat_id,
            '👋 Bienvenido al bot de Tesorería de la Sexta.\n\n'
            'Para vincular tu cuenta, mándame tu <b>usuario</b> del portal.',
            quitar_teclado=True,
        )

    def _paso_codigo(self, chat_id, estado, codigo):
        profile = (PortalVoluntarioProfile.objects
                   .filter(user__username__iexact=estado['usuario'], activo=True)
                   .select_related('user', 'voluntario').first())
        if not profile or not codigo_vigente(profile, codigo):
            return self._enviar(
                chat_id,
                '❌ Usuario o código inválido/vencido. Genera un código nuevo en el '
                'portal y vuelve a intentar con /start.',
            )
        estado['profile_id'] = profile.id
        estado['paso'] = 'telefono'
        self._enviar(
            chat_id,
            '✅ Código correcto. Último paso: comparte tu número con el botón de abajo '
            'para confirmar que eres tú.',
            pedir_contacto=True,
        )

    def _paso_telefono(self, chat_id, msg):
        estado = ESTADOS.get(chat_id)
        if not estado or estado.get('paso') != 'telefono':
            return self._enviar(chat_id, 'Escribe /start para empezar.')

        contacto = msg['contact']
        # Debe ser el número del propio usuario, no uno reenviado
        if contacto.get('user_id') != msg['from']['id']:
            return self._enviar(chat_id, '❌ Comparte <b>tu propio</b> número, no el de otro contacto.')

        profile = (PortalVoluntarioProfile.objects
                   .select_related('voluntario').filter(id=estado['profile_id']).first())
        if not profile:
            ESTADOS.pop(chat_id, None)
            return self._enviar(chat_id, 'Hubo un problema. Intenta de nuevo con /start.')

        tel_telegram = normalizar_telefono(contacto.get('phone_number'))
        tel_ficha = normalizar_telefono(profile.voluntario.telefono)
        if not tel_ficha:
            ESTADOS.pop(chat_id, None)
            return self._enviar(
                chat_id,
                '❌ Tu ficha no tiene un teléfono válido registrado. Avísale al tesorero '
                'para que lo actualice y luego vuelve a intentar.',
                quitar_teclado=True,
            )
        if tel_telegram != tel_ficha:
            return self._enviar(
                chat_id,
                '❌ El número de tu Telegram no coincide con el registrado en tu ficha. '
                'Si cambiaste de número, avísale al tesorero.',
                quitar_teclado=True,
            )

        # Vinculación exitosa
        profile.telegram_chat_id = chat_id
        profile.telegram_codigo = None
        profile.telegram_codigo_expira = None
        profile.telegram_vinculado_at = timezone.now()
        profile.save(update_fields=['telegram_chat_id', 'telegram_codigo',
                                    'telegram_codigo_expira', 'telegram_vinculado_at', 'updated_at'])
        ESTADOS.pop(chat_id, None)
        self._enviar(
            chat_id,
            f'🎉 ¡Listo, {profile.voluntario.nombre}! Tu Telegram quedó vinculado. '
            'Pronto podrás registrar tus pagos por aquí.',
            quitar_teclado=True,
        )
