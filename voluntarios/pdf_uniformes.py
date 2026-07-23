"""
Generación de PDF para comprobantes de uniformes
Sistema completo con colores por tipo, logo, firmas y formato profesional
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color, black, white
from datetime import datetime


# Colores por tipo de uniforme (RGB normalizado 0-1)
COLORES_PDF = {
    'estructural': {'r': 1.0, 'g': 0.596, 'b': 0.0, 'nombre': 'Estructural'},
    'forestal': {'r': 0.298, 'g': 0.686, 'b': 0.314, 'nombre': 'Forestal'},
    'rescate': {'r': 0.957, 'g': 0.263, 'b': 0.212, 'nombre': 'Rescate'},
    'hazmat': {'r': 1.0, 'g': 0.922, 'b': 0.231, 'nombre': 'Hazmat'},
    'tenidaCuartel': {'r': 0.129, 'g': 0.588, 'b': 0.953, 'nombre': 'Tenida de Cuartel'},
    'accesorios': {'r': 0.612, 'g': 0.153, 'b': 0.690, 'nombre': 'Accesorios'},
    'parada': {'r': 0.247, 'g': 0.318, 'b': 0.710, 'nombre': 'Parada'},
    'usar': {'r': 1.0, 'g': 0.341, 'b': 0.133, 'nombre': 'USAR'},
    'agreste': {'r': 0.545, 'g': 0.765, 'b': 0.290, 'nombre': 'AGRESTE'},
    'um6': {'r': 0.0, 'g': 0.588, 'b': 0.780, 'nombre': 'UM-6'},
    'gersa': {'r': 0.0, 'g': 0.737, 'b': 0.831, 'nombre': 'GERSA'}
}

# Mapeo de nombres de componentes
NOMBRES_COMPONENTES = {
    'jardinera': 'Jardinera',
    'chaqueta': 'Chaqueta',
    'guantes': 'Guantes',
    'botas': 'Botas',
    'casco': 'Casco',
    'esclavina': 'Esclavina',
    'casaca': 'Casaca',
    'pantalon': 'Pantalón',
    'polera': 'Polera',
    'poleron': 'Polerón',
    'radio': 'Radio Portátil',
    'cargador': 'Cargador',
    'bateria': 'Batería Adicional',
    'linterna': 'Linterna',
    'cinturon': 'Cinturón',
    'aletas': 'Aletas',
    'mascara': 'Máscara',
    'regulador': 'Regulador',
    'tanque': 'Tanque de Oxígeno',
    'chaleco': 'Chaleco'
}


def obtener_nombre_display(pieza):
    """Obtiene el nombre formateado de una pieza"""
    if pieza.nombre_personalizado:
        return pieza.nombre_personalizado
    componente_lower = pieza.componente.lower().replace(' ', '_')
    return NOMBRES_COMPONENTES.get(componente_lower, pieza.componente.replace('_', ' ').title())


def generar_pdf_uniforme(uniforme):
    """
    Genera un PDF profesional para un comprobante de uniforme
    
    Args:
        uniforme: Instancia del modelo Uniforme con piezas
        
    Returns:
        BytesIO: Buffer con el PDF generado
    """
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Obtener color del tipo
    color_config = COLORES_PDF.get(uniforme.tipo_uniforme, {'r': 0.5, 'g': 0.5, 'b': 0.5})
    color_uniforme = Color(color_config['r'], color_config['g'], color_config['b'])
    color_fondo = Color(
        color_config['r'] * 0.1 + 0.9,
        color_config['g'] * 0.1 + 0.9,
        color_config['b'] * 0.1 + 0.9
    )
    
    # Variables de posición
    y = height - 20*mm
    
    # ==================== LOGO ====================
    # Intentar cargar logo de la base de datos
    try:
        from .models import LogoCompania
        import base64
        from reportlab.lib.utils import ImageReader
        
        logo_activo = LogoCompania.objects.filter(usar_en_pdfs=True).first()
        if logo_activo and logo_activo.imagen:
            # Decodificar base64
            if ',' in logo_activo.imagen:
                logo_data = logo_activo.imagen.split(',')[1]
            else:
                logo_data = logo_activo.imagen
            
            logo_bytes = base64.b64decode(logo_data)
            logo_buffer = BytesIO(logo_bytes)
            logo_img = ImageReader(logo_buffer)
            
            # Dibujar logo (esquina superior izquierda)
            logo_width = 25*mm
            logo_height = 25*mm
            p.drawImage(logo_img, 15*mm, y - logo_height, width=logo_width, height=logo_height, mask='auto')
    except Exception as e:
        print(f"[PDF] No se pudo cargar el logo: {e}")
    
    # ==================== HEADER ====================
    
    # Título centrado (más abajo y más pequeño para no chocar con logo)
    p.setFont('Helvetica-Bold', 14)
    p.setFillColor(color_uniforme)
    p.drawCentredString(width/2, y - 15*mm, 'REGISTRO DE UNIFORMES ASIGNADOS')
    y -= 38*mm
    
    # Líneas decorativas
    p.setStrokeColor(color_uniforme)
    p.setLineWidth(1)
    p.line(15*mm, y, width - 15*mm, y)
    y -= 2*mm
    p.setLineWidth(0.3)
    p.line(15*mm, y, width - 15*mm, y)
    y -= 8*mm
    
    # ==================== DATOS DEL VOLUNTARIO ====================
    
    bombero = uniforme.bombero
    
    # Fondo del recuadro
    p.setFillColor(color_fondo)
    p.roundRect(15*mm, y - 40*mm, 180*mm, 40*mm, 3*mm, fill=1, stroke=0)
    
    # Borde del recuadro
    p.setStrokeColor(color_uniforme)
    p.setLineWidth(0.5)
    p.roundRect(15*mm, y - 40*mm, 180*mm, 40*mm, 3*mm, fill=0, stroke=1)
    
    # Título sección
    p.setFont('Helvetica-Bold', 11)
    p.setFillColor(color_uniforme)
    p.drawString(20*mm, y - 5*mm, '👤 DATOS DEL VOLUNTARIO')
    
    # Datos en dos columnas
    p.setFont('Helvetica', 9)
    p.setFillColor(black)
    y_data = y - 12*mm
    
    # Columna izquierda
    p.setFont('Helvetica-Bold', 9)
    p.drawString(20*mm, y_data, 'Nombre:')
    p.setFont('Helvetica', 9)
    nombre_completo = f"{bombero.nombre} {bombero.apellido_paterno} {bombero.apellido_materno or ''}".strip()
    p.drawString(45*mm, y_data, nombre_completo)
    
    y_data -= 7*mm
    p.setFont('Helvetica-Bold', 9)
    p.drawString(20*mm, y_data, 'Clave:')
    p.setFont('Helvetica', 9)
    p.drawString(45*mm, y_data, bombero.clave_bombero or 'N/A')
    
    y_data -= 7*mm
    p.setFont('Helvetica-Bold', 9)
    p.drawString(20*mm, y_data, 'RUN:')
    p.setFont('Helvetica', 9)
    p.drawString(45*mm, y_data, bombero.rut or 'N/A')
    
    # Columna derecha (alineada con izquierda)
    y_data = y - 12*mm
    p.setFont('Helvetica-Bold', 9)
    p.drawString(105*mm, y_data, 'Compañía:')
    p.setFont('Helvetica', 9)
    # Dividir en dos líneas
    p.drawString(130*mm, y_data, 'Sexta Compañía De Bomberos')
    y_data -= 4*mm
    p.drawString(130*mm, y_data, 'de Puerto Montt')
    
    y_data -= 7*mm  # Más espacio entre Compañía y Antigüedad
    p.setFont('Helvetica-Bold', 9)
    p.drawString(105*mm, y_data, 'Antigüedad:')
    p.setFont('Helvetica', 9)
    # Calcular antigüedad
    antiguedad_obj = bombero.antiguedad_detallada()
    antiguedad_texto = f"{antiguedad_obj['años']} años, {antiguedad_obj['meses']} meses"
    p.drawString(130*mm, y_data, antiguedad_texto)
    
    y -= 50*mm
    
    # ==================== SECCIÓN UNIFORME ====================
    
    p.setFont('Helvetica-Bold', 13)
    p.setFillColor(color_uniforme)
    p.drawString(15*mm, y, '👔 UNIFORME ENTREGADO')
    y -= 10*mm
    
    # Barra de color con tipo
    p.setFillColor(color_uniforme)
    p.roundRect(15*mm, y, 180*mm, 8*mm, 2*mm, fill=1, stroke=0)
    p.setFillColor(white)
    p.setFont('Helvetica-Bold', 10)
    nombre_tipo = color_config['nombre'].upper()
    p.drawString(20*mm, y + 2.5*mm, f"UNIFORME {nombre_tipo}")
    
    y -= 6*mm
    p.setFont('Helvetica', 8)
    p.setFillColor(Color(0.4, 0.4, 0.4))
    p.drawString(20*mm, y, f'ID Uniforme: {uniforme.id}')
    y -= 10*mm
    
    # ==================== LISTA DE PIEZAS ====================
    
    piezas_activas = uniforme.piezas.filter(estado_pieza='activo')
    
    for idx, pieza in enumerate(piezas_activas, 1):
        # Verificar espacio para nueva página (necesitamos ~35mm para una pieza)
        if y < 70*mm:
            p.showPage()
            y = height - 20*mm
            
            # Repetir header mínimo
            p.setFont('Helvetica-Bold', 11)
            p.setFillColor(color_uniforme)
            p.drawString(15*mm, y, f'Uniforme {uniforme.id} (continuación)')
            y -= 10*mm
        
        # Recuadro pieza
        p.setFillColor(Color(0.98, 0.98, 0.98))
        p.roundRect(15*mm, y - 28*mm, 180*mm, 28*mm, 2*mm, fill=1, stroke=0)
        p.setStrokeColor(Color(0.86, 0.86, 0.86))
        p.setLineWidth(0.3)
        p.roundRect(15*mm, y - 28*mm, 180*mm, 28*mm, 2*mm, fill=0, stroke=1)
        
        y -= 5*mm
        
        # Nombre componente
        nombre_componente = obtener_nombre_display(pieza)
        p.setFont('Helvetica-Bold', 9)
        p.setFillColor(color_uniforme)
        unidad_texto = f" ({pieza.unidad} unidades)" if pieza.unidad > 1 else ""
        p.drawString(20*mm, y, f'{idx}. {nombre_componente}{unidad_texto}')
        
        y -= 5*mm
        p.setFont('Helvetica', 9)
        p.setFillColor(black)
        
        # Línea 2: Marca, Serie, Talla
        detalles = []
        if pieza.marca:
            detalles.append(f"Marca: {pieza.marca}")
        if pieza.serie:
            detalles.append(f"Serie: {pieza.serie}")
        if pieza.talla:
            detalles.append(f"Talla: {pieza.talla}")
        
        if detalles:
            p.drawString(20*mm, y, " | ".join(detalles))
        y -= 5*mm
        
        # Línea 3: Condición, Estado, Fecha
        p.setFont('Helvetica', 8)
        p.setFillColor(Color(0.4, 0.4, 0.4))
        condicion_map = {'nuevo': 'Nuevo', 'semi-nuevo': 'Semi-Nuevo', 'usado': 'Usado'}
        estado_map = {'bueno': 'Bueno', 'regular': 'Regular', 'malo': 'Malo'}
        texto_estado = f"Condición: {condicion_map.get(pieza.condicion, pieza.condicion)} | "
        texto_estado += f"Estado: {estado_map.get(pieza.estado_fisico, pieza.estado_fisico)} | "
        texto_estado += f"F. Entrega: {pieza.fecha_entrega.strftime('%d/%m/%Y')}"
        p.drawString(20*mm, y, texto_estado)
        
        y -= 18*mm
    
    # Observaciones generales
    if uniforme.observaciones:
        y -= 5*mm
        p.setFont('Helvetica-Bold', 9)
        p.setFillColor(black)
        p.drawString(15*mm, y, 'Observaciones:')
        y -= 5*mm
        p.setFont('Helvetica', 8)
        p.drawString(15*mm, y, uniforme.observaciones[:100])
        y -= 10*mm
    
    # ==================== DECLARACIÓN ====================
    
    # Verificar espacio para declaración + firmas (~90mm necesarios)
    if y < 90*mm:
        p.showPage()
        y = height - 20*mm
    
    # Recuadro amarillo
    p.setFillColor(Color(1.0, 0.973, 0.882))  # #FFF8E1
    p.roundRect(15*mm, y - 25*mm, 180*mm, 25*mm, 3*mm, fill=1, stroke=0)
    p.setStrokeColor(Color(1.0, 0.757, 0.027))  # #FFC107
    p.setLineWidth(0.5)
    p.roundRect(15*mm, y - 25*mm, 180*mm, 25*mm, 3*mm, fill=0, stroke=1)
    
    p.setFont('Helvetica-Bold', 10)
    p.setFillColor(color_uniforme)
    p.drawString(20*mm, y - 5*mm, '⚠️ DECLARACIÓN:')
    
    p.setFont('Helvetica', 8)
    p.setFillColor(black)
    declaracion = "Declaro haber recibido los uniformes detallados anteriormente en buen estado,"
    p.drawString(20*mm, y - 12*mm, declaracion)
    declaracion2 = "comprometiéndome a su correcto uso y conservación según el reglamento vigente."
    p.drawString(20*mm, y - 18*mm, declaracion2)
    
    y -= 35*mm
    
    # ==================== FIRMAS ====================
    
    p.setFont('Helvetica-Bold', 11)
    p.setFillColor(black)
    p.drawCentredString(width/2, y, 'FIRMAS Y AUTORIZACIONES')
    y -= 15*mm
    
    # Dos columnas
    # Izquierda - Voluntario
    p.setLineWidth(0.5)
    p.line(20*mm, y, 85*mm, y)
    y -= 5*mm
    p.setFont('Helvetica-Bold', 9)
    p.drawString(20*mm, y, 'Firma del Voluntario')
    y -= 5*mm
    p.setFont('Helvetica', 8)
    p.drawString(20*mm, y, nombre_completo)
    y -= 4*mm
    p.drawString(20*mm, y, f'RUN: {bombero.rut or "N/A"}')
    
    # Derecha - Autoridad
    y += 14*mm
    p.setLineWidth(0.5)
    p.line(110*mm, y, 175*mm, y)
    y -= 5*mm
    p.setFont('Helvetica-Bold', 9)
    p.drawString(110*mm, y, 'Firma y Timbre')
    y -= 5*mm
    p.setFont('Helvetica', 8)
    p.drawString(110*mm, y, 'Capitanía / Autoridad Competente')
    y -= 4*mm
    p.drawString(110*mm, y, f'Fecha: {datetime.now().strftime("%d/%m/%Y")}')
    
    # ==================== FOOTER ====================
    
    y = 15*mm
    p.setStrokeColor(color_uniforme)
    p.setLineWidth(0.3)
    p.line(15*mm, y, width - 15*mm, y)
    
    y -= 5*mm
    p.setFont('Helvetica', 7)
    p.setFillColor(Color(0.4, 0.4, 0.4))
    p.drawString(15*mm, y, f'Documento generado el {datetime.now().strftime("%d/%m/%Y %H:%M")}')
    p.drawRightString(width - 15*mm, y, f'Página {p.getPageNumber()}')
    
    y -= 3*mm
    p.setFont('Helvetica', 6)
    p.drawCentredString(width/2, y, 'Sistema de Registro de Uniformes - Proyecto SEIS - Sexta Compañía de Bomberos de Puerto Montt')
    
    # Finalizar
    p.showPage()
    p.save()
    
    buffer.seek(0)
    return buffer


def generar_pdf_devolucion(uniforme, pieza):
    """
    Genera un PDF profesional para un comprobante de devolución de pieza
    
    Args:
        uniforme: Instancia del modelo Uniforme
        pieza: Instancia del modelo PiezaUniforme devuelta
        
    Returns:
        BytesIO: Buffer con el PDF generado
    """
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Obtener color del tipo (color rojo/naranja para devoluciones)
    color_config = {'r': 0.957, 'g': 0.263, 'b': 0.212, 'nombre': 'Devolución'}
    color_devolucion = Color(color_config['r'], color_config['g'], color_config['b'])
    color_fondo = Color(
        color_config['r'] * 0.1 + 0.9,
        color_config['g'] * 0.1 + 0.9,
        color_config['b'] * 0.1 + 0.9
    )
    
    # Variables de posición
    y = height - 20*mm
    
    # ==================== LOGO ====================
    try:
        from .models import LogoCompania
        import base64
        from reportlab.lib.utils import ImageReader
        
        logo_activo = LogoCompania.objects.filter(usar_en_pdfs=True).first()
        if logo_activo and logo_activo.imagen:
            if ',' in logo_activo.imagen:
                logo_data = logo_activo.imagen.split(',')[1]
            else:
                logo_data = logo_activo.imagen
            
            logo_bytes = base64.b64decode(logo_data)
            logo_buffer = BytesIO(logo_bytes)
            logo_img = ImageReader(logo_buffer)
            
            logo_width = 25*mm
            logo_height = 25*mm
            p.drawImage(logo_img, 15*mm, y - logo_height, width=logo_width, height=logo_height, mask='auto')
    except Exception as e:
        print(f"[PDF DEVOLUCION] No se pudo cargar el logo: {e}")
    
    # ==================== HEADER ====================
    
    # Título centrado (más abajo y más pequeño para no chocar con logo)
    p.setFont('Helvetica-Bold', 13)
    p.setFillColor(color_devolucion)
    p.drawCentredString(width/2, y - 15*mm, 'COMPROBANTE DE DEVOLUCIÓN DE UNIFORME')
    y -= 38*mm
    
    # Líneas decorativas
    p.setStrokeColor(color_devolucion)
    p.setLineWidth(1)
    p.line(15*mm, y, width - 15*mm, y)
    y -= 2*mm
    p.setLineWidth(0.3)
    p.line(15*mm, y, width - 15*mm, y)
    y -= 8*mm
    
    # ==================== DATOS DEL VOLUNTARIO ====================
    
    bombero = uniforme.bombero
    
    # Fondo del recuadro
    p.setFillColor(color_fondo)
    p.roundRect(15*mm, y - 40*mm, 180*mm, 40*mm, 3*mm, fill=1, stroke=0)
    
    # Borde del recuadro
    p.setStrokeColor(color_devolucion)
    p.setLineWidth(0.5)
    p.roundRect(15*mm, y - 40*mm, 180*mm, 40*mm, 3*mm, fill=0, stroke=1)
    
    # Título sección
    p.setFont('Helvetica-Bold', 11)
    p.setFillColor(color_devolucion)
    p.drawString(20*mm, y - 5*mm, '👤 DATOS DEL VOLUNTARIO')
    
    # Datos en dos columnas
    p.setFont('Helvetica', 9)
    p.setFillColor(black)
    y_data = y - 12*mm
    
    # Columna izquierda
    p.setFont('Helvetica-Bold', 9)
    p.drawString(20*mm, y_data, 'Nombre:')
    p.setFont('Helvetica', 9)
    nombre_completo = f"{bombero.nombre} {bombero.apellido_paterno} {bombero.apellido_materno or ''}".strip()
    p.drawString(45*mm, y_data, nombre_completo)
    
    y_data -= 7*mm
    p.setFont('Helvetica-Bold', 9)
    p.drawString(20*mm, y_data, 'Clave:')
    p.setFont('Helvetica', 9)
    p.drawString(45*mm, y_data, bombero.clave_bombero or 'N/A')
    
    y_data -= 7*mm
    p.setFont('Helvetica-Bold', 9)
    p.drawString(20*mm, y_data, 'RUN:')
    p.setFont('Helvetica', 9)
    p.drawString(45*mm, y_data, bombero.rut or 'N/A')
    
    # Columna derecha
    y_data = y - 12*mm
    p.setFont('Helvetica-Bold', 9)
    p.drawString(105*mm, y_data, 'Compañía:')
    p.setFont('Helvetica', 9)
    p.drawString(130*mm, y_data, 'Sexta Compañía De Bomberos')
    y_data -= 4*mm
    p.drawString(130*mm, y_data, 'de Puerto Montt')
    
    y_data -= 7*mm
    p.setFont('Helvetica-Bold', 9)
    p.drawString(105*mm, y_data, 'Antigüedad:')
    p.setFont('Helvetica', 9)
    antiguedad_obj = bombero.antiguedad_detallada()
    antiguedad_texto = f"{antiguedad_obj['años']} años, {antiguedad_obj['meses']} meses"
    p.drawString(130*mm, y_data, antiguedad_texto)
    
    y -= 50*mm
    
    # ==================== INFORMACIÓN DEL UNIFORME ====================
    
    tipo_nombre = COLORES_PDF.get(uniforme.tipo_uniforme, {}).get('nombre', 'Uniforme')
    
    p.setFont('Helvetica-Bold', 13)
    p.setFillColor(color_devolucion)
    p.drawString(15*mm, y, '📤 ARTÍCULO DEVUELTO')
    y -= 10*mm
    
    # Barra de color
    p.setFillColor(color_devolucion)
    p.roundRect(15*mm, y, 180*mm, 8*mm, 2*mm, fill=1, stroke=0)
    p.setFillColor(white)
    p.setFont('Helvetica-Bold', 10)
    p.drawString(20*mm, y + 2.5*mm, f"UNIFORME {tipo_nombre.upper()} - ID: {uniforme.id}")
    
    y -= 6*mm
    p.setFont('Helvetica', 8)
    p.setFillColor(Color(0.4, 0.4, 0.4))
    p.drawString(20*mm, y, f'Fecha Devolución: {pieza.fecha_devolucion.strftime("%d/%m/%Y")}')
    y -= 10*mm
    
    # ==================== DETALLE DE LA PIEZA DEVUELTA ====================
    
    # Recuadro pieza
    p.setFillColor(Color(0.98, 0.98, 0.98))
    p.roundRect(15*mm, y - 40*mm, 180*mm, 40*mm, 2*mm, fill=1, stroke=0)
    p.setStrokeColor(Color(0.86, 0.86, 0.86))
    p.setLineWidth(0.3)
    p.roundRect(15*mm, y - 40*mm, 180*mm, 40*mm, 2*mm, fill=0, stroke=1)
    
    y -= 5*mm
    
    # Nombre componente
    nombre_componente = obtener_nombre_display(pieza)
    p.setFont('Helvetica-Bold', 10)
    p.setFillColor(color_devolucion)
    unidad_texto = f" ({pieza.unidad} unidades)" if pieza.unidad > 1 else ""
    p.drawString(20*mm, y, f'{nombre_componente}{unidad_texto}')
    
    y -= 7*mm
    p.setFont('Helvetica', 9)
    p.setFillColor(black)
    
    # Información original de entrega
    p.setFont('Helvetica-Bold', 9)
    p.drawString(20*mm, y, 'Información Original de Entrega:')
    y -= 5*mm
    p.setFont('Helvetica', 8)
    
    detalles_entrega = []
    if pieza.marca:
        detalles_entrega.append(f"Marca: {pieza.marca}")
    if pieza.serie:
        detalles_entrega.append(f"Serie: {pieza.serie}")
    if pieza.talla:
        detalles_entrega.append(f"Talla: {pieza.talla}")
    
    if detalles_entrega:
        p.drawString(20*mm, y, " | ".join(detalles_entrega))
    y -= 4*mm
    
    condicion_map = {'nuevo': 'Nuevo', 'semi-nuevo': 'Semi-Nuevo', 'usado': 'Usado'}
    estado_map = {'bueno': 'Bueno', 'regular': 'Regular', 'malo': 'Malo'}
    texto_estado = f"Condición Original: {condicion_map.get(pieza.condicion, pieza.condicion)} | "
    texto_estado += f"Estado Original: {estado_map.get(pieza.estado_fisico, pieza.estado_fisico)} | "
    texto_estado += f"F. Entrega: {pieza.fecha_entrega.strftime('%d/%m/%Y')}"
    p.drawString(20*mm, y, texto_estado)
    
    y -= 7*mm
    
    # Información de devolución
    p.setFont('Helvetica-Bold', 9)
    p.setFillColor(color_devolucion)
    p.drawString(20*mm, y, 'Información de Devolución:')
    y -= 5*mm
    p.setFont('Helvetica', 8)
    p.setFillColor(black)
    
    estado_dev_map = {'bueno': 'Bueno', 'regular': 'Regular', 'malo': 'Malo', 'deteriorado': 'Deteriorado'}
    condicion_dev_map = {'nuevo': 'Como Nuevo', 'semi-nuevo': 'Semi-Nuevo', 'usado': 'Usado', 'muy_usado': 'Muy Usado'}
    
    texto_devolucion = f"Estado en Devolución: {estado_dev_map.get(pieza.estado_devolucion, pieza.estado_devolucion)} | "
    texto_devolucion += f"Condición en Devolución: {condicion_dev_map.get(pieza.condicion_devolucion, pieza.condicion_devolucion)}"
    p.drawString(20*mm, y, texto_devolucion)
    
    y -= 4*mm
    p.drawString(20*mm, y, f"Devuelto por: {pieza.devuelto_por or 'N/A'}")
    
    y -= 12*mm
    
    # Observaciones de devolución
    if pieza.observaciones_devolucion:
        y -= 5*mm
        p.setFont('Helvetica-Bold', 9)
        p.setFillColor(black)
        p.drawString(15*mm, y, 'Observaciones de Devolución:')
        y -= 5*mm
        p.setFont('Helvetica', 8)
        # Dividir texto largo en múltiples líneas
        obs_texto = pieza.observaciones_devolucion[:200]
        p.drawString(15*mm, y, obs_texto)
        y -= 10*mm
    
    # ==================== DECLARACIÓN ====================
    
    # Verificar espacio para declaración + firmas (~90mm necesarios)
    if y < 90*mm:
        p.showPage()
        y = height - 20*mm
    
    # Recuadro amarillo
    p.setFillColor(Color(1.0, 0.973, 0.882))
    p.roundRect(15*mm, y - 25*mm, 180*mm, 25*mm, 3*mm, fill=1, stroke=0)
    p.setStrokeColor(Color(1.0, 0.757, 0.027))
    p.setLineWidth(0.5)
    p.roundRect(15*mm, y - 25*mm, 180*mm, 25*mm, 3*mm, fill=0, stroke=1)
    
    p.setFont('Helvetica-Bold', 10)
    p.setFillColor(color_devolucion)
    p.drawString(20*mm, y - 5*mm, '⚠️ DECLARACIÓN DE DEVOLUCIÓN:')
    
    p.setFont('Helvetica', 8)
    p.setFillColor(black)
    declaracion = "Declaro que el artículo descrito ha sido devuelto en la fecha y condición señaladas,"
    p.drawString(20*mm, y - 12*mm, declaracion)
    declaracion2 = "cumpliendo con los procedimientos establecidos por la institución."
    p.drawString(20*mm, y - 18*mm, declaracion2)
    
    y -= 35*mm
    
    # ==================== FIRMAS ====================
    
    p.setFont('Helvetica-Bold', 11)
    p.setFillColor(black)
    p.drawCentredString(width/2, y, 'FIRMAS Y AUTORIZACIONES')
    y -= 15*mm
    
    # Dos columnas
    # Izquierda - Voluntario
    p.setLineWidth(0.5)
    p.line(20*mm, y, 85*mm, y)
    y -= 5*mm
    p.setFont('Helvetica-Bold', 9)
    p.drawString(20*mm, y, 'Firma del Voluntario (Devuelve)')
    y -= 5*mm
    p.setFont('Helvetica', 8)
    p.drawString(20*mm, y, nombre_completo)
    y -= 4*mm
    p.drawString(20*mm, y, f'RUN: {bombero.rut or "N/A"}')
    
    # Derecha - Autoridad
    y += 14*mm
    p.setLineWidth(0.5)
    p.line(110*mm, y, 175*mm, y)
    y -= 5*mm
    p.setFont('Helvetica-Bold', 9)
    p.drawString(110*mm, y, 'Firma y Timbre (Recibe)')
    y -= 5*mm
    p.setFont('Helvetica', 8)
    p.drawString(110*mm, y, 'Capitanía / Autoridad Competente')
    y -= 4*mm
    p.drawString(110*mm, y, f'Fecha: {datetime.now().strftime("%d/%m/%Y")}')
    
    # ==================== FOOTER ====================
    
    y = 15*mm
    p.setStrokeColor(color_devolucion)
    p.setLineWidth(0.3)
    p.line(15*mm, y, width - 15*mm, y)
    
    y -= 5*mm
    p.setFont('Helvetica', 7)
    p.setFillColor(Color(0.4, 0.4, 0.4))
    p.drawString(15*mm, y, f'Documento generado el {datetime.now().strftime("%d/%m/%Y %H:%M")}')
    # Número de página dinámico
    p.drawRightString(width - 15*mm, y, f'Página {p.getPageNumber()}')
    
    y -= 3*mm
    p.setFont('Helvetica', 6)
    p.drawCentredString(width/2, y, 'Sistema de Registro de Uniformes - Proyecto SEIS - Sexta Compañía de Bomberos de Puerto Montt')
    
    # Finalizar PDF
    p.showPage()
    p.save()
    
    buffer.seek(0)
    return buffer


def generar_pdf_tabla_uniformes(voluntario, uniformes):
    """
    Genera un PDF con tabla completa de todos los uniformes del voluntario
    
    Args:
        voluntario: Instancia del modelo Voluntario
        uniformes: QuerySet de Uniformes activos
        
    Returns:
        BytesIO: Buffer con el PDF generado
    """
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=landscape(A4))
    width, height = landscape(A4)
    
    # Color naranja para el tema
    color_tema = Color(0.957, 0.592, 0.0)  # Naranja #F49700
    
    # Variables de posición
    y = height - 20*mm
    
    # ==================== HEADER ====================
    
    # Título principal
    p.setFont('Helvetica-Bold', 16)
    p.setFillColor(color_tema)
    nombre_completo = f"{voluntario.nombre} {voluntario.apellido_paterno} {voluntario.apellido_materno or ''}".strip()
    p.drawString(15*mm, y, f'👔 Uniformes de {nombre_completo}')
    
    y -= 10*mm
    
    # Info del voluntario
    p.setFont('Helvetica', 10)
    p.setFillColor(black)
    p.drawString(15*mm, y, f'Clave: {voluntario.clave_bombero or "N/A"}')
    p.drawString(60*mm, y, f'RUN: {voluntario.rut or "N/A"}')
    p.drawString(120*mm, y, f'Total de uniformes: {uniformes.count()}')
    
    y -= 8*mm
    
    # Línea separadora
    p.setStrokeColor(color_tema)
    p.setLineWidth(1)
    p.line(15*mm, y, width - 15*mm, y)
    y -= 10*mm
    
    # ==================== PROCESAR CADA UNIFORME ====================
    
    for uniforme in uniformes:
        piezas_activas = uniforme.piezas.filter(estado_pieza='activo')
        
        if not piezas_activas:
            continue
        
        # Verificar espacio para header del uniforme + al menos 2 filas
        if y < 80*mm:
            p.showPage()
            y = height - 20*mm
        
        # Header del uniforme
        tipo_nombre = COLORES_PDF.get(uniforme.tipo_uniforme, {}).get('nombre', 'Uniforme')
        
        p.setFillColor(color_tema)
        p.roundRect(15*mm, y - 8*mm, width - 30*mm, 8*mm, 2*mm, fill=1, stroke=0)
        p.setFillColor(white)
        p.setFont('Helvetica-Bold', 11)
        p.drawString(20*mm, y - 5.5*mm, f'🔥 {tipo_nombre.upper()} - {uniforme.id}')
        
        y -= 12*mm
        
        # Tabla de piezas
        # Columnas: Artículo | Unidad | Par/Simple | Marca/Modelo | N° Serie | Talla | Condición | Estado | F.Entrega | Observaciones
        
        # Header de tabla
        p.setFillColor(Color(0.2, 0.2, 0.2))
        p.rect(15*mm, y - 8*mm, width - 30*mm, 8*mm, fill=1, stroke=0)
        
        p.setFillColor(white)
        p.setFont('Helvetica-Bold', 8)
        col_x = 17*mm
        p.drawString(col_x, y - 5*mm, 'Artículo')
        col_x += 35*mm
        p.drawString(col_x, y - 5*mm, 'Unidad')
        col_x += 15*mm
        p.drawString(col_x, y - 5*mm, 'Par/Simple')
        col_x += 20*mm
        p.drawString(col_x, y - 5*mm, 'Marca/Modelo')
        col_x += 30*mm
        p.drawString(col_x, y - 5*mm, 'N° Serie')
        col_x += 25*mm
        p.drawString(col_x, y - 5*mm, 'Talla')
        col_x += 15*mm
        p.drawString(col_x, y - 5*mm, 'Condición')
        col_x += 20*mm
        p.drawString(col_x, y - 5*mm, 'Estado')
        col_x += 18*mm
        p.drawString(col_x, y - 5*mm, 'F.Entrega')
        col_x += 25*mm
        p.drawString(col_x, y - 5*mm, 'Observaciones')
        
        y -= 10*mm
        
        # Filas de datos
        for idx, pieza in enumerate(piezas_activas):
            # Verificar espacio
            if y < 30*mm:
                p.showPage()
                y = height - 20*mm
            
            # Fondo alternado
            if idx % 2 == 0:
                p.setFillColor(Color(0.95, 0.95, 0.95))
                p.rect(15*mm, y - 7*mm, width - 30*mm, 7*mm, fill=1, stroke=0)
            
            p.setFillColor(black)
            p.setFont('Helvetica', 7)
            
            col_x = 17*mm
            # Artículo
            nombre = pieza.nombre_personalizado or obtener_nombre_display(pieza)
            p.drawString(col_x, y - 4*mm, nombre[:25])
            
            # Unidad
            col_x += 35*mm
            p.drawString(col_x, y - 4*mm, str(pieza.unidad))
            
            # Par/Simple
            col_x += 15*mm
            par_simple = "Par" if pieza.unidad == 2 else "Simple"
            p.drawString(col_x, y - 4*mm, par_simple)
            
            # Marca/Modelo
            col_x += 20*mm
            p.drawString(col_x, y - 4*mm, pieza.marca[:20] if pieza.marca else '-')
            
            # N° Serie
            col_x += 30*mm
            p.drawString(col_x, y - 4*mm, pieza.serie[:15] if pieza.serie else '-')
            
            # Talla
            col_x += 25*mm
            p.drawString(col_x, y - 4*mm, pieza.talla if pieza.talla else '-')
            
            # Condición
            col_x += 15*mm
            condicion_map = {'nuevo': 'Nuevo', 'semi-nuevo': 'Semi-Nuevo', 'usado': 'Usado'}
            condicion = condicion_map.get(pieza.condicion, pieza.condicion)
            p.drawString(col_x, y - 4*mm, condicion[:10])
            
            # Estado
            col_x += 20*mm
            estado_map = {'bueno': 'Bueno', 'regular': 'Regular', 'malo': 'Malo'}
            estado = estado_map.get(pieza.estado_fisico, pieza.estado_fisico)
            p.drawString(col_x, y - 4*mm, estado)
            
            # F.Entrega
            col_x += 18*mm
            fecha = pieza.fecha_entrega.strftime('%d/%m/%Y') if pieza.fecha_entrega else '-'
            p.drawString(col_x, y - 4*mm, fecha)
            
            # Observaciones (si hay)
            col_x += 25*mm
            obs = uniforme.observaciones[:20] if uniforme.observaciones else '-'
            p.drawString(col_x, y - 4*mm, obs)
            
            y -= 7*mm
        
        y -= 5*mm  # Espacio entre uniformes
    
    # ==================== FOOTER ====================
    
    y = 15*mm
    p.setStrokeColor(color_tema)
    p.setLineWidth(0.3)
    p.line(15*mm, y, width - 15*mm, y)
    
    y -= 5*mm
    p.setFont('Helvetica', 7)
    p.setFillColor(Color(0.4, 0.4, 0.4))
    p.drawString(15*mm, y, f'Documento generado el {datetime.now().strftime("%d/%m/%Y %H:%M")}')
    p.drawRightString(width - 15*mm, y, f'Página {p.getPageNumber()}')
    
    y -= 3*mm
    p.setFont('Helvetica', 6)
    p.drawCentredString(width/2, y, 'Sistema de Registro de Uniformes - Proyecto SEIS - Sexta Compañía de Bomberos de Puerto Montt')
    
    # Finalizar
    p.showPage()
    p.save()
    
    buffer.seek(0)
    return buffer
