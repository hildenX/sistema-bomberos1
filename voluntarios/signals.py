from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Voluntario
from .portal_utils import crear_acceso_portal_para_voluntario


@receiver(post_save, sender=Voluntario)
def crear_usuario_portal_voluntario(sender, instance, created, **kwargs):
    if not created:
        return
    crear_acceso_portal_para_voluntario(instance)
