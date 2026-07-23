"""
Generación de PDF para estado de cuotas mensuales
Sistema con grid de 12 meses, colores por estado y formato profesional
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color, black, white
from datetime import datetime
from decimal import Decimal


def generar_pdf_cuotas(voluntario, anio, pagos_dict, deuda_total, logo_base64=None):
    """
    Genera PDF con estado de cuotas del voluntario para un año específico
    
    Args:
        voluntario: Instancia del modelo Voluntario
        anio: Año de las cuotas (int)
        pagos_dict: Diccionario {mes: pago} con los pagos realizados
        deuda_total: Decimal con la deuda total pendiente
        logo_base64: String base64 del logo (opcional)
    
    Returns:
        BytesIO con el PDF generado
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Margen
    margin_x = 20 * mm
    margin_y = 20 * mm
    
    y_position = height - margin_y
    
    # ==================== HEADER ====================
    
    # Logo (si existe)
    if logo_base64:
        try:
            from reportlab.lib.utils import ImageReader
            import base64
            logo_data = base64.b64decode(logo_base64.split(',')[1] if ',' in logo_base64 else logo_base64)
            logo_img = ImageReader(BytesIO(logo_data))
            # Fondo blanco detrás del logo
            c.setFillColor(white)
            c.rect(margin_x - 1*mm, y_position - 31*mm, 27*mm, 32*mm, fill=True, stroke=False)
            c.drawImage(logo_img, margin_x, y_position - 30*mm, width=25*mm, height=25*mm, preserveAspectRatio=True)
        except Exception:
            pass

    # Título con estilo
    c.setFillColorRGB(0.1, 0.1, 0.1)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(margin_x + 30*mm, y_position - 10*mm, "ESTADO DE CUOTAS SOCIALES")
    
    # Línea decorativa bajo el título
    c.setStrokeColorRGB(0.77, 0.12, 0.23)
    c.setLineWidth(2)
    c.line(margin_x + 30*mm, y_position - 13*mm, margin_x + 120*mm, y_position - 13*mm)
    
    c.setFillColorRGB(0.77, 0.12, 0.23)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(margin_x + 30*mm, y_position - 20*mm, f"📅 Año {anio}")
    
    y_position -= 40 * mm
    
    # ==================== INFORMACIÓN DEL VOLUNTARIO ====================
    
    # Rectángulo con degradado visual (usando bordes redondeados simulados)
    c.setFillColorRGB(0.77, 0.12, 0.23)  # Rojo bomberil
    c.roundRect(margin_x, y_position - 32*mm, width - 2*margin_x, 32*mm, 3*mm, fill=True, stroke=False)
    
    # Sombra suave
    c.setStrokeColorRGB(0.5, 0.5, 0.5)
    c.setLineWidth(0.5)
    
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 12)
    
    y_info = y_position - 10*mm
    c.drawString(margin_x + 5*mm, y_info, "👤 DATOS DEL VOLUNTARIO")
    
    c.setFont("Helvetica", 10)
    y_info -= 6*mm
    
    nombre_completo = f"{voluntario.nombre} {voluntario.apellido_paterno} {voluntario.apellido_materno}"
    c.drawString(margin_x + 5*mm, y_info, f"Nombre: {nombre_completo}")
    y_info -= 5*mm
    
    c.drawString(margin_x + 5*mm, y_info, f"RUT: {voluntario.rut}")
    c.drawString(margin_x + 60*mm, y_info, f"Clave: {voluntario.clave_bombero}")
    y_info -= 5*mm
    
    # Compañía en nueva línea
    c.drawString(margin_x + 5*mm, y_info, f"Compañía: {voluntario.compania}")
    y_info -= 5*mm
    
    # Precio de cuota
    from .utils_tesoreria import obtener_precio_cuota
    
    precio_cuota = obtener_precio_cuota(voluntario)
    
    c.drawString(margin_x + 5*mm, y_info, f"Valor Cuota: ${int(precio_cuota):,}")
    
    y_position -= 40 * mm
    
    # ==================== GRID DE 12 MESES ====================
    
    c.setFillColor(black)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin_x, y_position, "ESTADO DE PAGOS MENSUALES")
    
    y_position -= 10 * mm
    
    # Leyenda - Solo 2 estados
    c.setFont("Helvetica", 9)
    legend_y = y_position
    
    # Verde - Pagado
    c.setFillColorRGB(0.2, 0.6, 0.2)
    c.rect(margin_x, legend_y - 3*mm, 6*mm, 3*mm, fill=True, stroke=True)
    c.setFillColor(black)
    c.drawString(margin_x + 8*mm, legend_y - 2.5*mm, "✓ Pagado")
    
    # Rojo - Pendiente
    c.setFillColorRGB(0.8, 0.1, 0.1)
    c.rect(margin_x + 35*mm, legend_y - 3*mm, 6*mm, 3*mm, fill=True, stroke=True)
    c.setFillColor(black)
    c.drawString(margin_x + 43*mm, legend_y - 2.5*mm, "✗ Pendiente")
    
    y_position -= 10 * mm
    
    # Grid de meses (3 filas x 4 columnas)
    meses_nombres = [
        'Enero', 'Febrero', 'Marzo', 'Abril',
        'Mayo', 'Junio', 'Julio', 'Agosto',
        'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    
    cell_width = 45 * mm
    cell_height = 20 * mm
    cols = 4
    
    for i, mes_nombre in enumerate(meses_nombres):
        mes_num = i + 1
        row = i // cols
        col = i % cols
        
        x = margin_x + col * cell_width
        y = y_position - row * cell_height
        
        # Determinar color según estado - SOLO 2 ESTADOS
        if mes_num in pagos_dict:
            # Pagado - Verde más fuerte
            color = Color(0.2, 0.6, 0.2, alpha=0.4)
            estado = "✓ PAGADO"
            monto = pagos_dict[mes_num]['monto_pagado']
            fecha = pagos_dict[mes_num]['fecha_pago']
        else:
            # Pendiente - Rojo más fuerte
            color = Color(0.8, 0.1, 0.1, alpha=0.3)
            estado = "✗ PENDIENTE"
            monto = precio_cuota
            fecha = None
        
        # Dibujar celda con bordes redondeados
        c.setFillColor(color)
        c.setStrokeColorRGB(0.3, 0.3, 0.3)
        c.setLineWidth(0.8)
        c.roundRect(x, y - cell_height, cell_width - 1*mm, cell_height, 2*mm, fill=True, stroke=True)
        
        # Texto
        c.setFillColor(black)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x + 3*mm, y - 6*mm, mes_nombre)
        
        c.setFont("Helvetica-Bold", 8)
        if mes_num in pagos_dict:
            c.setFillColorRGB(0.1, 0.4, 0.1)  # Verde oscuro
        else:
            c.setFillColorRGB(0.6, 0.0, 0.0)  # Rojo oscuro
        c.drawString(x + 3*mm, y - 11*mm, estado)
        
        c.setFillColor(black)
        if monto:
            c.setFont("Helvetica-Bold", 9)
            c.drawString(x + 3*mm, y - 16*mm, f"${int(monto):,}")
        
        if fecha:
            c.setFont("Helvetica", 7)
            fecha_str = fecha.strftime("%d/%m/%Y") if hasattr(fecha, 'strftime') else str(fecha)
            c.drawString(x + 3*mm, y - 19*mm, fecha_str)
    
    y_position -= 70 * mm
    
    # ==================== RESUMEN ====================
    
    # Fondo con gradiente visual
    c.setFillColorRGB(0.93, 0.93, 0.95)
    c.roundRect(margin_x, y_position - 28*mm, width - 2*margin_x, 28*mm, 3*mm, fill=True, stroke=True)
    
    c.setFillColor(black)
    c.setFont("Helvetica-Bold", 14)
    y_resumen = y_position - 10*mm
    c.drawString(margin_x + 5*mm, y_resumen, "📊 RESUMEN ANUAL")
    
    c.setFont("Helvetica", 10)
    y_resumen -= 7*mm
    
    meses_pagados = len(pagos_dict)
    # Total de meses pendientes = todos los meses del año menos los pagados
    meses_pendientes = 12 - meses_pagados
    
    c.drawString(margin_x + 5*mm, y_resumen, f"Meses Pagados: {meses_pagados}")
    c.drawString(margin_x + 60*mm, y_resumen, f"Meses Pendientes: {meses_pendientes}")
    
    y_resumen -= 6*mm
    
    # Calcular deuda real basada en meses pendientes
    deuda_real = meses_pendientes * precio_cuota
    
    # Deuda total con estilo mejorado
    y_resumen -= 2*mm
    c.setFont("Helvetica-Bold", 11)
    
    if deuda_real > 0:
        # Recuadro para deuda
        c.setFillColorRGB(0.96, 0.87, 0.87)
        c.setStrokeColorRGB(0.8, 0.2, 0.2)
        c.setLineWidth(1.5)
        c.roundRect(margin_x + 3*mm, y_resumen - 10*mm, 85*mm, 10*mm, 3*mm, fill=True, stroke=True)
        
        # Texto de deuda
        c.setFillColorRGB(0.7, 0.0, 0.0)
        c.drawString(margin_x + 7*mm, y_resumen - 5*mm, f"DEUDA TOTAL: ${int(deuda_real):,}")
    else:
        # Recuadro para al día
        c.setFillColorRGB(0.87, 0.96, 0.87)
        c.setStrokeColorRGB(0.2, 0.7, 0.2)
        c.setLineWidth(1.5)
        c.roundRect(margin_x + 3*mm, y_resumen - 10*mm, 85*mm, 10*mm, 3*mm, fill=True, stroke=True)
        
        # Texto al día
        c.setFillColorRGB(0.0, 0.6, 0.0)
        c.drawString(margin_x + 7*mm, y_resumen - 5*mm, "✅ AL DÍA - Sin deuda pendiente")
    
    # ==================== FOOTER ====================
    
    # Línea separadora
    c.setStrokeColorRGB(0.7, 0.7, 0.7)
    c.setLineWidth(0.5)
    c.line(margin_x, 20*mm, width - margin_x, 20*mm)
    
    c.setFillColorRGB(0.4, 0.4, 0.4)
    c.setFont("Helvetica", 7)
    footer_text = "📄 Este documento es un comprobante del estado de cuotas sociales. No constituye un recibo de pago."
    c.drawString(margin_x, 16*mm, footer_text)
    
    # Fecha de generación en el footer
    fecha_generacion = datetime.now().strftime("%d/%m/%Y a las %H:%M")
    c.setFont("Helvetica", 6)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawString(margin_x, 12*mm, f"Generado el {fecha_generacion}")
    
    c.setFont("Helvetica-Oblique", 6)
    c.drawString(margin_x, 9*mm, f"🚒 Sistema de Gestión Bomberil - {datetime.now().year}")
    c.drawString(width - margin_x - 25*mm, 9*mm, "Página 1 de 1")
    
    # Finalizar PDF
    c.showPage()
    c.save()
    
    buffer.seek(0)
    return buffer


def generar_pdf_deudores(deudores_data, anio, logo_base64=None):
    """
    Genera PDF con listado de deudores de cuotas.
    Soporta 100+ entradas con paginación automática y headers repetidos.

    Args:
        deudores_data: Lista de diccionarios con info de deudores
        anio: Año de referencia
        logo_base64: String base64 del logo (opcional)

    Returns:
        BytesIO con el PDF generado
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    MX = 15 * mm          # margin x
    MY = 12 * mm          # margin y
    ROW_H = 6.5 * mm      # altura de cada fila de datos
    TH_H = 8 * mm         # altura del encabezado de tabla
    FOOTER_Y = MY + 6*mm  # posición y del footer

    # Columnas: (x_inicio, ancho)
    COL_NUM    = (MX,          10*mm)
    COL_NOMBRE = (MX + 11*mm,  80*mm)
    COL_CLAVE  = (MX + 92*mm,  20*mm)
    COL_MESES  = (MX + 113*mm, 42*mm)
    COL_DEUDA  = (MX + 156*mm, 22*mm)

    tabla_ancho = width - 2*MX
    total_deuda = Decimal('0')
    page_num = [1]

    # ---- helpers ----
    def _logo(y_top):
        if not logo_base64:
            return
        try:
            from reportlab.lib.utils import ImageReader
            import base64 as b64
            data = b64.b64decode(logo_base64.split(',')[1] if ',' in logo_base64 else logo_base64)
            img = ImageReader(BytesIO(data))
            c.setFillColor(white)
            c.rect(MX - 1*mm, y_top - 24*mm, 26*mm, 25*mm, fill=True, stroke=False)
            c.drawImage(img, MX, y_top - 23*mm, width=22*mm, height=22*mm, preserveAspectRatio=True)
        except Exception:
            pass

    def _header_primera_pagina():
        y = height - MY
        _logo(y)
        # Título principal (zona: logo 27mm + resto hasta margen derecho)
        c.setFillColorRGB(0.77, 0.12, 0.23)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(MX + 27*mm, y - 8*mm, "LISTADO DE DEUDORES DE CUOTAS SOCIALES")
        c.setFont("Helvetica-Bold", 10)
        c.drawString(MX + 27*mm, y - 16*mm, f"Ciclo {anio}")
        # Fecha + total — derecha, alineados, sin riesgo de solapamiento
        c.setFont("Helvetica", 8)
        c.setFillColorRGB(0.4, 0.4, 0.4)
        fecha = datetime.now().strftime("%d/%m/%Y %H:%M")
        c.drawRightString(width - MX, y - 8*mm, f"Generado: {fecha}")
        c.drawRightString(width - MX, y - 16*mm, f"Total registros: {len(deudores_data)}")
        # Línea roja
        c.setStrokeColorRGB(0.77, 0.12, 0.23)
        c.setLineWidth(2)
        c.line(MX, y - 22*mm, width - MX, y - 22*mm)
        return y - 27*mm   # retorna y justo antes de tabla

    def _header_continuacion():
        y = height - MY
        c.setFillColorRGB(0.77, 0.12, 0.23)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(MX, y - 7*mm, f"DEUDORES DE CUOTAS - AÑO {anio}  (continuación)")
        c.setFont("Helvetica", 8)
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.drawRightString(width - MX, y - 7*mm, f"Pag. {page_num[0]}")
        c.setStrokeColorRGB(0.77, 0.12, 0.23)
        c.setLineWidth(1)
        c.line(MX, y - 11*mm, width - MX, y - 11*mm)
        return y - 16*mm

    def _encabezado_tabla(y):
        c.setFillColorRGB(0.77, 0.12, 0.23)
        c.rect(MX, y - TH_H, tabla_ancho, TH_H, fill=True, stroke=False)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 8)
        ry = y - TH_H + 2.5*mm
        c.drawString(COL_NUM[0] + 1*mm,    ry, "#")
        c.drawString(COL_NOMBRE[0] + 1*mm, ry, "NOMBRE COMPLETO")
        c.drawString(COL_CLAVE[0] + 1*mm,  ry, "CLAVE")
        c.drawString(COL_MESES[0] + 1*mm,  ry, "MESES PENDIENTES")
        c.drawRightString(COL_DEUDA[0] + COL_DEUDA[1] - 1*mm, ry, "DEUDA")
        return y - TH_H

    def _footer():
        c.setFont("Helvetica", 7)
        c.setFillColorRGB(0.5, 0.5, 0.5)
        c.drawString(MX, FOOTER_Y, "Cuerpo de Bomberos - Sistema de Gestion Bomberil")
        c.drawRightString(width - MX, FOOTER_Y, f"Pag. {page_num[0]}")

    def _nueva_pagina(continuation=True):
        _footer()
        c.showPage()
        page_num[0] += 1
        if continuation:
            return _encabezado_tabla(_header_continuacion())
        return None

    # ---- Primera página ----
    y = _encabezado_tabla(_header_primera_pagina())

    # ---- Filas de datos ----
    for idx, deudor in enumerate(deudores_data):
        # Nueva página si no cabe la fila + espacio para footer + total
        if y - ROW_H < FOOTER_Y + 22*mm:
            y = _nueva_pagina(continuation=True)

        # Fondo alternado
        if idx % 2 == 0:
            c.setFillColorRGB(0.97, 0.97, 0.99)
            c.rect(MX, y - ROW_H, tabla_ancho, ROW_H, fill=True, stroke=False)

        # Línea inferior fila
        c.setStrokeColorRGB(0.88, 0.88, 0.92)
        c.setLineWidth(0.3)
        c.line(MX, y - ROW_H, MX + tabla_ancho, y - ROW_H)

        row_y = y - ROW_H + 1.8*mm

        # Número
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.setFont("Helvetica", 8)
        c.drawString(COL_NUM[0] + 1*mm, row_y, str(idx + 1))

        # Nombre (truncar a 40 chars)
        nombre = (deudor.get('nombre', '') or '')[:40]
        c.setFillColor(black)
        c.setFont("Helvetica", 8)
        c.drawString(COL_NOMBRE[0] + 1*mm, row_y, nombre)

        # Clave
        c.setFont("Helvetica", 8)
        c.drawString(COL_CLAVE[0] + 1*mm, row_y, str(deudor.get('clave', '') or 'N/A'))

        # Meses (truncar a 38 chars)
        meses = (deudor.get('meses_nombres', '') or str(deudor.get('meses_pendientes', '')))[:38]
        c.setFont("Helvetica", 7)
        c.setFillColorRGB(0.65, 0.0, 0.0)
        c.drawString(COL_MESES[0] + 1*mm, row_y, meses)

        # Deuda
        deuda_val = deudor.get('deuda_total', 0)
        total_deuda += Decimal(str(deuda_val))
        c.setFont("Helvetica-Bold", 8)
        c.setFillColorRGB(0.0, 0.45, 0.0)
        c.drawRightString(COL_DEUDA[0] + COL_DEUDA[1] - 1*mm, row_y, f"${int(deuda_val):,}")

        y -= ROW_H

    # ---- Resumen final ----
    y -= 4*mm
    if y - 16*mm < FOOTER_Y + 5*mm:
        y = _nueva_pagina(continuation=False)
        y = height - MY - 10*mm

    c.setStrokeColorRGB(0.77, 0.12, 0.23)
    c.setLineWidth(1.5)
    c.line(MX, y, width - MX, y)
    y -= 9*mm

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(black)
    c.drawString(MX, y, f"TOTAL DEUDORES: {len(deudores_data)}")
    c.setFillColorRGB(0.77, 0.12, 0.23)
    c.drawRightString(width - MX, y, f"DEUDA TOTAL: ${int(total_deuda):,}")

    _footer()
    c.showPage()
    c.save()

    buffer.seek(0)
    return buffer
