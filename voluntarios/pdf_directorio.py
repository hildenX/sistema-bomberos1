"""
Generación de PDF del Acta de Directorio de Compañía.
Sigue el formato del acta institucional de la 6ta Compañía de Bomberos Puerto Montt.
"""
import base64
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit, ImageReader

NOMBRE_COMPANIA = "SEXTA COMPAÑIA DE BOMBEROS PUERTO MONTT"
LEMA_COMPANIA = "ABNEGACIÓN Y CONSTANCIA"
DIRECCION_COMPANIA = "Chorrillos 1339 - Fono 65-2252666 - Puerto Montt"

MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

MARGEN = 22 * mm
MARGEN_MARCO = 10 * mm
ANCHO, ALTO = A4


def _formatear_fecha(fecha):
    return f"{fecha.day} de {MESES[fecha.month - 1]} de {fecha.year}"


def _formatear_hora(hora):
    if not hora:
        return "--:--"
    return hora.strftime('%H:%M')


def _calcular_numero_acta_fallback(evento):
    """
    Si el evento no tiene numero_acta asignado, calcula uno en base a su posición
    entre los eventos del mismo tipo y año (orden cronológico), para no mostrar
    un placeholder vacío en el PDF.
    """
    from .models import EventoAsistencia
    eventos_anio = list(
        EventoAsistencia.objects.filter(tipo=evento.tipo, fecha__year=evento.fecha.year)
        .order_by('fecha', 'id')
        .values_list('id', flat=True)
    )
    try:
        posicion = eventos_anio.index(evento.id) + 1
    except ValueError:
        posicion = len(eventos_anio) + 1
    return f"{posicion:03d}/{evento.fecha.year}"


def _buscar_nombre_por_cargo(asistentes, palabras_clave):
    for asistente in asistentes:
        cargo = (asistente.cargo or '').lower()
        if any(palabra in cargo for palabra in palabras_clave):
            return asistente.nombre_completo
    return None


def _truncar_texto(c, texto, ancho_max, fuente='Helvetica', tamano=9):
    if not texto:
        return ''
    if c.stringWidth(texto, fuente, tamano) <= ancho_max:
        return texto
    recortado = texto
    while recortado and c.stringWidth(recortado + '…', fuente, tamano) > ancho_max:
        recortado = recortado[:-1]
    return recortado + '…' if recortado else ''


def _buscar_nombre_por_cargo_exacto(asistentes, nombre_cargo):
    for asistente in asistentes:
        if (asistente.cargo or '').strip().lower() == nombre_cargo.lower():
            return asistente.nombre_completo
    return ''


def _obtener_logo_pdf():
    """Busca el logo marcado para uso en PDFs y lo retorna listo para reportlab."""
    try:
        from .models import LogoCompania
        logo = LogoCompania.objects.filter(usar_en_pdfs=True).first()
        if not logo or not logo.imagen:
            return None
        data = logo.imagen
        if data.startswith('data:'):
            data = data.split(',', 1)[1]
        raw = base64.b64decode(data)
        return ImageReader(BytesIO(raw))
    except Exception:
        return None


def _dibujar_marco(c):
    c.setLineWidth(1.2)
    c.setStrokeColorRGB(0.06, 0.2, 0.35)
    c.rect(MARGEN_MARCO, MARGEN_MARCO, ANCHO - 2 * MARGEN_MARCO, ALTO - 2 * MARGEN_MARCO)
    c.setFont('Helvetica', 8)
    c.setFillColorRGB(0, 0, 0)
    c.drawCentredString(ANCHO / 2, MARGEN_MARCO + 6, DIRECCION_COMPANIA)


class _PaginadorPDF:
    """Maneja el dibujado de texto con saltos de página automáticos."""

    def __init__(self, canvas_obj):
        self.c = canvas_obj
        _dibujar_marco(self.c)
        self.y = ALTO - MARGEN

    def nueva_pagina(self):
        self.c.showPage()
        _dibujar_marco(self.c)
        self.y = ALTO - MARGEN

    def asegurar_espacio(self, alto_necesario):
        if self.y - alto_necesario < MARGEN:
            self.nueva_pagina()

    def linea(self, texto, x=MARGEN, fuente='Helvetica', tamano=10, salto=14, centrado=False, negrita=False):
        self.asegurar_espacio(salto)
        fuente_usar = 'Helvetica-Bold' if negrita else fuente
        self.c.setFont(fuente_usar, tamano)
        if centrado:
            self.c.drawCentredString(ANCHO / 2, self.y, texto)
        else:
            self.c.drawString(x, self.y, texto)
        self.y -= salto

    def parrafo(self, texto, x=MARGEN, ancho=None, fuente='Helvetica', tamano=10, salto=14):
        if ancho is None:
            ancho = ANCHO - 2 * MARGEN
        self.c.setFont(fuente, tamano)
        for parrafo_original in (texto or '').split('\n'):
            if not parrafo_original.strip():
                self.asegurar_espacio(salto)
                self.y -= salto
                continue
            lineas = simpleSplit(parrafo_original, fuente, tamano, ancho)
            for linea_texto in lineas:
                self.asegurar_espacio(salto)
                self.c.setFont(fuente, tamano)
                self.c.drawString(x, self.y, linea_texto)
                self.y -= salto

    def espacio(self, alto):
        self.asegurar_espacio(alto)
        self.y -= alto


TIPO_DISPLAY = {
    'asamblea': 'Acta de Asamblea',
    'ejercicios': 'Acta de Ejercicios',
    'citaciones': 'Acta de Citación',
    'otras': 'Acta de Actividad',
}


def generar_pdf_generico(evento):
    """
    Genera un PDF de acta/comprobante genérico para eventos que no son Directorio
    (asamblea, ejercicios, citaciones, otras).

    Args:
        evento: instancia de EventoAsistencia

    Returns:
        BytesIO: buffer con el PDF generado
    """
    titulo = TIPO_DISPLAY.get(evento.tipo, 'Acta de Asistencia')

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setTitle(f"{titulo} - {evento.fecha}")
    p = _PaginadorPDF(c)

    asistentes = list(evento.asistentes.all().order_by('nombre_completo'))

    # ---- ENCABEZADO ----
    p.linea(NOMBRE_COMPANIA, centrado=True, negrita=True, tamano=13, salto=18)
    p.linea(LEMA_COMPANIA, centrado=True, fuente='Helvetica-Oblique', tamano=10, salto=20)

    p.linea(titulo.upper(), centrado=True, negrita=True, tamano=13, salto=20)
    p.linea(f"Puerto Montt, {_formatear_fecha(evento.fecha)}", centrado=True, tamano=10, salto=22)

    if evento.descripcion:
        p.linea(evento.descripcion, centrado=True, fuente='Helvetica-Oblique', tamano=10, salto=20)

    hora_inicio = _formatear_hora(evento.hora_inicio)
    hora_termino = _formatear_hora(evento.hora_termino)
    p.linea(f"Hora de inicio: {hora_inicio}   -   Hora de término: {hora_termino}", tamano=10, salto=18)
    p.espacio(6)

    # ---- ASISTENCIA ----
    p.linea("Asistencia:", negrita=True, tamano=11, salto=16)
    if asistentes:
        for asistente in asistentes:
            cargo = asistente.cargo or asistente.categoria or ''
            texto = f"•  {asistente.nombre_completo}"
            if cargo:
                texto += f"  —  {cargo}"
            p.linea(texto, tamano=10, salto=14)
    else:
        p.linea("Sin asistentes registrados.", tamano=10, salto=14)
    p.espacio(10)

    # ---- OBSERVACIONES ----
    if evento.observaciones:
        p.linea("Observaciones:", negrita=True, tamano=11, salto=16)
        p.parrafo(evento.observaciones, tamano=10, salto=14)
        p.espacio(10)

    c.save()
    buffer.seek(0)
    return buffer


FILAS_ASISTENCIA = [
    ('Director', 'Director', 'Tte. 1ro.', 'Teniente Primero'),
    ('Secretario', 'Secretario', 'Tte 2do.', 'Teniente Segundo'),
    ('Tesorero', 'Tesorero', 'Tte 3ro', 'Teniente Tercero'),
    ('Capitán', 'Capitán', 'Tte 4to', 'Teniente Cuarto'),
]


def generar_pdf_acta_directorio(evento):
    """
    Genera el PDF del Acta de Directorio de Compañía para un EventoAsistencia de tipo 'directorio'.

    Args:
        evento: instancia de EventoAsistencia (tipo='directorio')

    Returns:
        BytesIO: buffer con el PDF generado
    """
    numero_acta = evento.numero_acta or _calcular_numero_acta_fallback(evento)

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setTitle(f"Acta Directorio N {numero_acta} - {evento.fecha}")
    p = _PaginadorPDF(c)

    asistentes = list(evento.asistentes.all().order_by('nombre_completo'))
    temas = evento.temas if isinstance(evento.temas, list) else []
    nombre_director = _buscar_nombre_por_cargo(asistentes, ['director']) or ''

    # ---- ENCABEZADO ----
    logo = _obtener_logo_pdf()
    if logo:
        logo_tam = 15 * mm
        c.drawImage(
            logo, ANCHO - MARGEN - logo_tam, p.y - logo_tam,
            width=logo_tam, height=logo_tam, mask='auto', preserveAspectRatio=True, anchor='c'
        )

    p.linea(NOMBRE_COMPANIA, centrado=True, negrita=True, tamano=13, salto=16)
    if nombre_director:
        p.linea(f"DIRECTOR {nombre_director.upper()}", centrado=True, negrita=True, tamano=9, salto=13)
    p.linea(f'"{LEMA_COMPANIA}"', centrado=True, fuente='Helvetica-Oblique', tamano=9, salto=14)

    c.setLineWidth(0.6)
    c.line(MARGEN, p.y, ANCHO - MARGEN, p.y)
    p.y -= 16

    # ---- TÍTULO ----
    barra_alto = 18
    c.setFillColorRGB(0.85, 0.85, 0.85)
    c.rect(MARGEN, p.y - barra_alto + 4, ANCHO - 2 * MARGEN, barra_alto, fill=1, stroke=1)
    c.setFillColorRGB(0, 0, 0)
    c.setFont('Helvetica-Bold', 11)
    c.drawString(MARGEN + 6, p.y - barra_alto + 9, "ACTA DIRECTORIO DE COMPAÑÍA")
    p.y -= barra_alto + 14

    # ---- ACTA N° ----
    caja_ancho = 55 * mm
    caja_alto = 14
    x_caja = ANCHO - MARGEN - caja_ancho
    c.setLineWidth(0.8)
    c.rect(x_caja, p.y - caja_alto + 4, caja_ancho, caja_alto)
    c.line(x_caja + 22 * mm, p.y - caja_alto + 4, x_caja + 22 * mm, p.y + 4)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(x_caja + 4, p.y - caja_alto + 9, "Acta N°")
    c.setFont('Helvetica', 9)
    c.drawString(x_caja + 22 * mm + 4, p.y - caja_alto + 9, numero_acta)
    p.y -= caja_alto + 14

    # ---- FECHA ----
    c.setFont('Helvetica-Bold', 10)
    c.drawRightString(ANCHO - MARGEN, p.y, f"PUERTO MONTT, {_formatear_fecha(evento.fecha)}")
    p.y -= 22

    # ---- TABLA DE ASISTENCIA ----
    x0 = MARGEN
    w_total = ANCHO - 2 * MARGEN
    label_w = 30 * mm
    name_w = (w_total - 2 * label_w) / 2
    fila_alto = 16

    p.asegurar_espacio(fila_alto * 5)

    c.setFillColorRGB(0.85, 0.85, 0.85)
    c.rect(x0, p.y - fila_alto + 4, w_total, fila_alto, fill=1, stroke=1)
    c.setFillColorRGB(0, 0, 0)
    c.setFont('Helvetica-Bold', 10)
    c.drawCentredString(x0 + w_total / 2, p.y - fila_alto + 9, "ASISTENCIA")
    p.y -= fila_alto

    for label1, cargo1, label2, cargo2 in FILAS_ASISTENCIA:
        nombre1 = _buscar_nombre_por_cargo_exacto(asistentes, cargo1)
        nombre2 = _buscar_nombre_por_cargo_exacto(asistentes, cargo2)
        y_fila = p.y - fila_alto + 4

        c.setFillColorRGB(0.93, 0.95, 0.98)
        c.rect(x0, y_fila, label_w, fila_alto, fill=1, stroke=1)
        c.rect(x0 + label_w + name_w, y_fila, label_w, fila_alto, fill=1, stroke=1)
        c.setFillColorRGB(1, 1, 1)
        c.rect(x0 + label_w, y_fila, name_w, fila_alto, fill=1, stroke=1)
        c.rect(x0 + 2 * label_w + name_w, y_fila, name_w, fila_alto, fill=1, stroke=1)

        c.setFillColorRGB(0, 0, 0)
        c.setFont('Helvetica-Bold', 9)
        c.drawString(x0 + 4, y_fila + 5, label1)
        c.drawString(x0 + label_w + name_w + 4, y_fila + 5, label2)
        c.setFont('Helvetica', 8)
        ancho_disponible = name_w - 8
        c.drawString(x0 + label_w + 4, y_fila + 5, _truncar_texto(c, nombre1, ancho_disponible, 'Helvetica', 8))
        c.drawString(x0 + 2 * label_w + name_w + 4, y_fila + 5, _truncar_texto(c, nombre2, ancho_disponible, 'Helvetica', 8))
        p.y -= fila_alto

    p.espacio(16)

    intro = (
        "Dando comienzo a éste directorio, se inicia la sesión con el resumen de puntos "
        "tratados en el Directorio de compañía anterior."
    )
    _dibujar_bloque_temas_y_cierre(p, c, evento, temas, asistentes, nombre_director, intro)

    c.save()
    buffer.seek(0)
    return buffer


def _dibujar_bloque_temas_y_cierre(p, c, evento, temas, asistentes, nombre_director, intro_texto):
    """
    Bloque compartido entre el acta de Directorio y de Asamblea: resumen de
    temas a tratar, desarrollo de cada tema (siempre cerrando con "Varios" si
    hay observaciones), cierre con la hora en negrita, firmas y "Dist:".
    """
    # ---- TEMAS A TRATAR (resumen) ----
    p.linea("Temas a Tratar:", negrita=True, tamano=10, salto=14)
    if temas:
        for idx, tema in enumerate(temas, start=1):
            titulo = (tema.get('titulo') or '').strip() or f'Tema {idx}'
            p.linea(f"{idx}.- {titulo}", tamano=9, salto=12)
    else:
        p.linea("Sin temas registrados.", tamano=9, salto=12)
    if evento.observaciones:
        p.linea(f"{len(temas) + 1}.- Varios", tamano=9, salto=12)
    p.espacio(6)
    c.setLineWidth(0.6)
    c.line(MARGEN, p.y, ANCHO - MARGEN, p.y)
    p.espacio(14)

    # ---- INTRODUCCIÓN ----
    p.parrafo(intro_texto, tamano=10, salto=14)
    p.espacio(12)

    # ---- DESARROLLO DE TEMAS ----
    if not temas and not evento.observaciones:
        p.parrafo("Sin temas registrados.", tamano=10, salto=14)
    else:
        for idx, tema in enumerate(temas, start=1):
            titulo = (tema.get('titulo') or '').strip() or f'Tema {idx}'
            contenido = (tema.get('contenido') or '').strip()
            p.linea(f"Temas {idx} - {titulo}:", negrita=True, tamano=10, salto=16)
            if contenido:
                p.parrafo(contenido, tamano=10, salto=14)
            p.espacio(10)

        if evento.observaciones:
            p.linea(f"Temas {len(temas) + 1} - Varios:", negrita=True, tamano=10, salto=16)
            p.parrafo(evento.observaciones, tamano=10, salto=14)
            p.espacio(10)

    # ---- CIERRE ----
    p.asegurar_espacio(24)
    hora_termino = _formatear_hora(evento.hora_termino)
    texto1 = "Sin otros temas más que tratar, se da por finalizada esta sesión siendo las "
    texto2 = f"{hora_termino} hrs."
    c.setFont('Helvetica', 10)
    ancho_texto1 = c.stringWidth(texto1, 'Helvetica', 10)
    c.drawString(MARGEN, p.y, texto1)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(MARGEN + ancho_texto1, p.y, texto2)

    # ---- FIRMAS ----
    # Se reserva todo el bloque (espacio en blanco para firmar + firmas) ANTES de
    # descontar el espacio en blanco, para que si hay que saltar de página el
    # espacio para firmar quede visible debajo del margen superior de la página
    # nueva, en vez de perderse justo antes del salto.
    nombre_secretario = _buscar_nombre_por_cargo_exacto(asistentes, 'Secretario')

    p.asegurar_espacio(90 + 50 + 26)
    p.y -= 90
    ancho_firma = 70 * mm
    x_izq = MARGEN + 5 * mm
    x_der = ANCHO - MARGEN - ancho_firma - 5 * mm

    c.setFont('Helvetica-Bold', 10)
    c.drawCentredString(x_izq + ancho_firma / 2, p.y, nombre_secretario)
    c.drawCentredString(x_der + ancho_firma / 2, p.y, nombre_director)
    p.y -= 14
    c.setFont('Helvetica-Oblique', 9)
    c.drawCentredString(x_izq + ancho_firma / 2, p.y, "Secretario")
    c.drawCentredString(x_der + ancho_firma / 2, p.y, "Director")
    p.y -= 26

    p.linea("Dist:", tamano=9, salto=12)
    p.linea("- Archivos de Cía.", tamano=9, salto=14)


def generar_pdf_acta_asamblea(evento):
    """
    Genera el PDF del Acta de Asamblea de Compañía para un EventoAsistencia de tipo 'asamblea'.

    Args:
        evento: instancia de EventoAsistencia (tipo='asamblea')

    Returns:
        BytesIO: buffer con el PDF generado
    """
    numero_acta = evento.numero_acta or _calcular_numero_acta_fallback(evento)

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setTitle(f"Acta Asamblea N {numero_acta} - {evento.fecha}")
    p = _PaginadorPDF(c)

    asistentes = list(evento.asistentes.all().order_by('nombre_completo'))
    temas = evento.temas if isinstance(evento.temas, list) else []
    nombre_director = _buscar_nombre_por_cargo(asistentes, ['director']) or ''

    # ---- ENCABEZADO ----
    logo = _obtener_logo_pdf()
    if logo:
        logo_tam = 15 * mm
        c.drawImage(
            logo, ANCHO - MARGEN - logo_tam, p.y - logo_tam,
            width=logo_tam, height=logo_tam, mask='auto', preserveAspectRatio=True, anchor='c'
        )

    p.linea(NOMBRE_COMPANIA, centrado=True, negrita=True, tamano=13, salto=16)
    if nombre_director:
        p.linea(f"DIRECTOR {nombre_director.upper()}", centrado=True, negrita=True, tamano=9, salto=13)
    p.linea(f'"{LEMA_COMPANIA}"', centrado=True, fuente='Helvetica-Oblique', tamano=9, salto=14)

    c.setLineWidth(0.6)
    c.line(MARGEN, p.y, ANCHO - MARGEN, p.y)
    p.y -= 16

    # ---- TÍTULO ----
    barra_alto = 18
    c.setFillColorRGB(0.85, 0.85, 0.85)
    c.rect(MARGEN, p.y - barra_alto + 4, ANCHO - 2 * MARGEN, barra_alto, fill=1, stroke=1)
    c.setFillColorRGB(0, 0, 0)
    c.setFont('Helvetica-Bold', 11)
    c.drawString(MARGEN + 6, p.y - barra_alto + 9, "ACTA ASAMBLEA DE COMPAÑÍA")
    p.y -= barra_alto + 14

    # ---- ACTA N° ----
    caja_ancho = 55 * mm
    caja_alto = 14
    x_caja = ANCHO - MARGEN - caja_ancho
    c.setLineWidth(0.8)
    c.rect(x_caja, p.y - caja_alto + 4, caja_ancho, caja_alto)
    c.line(x_caja + 22 * mm, p.y - caja_alto + 4, x_caja + 22 * mm, p.y + 4)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(x_caja + 4, p.y - caja_alto + 9, "Acta N°")
    c.setFont('Helvetica', 9)
    c.drawString(x_caja + 22 * mm + 4, p.y - caja_alto + 9, numero_acta)
    p.y -= caja_alto + 14

    # ---- FECHA ----
    c.setFont('Helvetica-Bold', 10)
    c.drawRightString(ANCHO - MARGEN, p.y, f"PUERTO MONTT, {_formatear_fecha(evento.fecha)}")
    p.y -= 22

    # ---- TIPO DE CITACIÓN ----
    x0 = MARGEN
    w_total = ANCHO - 2 * MARGEN
    fila_alto = 16
    mitad = w_total / 2

    p.asegurar_espacio(fila_alto * 2)

    c.setFillColorRGB(0.85, 0.85, 0.85)
    c.rect(x0, p.y - fila_alto + 4, w_total, fila_alto, fill=1, stroke=1)
    c.setFillColorRGB(0, 0, 0)
    c.setFont('Helvetica-Bold', 10)
    c.drawCentredString(x0 + w_total / 2, p.y - fila_alto + 9, "TIPO DE CITACIÓN")
    p.y -= fila_alto

    y_fila = p.y - fila_alto + 4
    marca_ord = 'X' if evento.tipo_asamblea == 'ordinaria' else ''
    marca_extra = 'X' if evento.tipo_asamblea == 'extraordinaria' else ''

    c.setFillColorRGB(0.93, 0.95, 0.98)
    c.rect(x0, y_fila, mitad, fila_alto, fill=1, stroke=1)
    c.rect(x0 + mitad, y_fila, mitad, fila_alto, fill=1, stroke=1)
    c.setFillColorRGB(0, 0, 0)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(x0 + 4, y_fila + 5, "Asamblea Extraordinaria")
    c.drawString(x0 + mitad + 4, y_fila + 5, "Asamblea Ordinaria")
    c.rect(x0 + mitad - 24, y_fila + 3, 10, 10)
    c.rect(x0 + w_total - 24, y_fila + 3, 10, 10)
    c.setFont('Helvetica-Bold', 9)
    c.drawCentredString(x0 + mitad - 19, y_fila + 5, marca_extra)
    c.drawCentredString(x0 + w_total - 19, y_fila + 5, marca_ord)
    p.y -= fila_alto

    p.espacio(16)

    intro = (
        "Dando comienzo a ésta asamblea, se inicia la sesión con el resumen de puntos "
        "tratados en el Directorio del Cuerpo de Bomberos realizado recientemente."
    )
    _dibujar_bloque_temas_y_cierre(p, c, evento, temas, asistentes, nombre_director, intro)

    c.save()
    buffer.seek(0)
    return buffer
