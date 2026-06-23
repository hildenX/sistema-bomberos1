from django.contrib.auth.hashers import make_password
from django.db import migrations
import random
import unicodedata


PASSWORD_INICIAL = 'Bomberos123!'


def _ascii_slug(texto):
    texto = (texto or '').strip().lower()
    texto = unicodedata.normalize('NFKD', texto)
    texto = ''.join(ch for ch in texto if not unicodedata.combining(ch))
    return ''.join(ch for ch in texto if ch.isalnum())


def _generar_username(User, voluntario):
    primer_nombre = (voluntario.nombre or '').split()[0] if voluntario.nombre else 'v'
    apellido = voluntario.apellido_paterno or voluntario.apellido_materno or voluntario.rut or 'bombero'
    base = f"{_ascii_slug(primer_nombre[:1])}{_ascii_slug(apellido)}"
    base = base or f"v{_ascii_slug(voluntario.rut)}"

    indices = list(range(100))
    random.shuffle(indices)
    for numero in indices:
        username = f"{base}.{numero:02d}"
        if not User.objects.filter(username=username).exists():
            return username
    raise RuntimeError(f'No se pudo generar username para voluntario {voluntario.id}')


def crear_portales_existentes(apps, schema_editor):
    Voluntario = apps.get_model('voluntarios', 'Voluntario')
    PortalVoluntarioProfile = apps.get_model('voluntarios', 'PortalVoluntarioProfile')
    User = apps.get_model('auth', 'User')

    for voluntario in Voluntario.objects.all():
        if PortalVoluntarioProfile.objects.filter(voluntario_id=voluntario.id).exists():
            continue

        username = _generar_username(User, voluntario)
        user = User.objects.create(
            username=username,
            first_name=(voluntario.nombre or '').strip()[:150],
            last_name=' '.join(filter(None, [voluntario.apellido_paterno, voluntario.apellido_materno]))[:150],
            email=voluntario.email or '',
            password=make_password(PASSWORD_INICIAL),
        )
        PortalVoluntarioProfile.objects.create(
            voluntario_id=voluntario.id,
            user_id=user.id,
            activo=True,
            debe_cambiar_clave=True,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('voluntarios', '0021_portalvoluntarioprofile_solicitudpagoportal'),
    ]

    operations = [
        migrations.RunPython(crear_portales_existentes, migrations.RunPython.noop),
    ]
