from django.apps import AppConfig


class VoluntariosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'voluntarios'
    verbose_name = 'Gestion de Voluntarios'

    def ready(self):
        import voluntarios.signals  # noqa: F401
