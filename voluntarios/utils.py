"""
Utilidades y funciones helper para el sistema de bomberos
Replica las funciones del sistema JavaScript p6p
"""
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from django.db import models
import re


class VoluntarioUtils:
    """Utilidades para gestión de voluntarios"""
    
    # ==================== VALIDACIONES ====================
    
    @staticmethod
    def validar_rut(rut):
        """
        Valida un RUT chileno
        Acepta formatos: 12345678-9, 12.345.678-9, 123456789
        """
        if not rut:
            return False
        
        # Limpiar el RUT
        rut = str(rut).replace('.', '').replace('-', '').upper()
        
        if len(rut) < 8 or len(rut) > 9:
            return False
        
        cuerpo = rut[:-1]
        dv = rut[-1]
        
        # Verificar que el cuerpo sea numérico
        if not cuerpo.isdigit():
            return False
        
        # Calcular dígito verificador
        suma = 0
        multiplo = 2
        
        for i in range(len(cuerpo) - 1, -1, -1):
            suma += int(cuerpo[i]) * multiplo
            multiplo = 7 if multiplo == 2 else multiplo + 1
        
        resto = suma % 11
        dv_calculado = 11 - resto
        
        if dv_calculado == 11:
            dv_calculado = '0'
        elif dv_calculado == 10:
            dv_calculado = 'K'
        else:
            dv_calculado = str(dv_calculado)
        
        return dv == dv_calculado
    
    @staticmethod
    def formatear_rut(rut):
        """
        Formatea un RUT en formato 12.345.678-9
        """
        if not rut:
            return ''
        
        # Limpiar
        rut = str(rut).replace('.', '').replace('-', '').upper()
        
        if len(rut) < 2:
            return rut
        
        dv = rut[-1]
        cuerpo = rut[:-1]
        
        # Formatear con puntos
        cuerpo_formateado = ''
        for i, digito in enumerate(reversed(cuerpo)):
            if i > 0 and i % 3 == 0:
                cuerpo_formateado = '.' + cuerpo_formateado
            cuerpo_formateado = digito + cuerpo_formateado
        
        return f"{cuerpo_formateado}-{dv}"
    
    @staticmethod
    def validar_telefono(telefono):
        """
        Valida un número de teléfono chileno
        """
        if not telefono:
            return False
        
        # Limpiar espacios
        telefono = str(telefono).replace(' ', '').replace('-', '')
        
        # Patrón para números chilenos
        patron = r'^(\+56|56)?[2-9]\d{7,8}$'
        return bool(re.match(patron, telefono))
    
    @staticmethod
    def validar_email(email):
        """
        Valida un email
        """
        if not email:
            return True  # Email es opcional
        
        patron = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        return bool(re.match(patron, email))
    
    # ==================== FECHAS Y ANTIGÜEDAD ====================
    
    @staticmethod
    def calcular_edad(fecha_nacimiento):
        """
        Calcula la edad en años
        """
        if not fecha_nacimiento:
            return 0
        
        if isinstance(fecha_nacimiento, str):
            fecha_nacimiento = datetime.strptime(fecha_nacimiento, '%Y-%m-%d').date()
        
        hoy = date.today()
        edad = hoy.year - fecha_nacimiento.year
        
        if (hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day):
            edad -= 1
        
        return edad
    
    @staticmethod
    def calcular_antiguedad_detallada(fecha_ingreso, fecha_hasta=None):
        """
        Calcula la antigüedad en años, meses y días
        Retorna: {'años': int, 'meses': int, 'dias': int}
        """
        if not fecha_ingreso:
            return {'años': 0, 'meses': 0, 'dias': 0}
        
        if isinstance(fecha_ingreso, str):
            fecha_ingreso = datetime.strptime(fecha_ingreso, '%Y-%m-%d').date()
        
        if fecha_hasta is None:
            fecha_hasta = date.today()
        elif isinstance(fecha_hasta, str):
            fecha_hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d').date()
        
        delta = relativedelta(fecha_hasta, fecha_ingreso)
        
        return {
            'años': delta.years,
            'meses': delta.months,
            'dias': delta.days
        }
    
    @staticmethod
    def calcular_categoria_bombero(fecha_ingreso):
        """
        Calcula la categoría de un bombero según su antigüedad
        
        - Menos de 20 años: Voluntario
        - 20-24 años: Voluntario Honorario de Compañía
        - 25-49 años: Voluntario Honorario del Cuerpo (Insigne 25 años)
        - 50+ años: Voluntario Insigne de Chile
        """
        antiguedad = VoluntarioUtils.calcular_antiguedad_detallada(fecha_ingreso)
        años = antiguedad['años']
        
        if años < 20:
            return {
                'categoria': 'Voluntario',
                'color': '#1976d2',
                'icono': '🔰'
            }
        elif 20 <= años <= 24:
            return {
                'categoria': 'Voluntario Honorario de Compañía',
                'color': '#388e3c',
                'icono': '🏅'
            }
        elif 25 <= años <= 49:
            return {
                'categoria': 'Voluntario Honorario del Cuerpo',
                'color': '#f57c00',
                'icono': '🎖️'
            }
        else:
            return {
                'categoria': 'Voluntario Insigne de Chile',
                'color': '#d32f2f',
                'icono': '🏆'
            }
    
    # ==================== PERMISOS Y VALIDACIONES DE ESTADO ====================
    
    @staticmethod
    def puede_pagar_cuotas(voluntario):
        """
        Verifica si un voluntario puede pagar cuotas
        
        NO pueden pagar cuotas:
        - Voluntarios Honorarios (20+ años)
        - Insignes de 25 años (25+ años)
        - Renunciados
        - Separados
        - Expulsados
        - Mártires
        - Fallecidos
        """
        # Verificar estado
        estados_bloqueados = ['renunciado', 'separado', 'expulsado', 'martir', 'fallecido']
        if voluntario.estado_bombero in estados_bloqueados:
            return {
                'puede': False,
                'mensaje': f'Voluntarios con estado "{voluntario.get_estado_bombero_display()}" no pagan cuotas'
            }
        
        # Verificar antigüedad (Honorarios e Insignes no pagan)
        categoria = VoluntarioUtils.calcular_categoria_bombero(voluntario.fecha_ingreso)
        if categoria['categoria'] != 'Voluntario':
            return {
                'puede': False,
                'mensaje': f'{categoria["categoria"]} no paga cuotas mensuales'
            }
        
        return {
            'puede': True,
            'mensaje': 'Puede pagar cuotas'
        }
    
    @staticmethod
    def puede_recibir_uniformes(voluntario):
        """
        Verifica si un voluntario puede recibir uniformes
        Solo ACTIVOS pueden recibir uniformes
        """
        if voluntario.estado_bombero != 'activo':
            return {
                'puede': False,
                'mensaje': f'Solo voluntarios activos pueden recibir uniformes. Estado actual: {voluntario.get_estado_bombero_display()}'
            }
        
        return {
            'puede': True,
            'mensaje': 'Puede recibir uniformes'
        }
    
    @staticmethod
    def puede_ser_sancionado(voluntario):
        """
        Verifica si un voluntario puede ser sancionado
        
        Pueden ser sancionados: ACTIVO, RENUNCIADO, SEPARADO
        NO pueden: EXPULSADO, MÁRTIR, FALLECIDO
        """
        estados_bloqueados = ['expulsado', 'martir', 'fallecido']
        if voluntario.estado_bombero in estados_bloqueados:
            return {
                'puede': False,
                'mensaje': f'Voluntarios con estado "{voluntario.get_estado_bombero_display()}" no pueden recibir nuevas sanciones'
            }
        
        return {
            'puede': True,
            'mensaje': 'Puede ser sancionado'
        }
    
    @staticmethod
    def puede_registrar_asistencia(voluntario):
        """
        Verifica si un voluntario puede registrar asistencia
        
        Pueden registrar: ACTIVO, MÁRTIR (histórico)
        NO pueden: RENUNCIADO, SEPARADO, EXPULSADO, FALLECIDO
        """
        if voluntario.estado_bombero in ['activo', 'martir']:
            return {
                'puede': True,
                'mensaje': 'Puede registrar asistencia'
            }
        
        return {
            'puede': False,
            'mensaje': f'Voluntarios con estado "{voluntario.get_estado_bombero_display()}" no pueden registrar asistencia'
        }
    
    @staticmethod
    def puede_recibir_cargos_o_felicitaciones(voluntario):
        """
        Verifica si un voluntario puede recibir cargos o felicitaciones
        Solo ACTIVOS pueden recibir cargos/felicitaciones
        """
        if voluntario.estado_bombero != 'activo':
            return {
                'puede': False,
                'mensaje': f'Solo voluntarios activos pueden recibir cargos/felicitaciones. Estado actual: {voluntario.get_estado_bombero_display()}'
            }
        
        return {
            'puede': True,
            'mensaje': 'Puede recibir cargos/felicitaciones'
        }
    
    @staticmethod
    def participa_en_ranking(voluntario):
        """
        Verifica si un voluntario participa en ranking de asistencias
        Solo ACTIVOS participan en ranking
        """
        return voluntario.estado_bombero == 'activo'
    
    @staticmethod
    def suma_antiguedad(voluntario):
        """
        Verifica si un voluntario suma antigüedad
        Solo ACTIVOS suman antigüedad
        """
        return voluntario.estado_bombero == 'activo'
    
    @staticmethod
    def puede_reintegrarse(voluntario):
        """
        Verifica si un voluntario puede reintegrarse
        
        Pueden reintegrarse:
        - RENUNCIADO: Siempre
        - SEPARADO: Después de cumplir el periodo
        
        NO pueden: ACTIVO, EXPULSADO, MÁRTIR, FALLECIDO
        """
        if voluntario.estado_bombero not in ['renunciado', 'separado']:
            return {
                'puede': False,
                'mensaje': 'Solo voluntarios renunciados o separados pueden reintegrarse'
            }
        
        # Renunciados: sin periodo mínimo
        if voluntario.estado_bombero == 'renunciado':
            return {
                'puede': True,
                'mensaje': 'Puede reintegrarse inmediatamente'
            }
        
        # Separados: debe cumplir periodo
        if voluntario.estado_bombero == 'separado' and voluntario.anios_separacion and voluntario.fecha_separacion:
            fecha_disponible = voluntario.fecha_separacion + relativedelta(years=voluntario.anios_separacion)
            if date.today() >= fecha_disponible:
                return {
                    'puede': True,
                    'mensaje': 'Periodo de separación cumplido. Puede reintegrarse.'
                }
            else:
                return {
                    'puede': False,
                    'mensaje': f'Debe esperar hasta {fecha_disponible.strftime("%d/%m/%Y")} para poder reintegrarse'
                }
        
        return {
            'puede': False,
            'mensaje': 'No se puede determinar elegibilidad para reintegración'
        }
    
    # ==================== BADGES Y UI ====================
    
    @staticmethod
    def obtener_badge_estado(estado):
        """
        Retorna un diccionario con información para mostrar badge del estado
        """
        badges = {
            'activo': {
                'texto': 'Activo',
                'color': '#4caf50',
                'icono': '✅'
            },
            'inactivo': {
                'texto': 'Inactivo',
                'color': '#9e9e9e',
                'icono': '⏸️'
            },
            'renunciado': {
                'texto': 'Renunciado',
                'color': '#f59e0b',
                'icono': '🔄'
            },
            'separado': {
                'texto': 'Separado',
                'color': '#ef4444',
                'icono': '⏸️'
            },
            'expulsado': {
                'texto': 'Expulsado',
                'color': '#dc2626',
                'icono': '❌'
            },
            'martir': {
                'texto': 'Mártir',
                'color': '#9c27b0',
                'icono': '🕊️'
            },
            'fallecido': {
                'texto': 'Fallecido',
                'color': '#6b7280',
                'icono': '☠️'
            }
        }
        
        return badges.get(estado, {
            'texto': estado.title(),
            'color': '#000000',
            'icono': '❓'
        })
    
    # ==================== HELPERS ====================
    
    @staticmethod
    def formatear_fecha(fecha):
        """
        Formatea una fecha en formato chileno (DD/MM/YYYY)
        """
        if not fecha:
            return ''
        
        if isinstance(fecha, str):
            fecha = datetime.strptime(fecha, '%Y-%m-%d').date()
        
        return fecha.strftime('%d/%m/%Y')
    
    @staticmethod
    def generar_clave_bombero(numero):
        """
        Genera una clave de bombero formateada (ej: B-001, B-012, B-123)
        """
        return f"B-{str(numero).zfill(3)}"
    
    @staticmethod
    def validar_imagen(archivo):
        """
        Valida que un archivo sea una imagen válida
        """
        tipos_permitidos = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        max_size = 5 * 1024 * 1024  # 5MB
        
        if not archivo:
            return True, ''
        
        # Validar tipo
        if hasattr(archivo, 'content_type'):
            if archivo.content_type not in tipos_permitidos:
                return False, 'Solo se permiten imágenes JPEG, PNG, GIF o WebP'
        
        # Validar tamaño
        if hasattr(archivo, 'size'):
            if archivo.size > max_size:
                return False, 'La imagen no debe superar los 5MB'
        
        return True, ''
    
    # ==================== CARGOS ====================
    
    @staticmethod
    def obtener_cargo_vigente(voluntario):
        """
        Obtiene el cargo vigente de un voluntario
        
        Un cargo es vigente si:
        - No tiene fecha_fin (cargo indefinido)
        - O su fecha_fin es mayor o igual a hoy
        
        Retorna el cargo más reciente vigente o None
        
        Args:
            voluntario: Instancia de Voluntario
            
        Returns:
            Cargo vigente o None
        """
        from .models import Cargo  # Import local para evitar circular imports
        
        hoy = date.today()
        
        # Obtener cargos del voluntario ordenados por más reciente
        cargos = Cargo.objects.filter(voluntario=voluntario).order_by('-fecha_inicio', '-anio')
        
        for cargo in cargos:
            # Cargo sin fecha fin = vigente indefinidamente
            if not cargo.fecha_fin:
                return cargo
            
            # Cargo con fecha fin >= hoy = aún vigente
            if cargo.fecha_fin >= hoy:
                return cargo
        
        return None
    
    @staticmethod
    def cargo_esta_vigente(cargo):
        """
        Verifica si un cargo específico está vigente
        
        Args:
            cargo: Instancia de Cargo
            
        Returns:
            bool: True si el cargo está vigente, False si expiró
        """
        if not cargo:
            return False
        
        hoy = date.today()
        
        # Sin fecha fin = siempre vigente
        if not cargo.fecha_fin:
            return True
        
        # Con fecha fin, verificar si aún no ha pasado
        return cargo.fecha_fin >= hoy
    
    @staticmethod
    def obtener_cargos_vigentes_por_tipo(tipo_cargo):
        """
        Obtiene todos los voluntarios con cargo vigente de un tipo específico
        
        Útil para formularios de asistencia donde solo deben aparecer
        oficiales/cargos que actualmente estén en ejercicio
        
        Args:
            tipo_cargo: str - 'comandancia', 'compania', 'consejo', 'tecnico'
            
        Returns:
            QuerySet de Voluntario con cargo vigente del tipo especificado
        """
        from .models import Cargo, Voluntario
        
        hoy = date.today()
        
        # Obtener IDs de voluntarios con cargo vigente del tipo especificado
        voluntarios_con_cargo = Cargo.objects.filter(
            tipo_cargo=tipo_cargo
        ).filter(
            # Sin fecha fin O fecha fin >= hoy
            models.Q(fecha_fin__isnull=True) | models.Q(fecha_fin__gte=hoy)
        ).values_list('voluntario_id', flat=True).distinct()
        
        return Voluntario.objects.filter(
            id__in=voluntarios_con_cargo,
            estado_bombero='activo'  # Solo activos
        )


# ==================== UNIFORMES ====================

def generar_id_uniforme(tipo_uniforme):
    """
    Genera un ID único para un uniforme según su tipo
    Formato: TIPO-NNN (ej: ESTR-001, FOR-002, HAZ-010)
    
    Args:
        tipo_uniforme: str - Tipo del uniforme
        
    Returns:
        str: ID único del uniforme
    """
    from .models import ContadorUniformes
    
    prefijos = {
        'estructural': 'ESTR',
        'forestal': 'FOR',
        'rescate': 'RESC',
        'hazmat': 'HAZ',
        'tenidaCuartel': 'TCU',
        'accesorios': 'ACC',
        'parada': 'PAR',
        'usar': 'USAR',
        'agreste': 'AGR',
        'um6': 'UM6',
        'gersa': 'GERSA'
    }
    
    contador = ContadorUniformes.obtener_siguiente_id(tipo_uniforme)
    prefijo = prefijos.get(tipo_uniforme, 'UNI')
    return f"{prefijo}-{str(contador).zfill(3)}"


def detectar_par_simple(componente):
    """
    Detecta si un componente es par (2 unidades) o simple (1 unidad)
    
    Args:
        componente: str - Nombre del componente
        
    Returns:
        dict: {'unidad': int, 'par_simple': str}
    """
    componentes_par = ['guantes', 'botas', 'aletas']
    
    if componente.lower() in componentes_par:
        return {'unidad': 2, 'par_simple': 'Par'}
    return {'unidad': 1, 'par_simple': 'Simple'}


def puede_recibir_uniformes(voluntario):
    """
    Valida si un voluntario puede recibir uniformes según su estado
    
    Args:
        voluntario: Instancia de Voluntario
        
    Returns:
        dict: {'puede': bool, 'mensaje': str}
    """
    estados_bloqueados = ['renunciado', 'separado', 'expulsado', 'fallecido']
    
    if voluntario.estado_bombero in estados_bloqueados:
        return {
            'puede': False,
            'mensaje': f'No se pueden asignar uniformes a voluntarios con estado "{voluntario.estado_bombero}"'
        }
    
    return {'puede': True, 'mensaje': ''}
