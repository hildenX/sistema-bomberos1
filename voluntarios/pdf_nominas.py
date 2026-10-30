"""
Nóminas de deudores en PDF (cuotas sociales y beneficios) con el formato
institucional de la Sexta: franjas azul marino y guinda, encabezado con el
escudo, resumen arriba, tabla limpia, total destacado, observaciones y firma
del Tesorero. Pensadas para exhibirse en el cuartel.
"""
import base64
import re
from collections import OrderedDict
from datetime import date
from decimal import Decimal
from io import BytesIO

from reportlab.lib.colors import Color, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfgen import canvas

ANCHO, ALTO = A4
MX = 18 * mm
ANCHO_UTIL = ANCHO - 2 * MX
FRANJA = 4 * mm
LIMITE_INFERIOR = FRANJA + 22 * mm   # bajo esto no se dibujan filas (pie de página)

AZUL = Color(15 / 255, 35 / 255, 70 / 255)
GUINDA = Color(110 / 255, 18 / 255, 34 / 255)
TINTA = Color(0.10, 0.12, 0.18)
GRIS = Color(0.40, 0.43, 0.50)
LINEA = Color(0.86, 0.88, 0.92)
CEBRA = Color(0.955, 0.96, 0.975)
BANDA_GRUPO = Color(0.925, 0.935, 0.955)

COMPANIA = 'SEXTA COMPAÑÍA DE BOMBEROS'
CIUDAD = 'PUERTO MONTT'
LEMA = '«Abnegación y Constancia»'
PIE = 'Sexta Compañía de Bomberos Puerto Montt · Chorrillos 1339 · Fono 65-2252666'

MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
         'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']


# ---------------------------------------------------------------- utilidades

def _pesos(valor):
    """Formato chileno: $35.000"""
    return '$' + f"{int(round(float(valor or 0))):,}".replace(',', '.')


def _fecha_larga(fecha):
    return f"{fecha.day} de {MESES[fecha.month - 1]} de {fecha.year}"


def _rango_meses(numeros):
    """[1..8] -> '8 meses · ene a ago'; [1,3,4,5] -> '4 meses · ene, mar a may'"""
    meses = sorted(set(numeros))
    if not meses:
        return '—'
    tramos, inicio, previo = [], meses[0], meses[0]
    for m in meses[1:] + [None]:
        if m is not None and m == previo + 1:
            previo = m
            continue
        tramos.append(MESES_CORTOS[inicio - 1] if inicio == previo
                      else f"{MESES_CORTOS[inicio - 1]} a {MESES_CORTOS[previo - 1]}")
        if m is not None:
            inicio = previo = m
    cantidad = f"{len(meses)} {'mes' if len(meses) == 1 else 'meses'}"
    return f"{cantidad} · {', '.join(tramos)}"


def _orden_clave(clave):
    """Ordena '610-I', '653', '671-2' por número y luego por sufijo."""
    m = re.match(r'^(\d+)(.*)$', (clave or '').strip())
    return (int(m.group(1)), m.group(2)) if m else (10 ** 6, clave or '')


def _orden_antiguedad(voluntario):
    """Más antiguo primero; empata por clave."""
    return (voluntario.fecha_base_antiguedad or date.max, _orden_clave(voluntario.clave_bombero))


def _recortar(c, texto, fuente, tamano, ancho_max):
    texto = texto or ''
    if c.stringWidth(texto, fuente, tamano) <= ancho_max:
        return texto
    while texto and c.stringWidth(texto + '…', fuente, tamano) > ancho_max:
        texto = texto[:-1]
    return texto + '…'


def _logo_desde_base64(logo_base64):
    if not logo_base64:
        return None
    try:
        datos = logo_base64.split(',', 1)[1] if ',' in logo_base64 else logo_base64
        return ImageReader(BytesIO(base64.b64decode(datos)))
    except Exception:
        return None


def _tesorero_vigente():
    """Nombre de quien ejerce hoy el cargo de Tesorero de Compañía, si está registrado."""
    try:
        from django.db.models import Q
        from .models import Cargo
        hoy = date.today()
        cargo = (Cargo.objects
                 .filter(tipo_cargo='compania', nombre_cargo='Tesorero')
                 .filter(Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=hoy))
                 .select_related('voluntario')
                 .order_by('-anio', '-fecha_inicio')
                 .first())
        return cargo.voluntario.nombre_completo() if cargo else ''
    except Exception:
        return ''


# ------------------------------------------------------------ lienzo con pie

class _LienzoNumerado(canvas.Canvas):
    """Canvas que conoce el total de páginas para imprimir 'Página X de Y'."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._paginas = []

    def showPage(self):
        self._paginas.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._paginas)
        for estado in self._paginas:
            self.__dict__.update(estado)
            self._dibujar_pie(total)
            super().showPage()
        super().save()

    def _dibujar_pie(self, total):
        # Franja inferior (invertida respecto de la superior)
        self.setFillColor(GUINDA)
        self.rect(0, 0, ANCHO * 0.3, FRANJA, fill=1, stroke=0)
        self.setFillColor(AZUL)
        self.rect(ANCHO * 0.3, 0, ANCHO * 0.7, FRANJA, fill=1, stroke=0)
        self.setFont('Helvetica', 7.5)
        self.setFillColor(GRIS)
        self.drawCentredString(ANCHO / 2, FRANJA + 7 * mm, PIE)
        self.drawRightString(ANCHO - MX, FRANJA + 7 * mm, f"Página {self._pageNumber} de {total}")


# ------------------------------------------------------------ documento base

class _Nomina:
    """Arma la página: franjas, encabezado, resumen, tablas, cierre."""

    def __init__(self, titulo, subtitulo, titulo_corto, logo):
        self.buffer = BytesIO()
        self.c = _LienzoNumerado(self.buffer, pagesize=A4)
        self.c.setTitle(f"{titulo.capitalize()} - {subtitulo}")
        self.titulo, self.subtitulo, self.titulo_corto = titulo, subtitulo, titulo_corto
        self.logo = logo
        self.columnas = []
        self.y = 0
        # Los comprobantes cambian estas etiquetas ("Emitido el", "TOTAL PAGADO")
        self.etiqueta_fecha = 'Fecha de corte'
        self.etiqueta_total = 'TOTAL ADEUDADO'

    # -- piezas fijas
    def _franja_superior(self):
        c = self.c
        c.setFillColor(AZUL)
        c.rect(0, ALTO - FRANJA, ANCHO * 0.7, FRANJA, fill=1, stroke=0)
        c.setFillColor(GUINDA)
        c.rect(ANCHO * 0.7, ALTO - FRANJA, ANCHO * 0.3, FRANJA, fill=1, stroke=0)

    def encabezado(self, fecha_corte):
        c = self.c
        self._franja_superior()
        tope = ALTO - FRANJA - 12 * mm
        lado_logo = 24 * mm
        if self.logo:
            c.drawImage(self.logo, MX, tope - lado_logo, width=lado_logo, height=lado_logo,
                        mask='auto', preserveAspectRatio=True, anchor='c')
        x_texto = MX + lado_logo + 5 * mm
        c.setFillColor(AZUL)
        c.setFont('Helvetica-Bold', 10.5)
        c.drawString(x_texto, tope - 8 * mm, COMPANIA)
        c.drawString(x_texto, tope - 13 * mm, CIUDAD)
        c.setFillColor(GRIS)
        c.setFont('Helvetica-Oblique', 8.5)
        c.drawString(x_texto, tope - 18 * mm, LEMA)

        derecha = ANCHO - MX
        c.setFillColor(TINTA)
        c.setFont('Helvetica-Bold', 18)
        c.drawRightString(derecha, tope - 8 * mm, self.titulo)
        c.setFillColor(GUINDA)
        c.setFont('Helvetica-Bold', 10)
        c.drawRightString(derecha, tope - 14 * mm, self.subtitulo)
        c.setFillColor(GRIS)
        c.setFont('Helvetica', 8.5)
        c.drawRightString(derecha, tope - 19.5 * mm, f"{self.etiqueta_fecha}: {_fecha_larga(fecha_corte)}")
        c.drawRightString(derecha, tope - 24 * mm, 'Emitido por Tesorería de Compañía')

        y_linea = tope - lado_logo - 6 * mm
        c.setStrokeColor(GUINDA)
        c.setLineWidth(1.4)
        c.line(MX, y_linea, ANCHO - MX, y_linea)
        self.y = y_linea - 9 * mm

    def encabezado_continuacion(self):
        c = self.c
        self._franja_superior()
        tope = ALTO - FRANJA - 10 * mm
        c.setFillColor(AZUL)
        c.setFont('Helvetica-Bold', 9)
        c.drawString(MX, tope, f"{COMPANIA} {CIUDAD}")
        c.setFillColor(GRIS)
        c.setFont('Helvetica', 8.5)
        c.drawRightString(ANCHO - MX, tope, f"{self.titulo_corto} (continuación)")
        c.setStrokeColor(GUINDA)
        c.setLineWidth(0.8)
        c.line(MX, tope - 3.5 * mm, ANCHO - MX, tope - 3.5 * mm)
        self.y = tope - 10 * mm

    def bloque_datos(self, izquierda, derecha):
        """Dos columnas tipo 'Prestador / Cliente': (etiqueta, [lineas])."""
        c = self.c
        mitad = MX + ANCHO_UTIL / 2 + 4 * mm
        alto = 0
        for x, (etiqueta, lineas) in ((MX, izquierda), (mitad, derecha)):
            y = self.y
            c.setFillColor(GUINDA)
            c.setFont('Helvetica-Bold', 8)
            c.drawString(x, y, etiqueta)
            y -= 5.5 * mm
            for texto, negrita in lineas:
                c.setFillColor(TINTA)
                c.setFont('Helvetica-Bold' if negrita else 'Helvetica', 9.5 if negrita else 9)
                c.drawString(x, y, texto)
                y -= 4.8 * mm
            alto = max(alto, self.y - y)
        self.y -= alto + 5 * mm

    def titulo_seccion(self, texto):
        if not self._asegurar(22 * mm):
            self.y -= 4 * mm
        self.c.setFillColor(TINTA)
        self.c.setFont('Helvetica-Bold', 12)
        self.c.drawString(MX, self.y, texto)
        self.y -= 6 * mm

    # -- tabla
    def definir_columnas(self, columnas):
        """columnas: [(titulo, ancho_pt, alineacion)] con alineacion 'l' o 'r'."""
        self.columnas = columnas

    def _x_columnas(self):
        x, posiciones = MX, []
        for _, ancho, alin in self.columnas:
            posiciones.append((x, ancho, alin))
            x += ancho
        return posiciones

    def encabezado_tabla(self):
        c = self.c
        alto = 8 * mm
        c.setFillColor(AZUL)
        c.rect(MX, self.y - alto, ANCHO_UTIL, alto, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont('Helvetica-Bold', 8.5)
        base = self.y - alto + 2.8 * mm
        for (titulo, _, _), (x, ancho, alin) in zip(self.columnas, self._x_columnas(), strict=True):
            if alin == 'r':
                c.drawRightString(x + ancho - 2.5 * mm, base, titulo)
            else:
                c.drawString(x + 2.5 * mm, base, titulo)
        self.y -= alto

    def _asegurar(self, alto, repetir_tabla=False):
        if self.y - alto < LIMITE_INFERIOR:
            self.c.showPage()
            self.encabezado_continuacion()
            if repetir_tabla:
                self.encabezado_tabla()
            return True
        return False

    def fila(self, valores, indice, negritas=(), envolver=(), colores=None):
        """Fila de tabla; las columnas en 'envolver' pasan a varias líneas en vez de cortarse."""
        c = self.c
        columnas = self._x_columnas()
        interlinea = 4 * mm
        lineas_por_celda = []
        for i, (valor, (_, ancho, _)) in enumerate(zip(valores, columnas, strict=True)):
            fuente = 'Helvetica-Bold' if i in negritas else 'Helvetica'
            if i in envolver:
                lineas_por_celda.append(simpleSplit(str(valor), fuente, 9, ancho - 4 * mm) or [''])
            else:
                lineas_por_celda.append([_recortar(c, str(valor), fuente, 9, ancho - 4 * mm)])
        alto = max(7 * mm, max(len(ls) for ls in lineas_por_celda) * interlinea + 3 * mm)

        self._asegurar(alto, repetir_tabla=True)
        if indice % 2 == 1:
            c.setFillColor(CEBRA)
            c.rect(MX, self.y - alto, ANCHO_UTIL, alto, fill=1, stroke=0)
        c.setStrokeColor(LINEA)
        c.setLineWidth(0.4)
        c.line(MX, self.y - alto, MX + ANCHO_UTIL, self.y - alto)
        primera_base = self.y - 4.6 * mm
        for i, (lineas, (x, ancho, alin)) in enumerate(zip(lineas_por_celda, columnas, strict=True)):
            c.setFont('Helvetica-Bold' if i in negritas else 'Helvetica', 9)
            c.setFillColor((colores or {}).get(i) or (GRIS if i == 0 else TINTA))
            for n, texto in enumerate(lineas):
                base = primera_base - n * interlinea
                if alin == 'r':
                    c.drawRightString(x + ancho - 2.5 * mm, base, texto)
                else:
                    c.drawString(x + 2.5 * mm, base, texto)
        self.y -= alto

    def banda_grupo(self, izquierda, derecha):
        c = self.c
        alto = 8 * mm
        self._asegurar(alto + 14 * mm, repetir_tabla=False)
        c.setFillColor(BANDA_GRUPO)
        c.rect(MX, self.y - alto, ANCHO_UTIL, alto, fill=1, stroke=0)
        base = self.y - alto + 2.8 * mm
        c.setFillColor(AZUL)
        c.setFont('Helvetica-Bold', 10)
        c.drawString(MX + 2.5 * mm, base, izquierda)
        c.setFillColor(GRIS)
        c.setFont('Helvetica', 8.5)
        c.drawRightString(MX + ANCHO_UTIL - 2.5 * mm, base, derecha)
        self.y -= alto

    def fila_subtotal(self, etiqueta, monto):
        c = self.c
        alto = 7.5 * mm
        self._asegurar(alto)
        c.setStrokeColor(AZUL)
        c.setLineWidth(0.8)
        c.line(MX, self.y, MX + ANCHO_UTIL, self.y)
        base = self.y - alto + 2.6 * mm
        c.setFillColor(TINTA)
        c.setFont('Helvetica-Bold', 9)
        c.drawRightString(MX + ANCHO_UTIL - 32 * mm, base, etiqueta)
        c.drawRightString(MX + ANCHO_UTIL - 2.5 * mm, base, _pesos(monto))
        self.y -= alto + 4 * mm

    # -- cierre: totales, observaciones y firma van siempre juntos
    def cierre(self, lineas, total, notas, nombre_tesorero):
        alto_total = len(lineas) * 6 * mm + 26 * mm
        alto_resto = len(notas) * 4.8 * mm + 40 * mm
        self._asegurar(alto_total + alto_resto)
        self.totales(lineas, total)
        self.observaciones_y_firma(notas, nombre_tesorero)

    def totales(self, lineas, total):
        """lineas: [(etiqueta, valor)] y el total en un recuadro guinda."""
        c = self.c
        self.y -= 9 * mm
        ancho = 80 * mm
        x = ANCHO - MX - ancho
        c.setFont('Helvetica', 9.5)
        for etiqueta, valor in lineas:
            c.setFillColor(TINTA)
            c.drawString(x + 3 * mm, self.y, etiqueta)
            c.drawRightString(ANCHO - MX - 3 * mm, self.y, valor)
            self.y -= 6 * mm
        alto = 10 * mm
        c.setFillColor(GUINDA)
        c.roundRect(x, self.y - alto + 3.5 * mm, ancho, alto, 1.5 * mm, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont('Helvetica-Bold', 11)
        c.drawString(x + 3 * mm, self.y - alto + 7 * mm, self.etiqueta_total)
        c.drawRightString(ANCHO - MX - 3 * mm, self.y - alto + 7 * mm, _pesos(total))
        self.y -= alto + 8 * mm

    def observaciones_y_firma(self, notas, nombre_tesorero):
        c = self.c
        c.setFillColor(GUINDA)
        c.setFont('Helvetica-Bold', 8)
        c.drawString(MX, self.y, 'OBSERVACIONES')
        self.y -= 5.5 * mm
        c.setFillColor(GRIS)
        c.setFont('Helvetica', 8.5)
        for nota in notas:
            c.drawString(MX, self.y, f"•  {nota}")
            self.y -= 4.8 * mm

        self.y -= 20 * mm
        ancho_firma = 62 * mm
        x_centro = ANCHO - MX - ancho_firma / 2
        c.setStrokeColor(TINTA)
        c.setLineWidth(0.6)
        c.line(x_centro - ancho_firma / 2, self.y, x_centro + ancho_firma / 2, self.y)
        self.y -= 4.5 * mm
        if nombre_tesorero:
            c.setFillColor(TINTA)
            c.setFont('Helvetica-Bold', 9)
            c.drawCentredString(x_centro, self.y, nombre_tesorero)
            self.y -= 4.5 * mm
        c.setFillColor(GRIS)
        c.setFont('Helvetica', 8.5)
        c.drawCentredString(x_centro, self.y, 'Tesorero(a) de Compañía')

    def terminar(self):
        self.c.showPage()
        self.c.save()
        self.buffer.seek(0)
        return self.buffer


# ------------------------------------------------------------- generadores

def generar_pdf_nomina_deudores_cuotas(deudores, anio, logo_base64=None, fecha_corte=None):
    """
    deudores: lista de dicts de calcular_deudores_cuotas()
      {'voluntario', 'monto', 'meses_pendientes': [{'mes', 'anio', 'monto'}], 'precio_cuota'}
    """
    fecha_corte = fecha_corte or date.today()
    filas = sorted(deudores, key=lambda d: _orden_antiguedad(d['voluntario']))
    total = sum(Decimal(str(d['monto'])) for d in filas)
    precios = {Decimal(str(d.get('precio_cuota') or 0)) for d in filas if d.get('precio_cuota')}

    doc = _Nomina('NÓMINA DE DEUDORES', f"Cuotas sociales · Ciclo {anio}",
                  f"Nómina de deudores · cuotas {anio}", _logo_desde_base64(logo_base64))
    doc.encabezado(fecha_corte)
    tesorero = _tesorero_vigente()
    doc.bloque_datos(
        ('EMITIDO POR', [('Tesorería de Compañía', True),
                         (f"Tesorero(a): {tesorero}" if tesorero else 'Tesorero(a) de Compañía', False),
                         ('Chorrillos 1339, Puerto Montt', False)]),
        ('RESUMEN', [(f"{len(filas)} voluntarios con cuotas pendientes", True),
                     (f"Total adeudado: {_pesos(total)}", False),
                     (f"Ciclo de cuotas {anio}", False)]),
    )

    doc.titulo_seccion('Detalle de la deuda')
    doc.definir_columnas([('N°', 30, 'l'), ('Clave', 48, 'l'), ('Voluntario', 199, 'l'),
                          ('Meses pendientes', 136, 'l'), ('Deuda', ANCHO_UTIL - 413, 'r')])
    doc.encabezado_tabla()
    for i, d in enumerate(filas):
        v = d['voluntario']
        doc.fila([i + 1, v.clave_bombero or '—', v.nombre_completo(),
                  _rango_meses(m['mes'] for m in d['meses_pendientes']), _pesos(d['monto'])],
                 i, negritas=(4,))

    lineas = [('Voluntarios con deuda', str(len(filas)))]
    if len(precios) == 1:
        lineas.append(('Valor de la cuota mensual', _pesos(precios.pop())))
    doc.cierre(lineas, total, [
        'Valores en pesos chilenos (CLP).',
        f"Deuda calculada al {_fecha_larga(fecha_corte)}; los pagos posteriores no aparecen en esta nómina.",
        'Para regularizar tu situación, acércate a Tesorería o usa el Portal del Voluntario.',
    ], tesorero)
    return doc.terminar()


def generar_pdf_nomina_deudores_beneficios(deudas, logo_base64=None, fecha_corte=None):
    """
    deudas: lista de calcular_deudas_beneficios_y_rifas() (beneficios y rifas).
    Agrupa por beneficio o rifa con subtotal; la columna "Debe" dice lo que falta
    pagar en la unidad de cada uno (tarjetas, cartones, talonarios o números) y
    al final se resume a quienes deben más de una cosa.
    """
    fecha_corte = fecha_corte or date.today()
    deudas = list(deudas)
    total = sum(d['monto_pendiente'] for d in deudas)
    hay_rifas = any(d['tipo'] == 'rifa' for d in deudas)

    grupos = OrderedDict()
    for d in sorted(deudas, key=lambda d: (d['grupo_fecha'], d['grupo_nombre'].lower())):
        grupos.setdefault(d['grupo'], []).append(d)

    por_voluntario = OrderedDict()
    for d in deudas:
        por_voluntario.setdefault(d['voluntario'], []).append(d)
    multiples = sorted(((v, lista) for v, lista in por_voluntario.items() if len(lista) > 1),
                       key=lambda par: _orden_clave(par[0].clave_bombero))

    que = 'beneficios y rifas' if hay_rifas else 'beneficios'
    doc = _Nomina('NÓMINA DE DEUDORES', f"{que.capitalize()} pendientes",
                  f"Nómina de deudores · {que}", _logo_desde_base64(logo_base64))
    doc.encabezado(fecha_corte)
    tesorero = _tesorero_vigente()
    cantidad_grupos = f"{len(grupos)} {('beneficio o rifa' if hay_rifas else 'beneficio') if len(grupos) == 1 else que} con deuda"
    doc.bloque_datos(
        ('EMITIDO POR', [('Tesorería de Compañía', True),
                         (f"Tesorero(a): {tesorero}" if tesorero else 'Tesorero(a) de Compañía', False),
                         ('Chorrillos 1339, Puerto Montt', False)]),
        ('RESUMEN', [(f"{len(por_voluntario)} voluntarios con deudas pendientes", True),
                     (cantidad_grupos, False),
                     (f"Total adeudado: {_pesos(total)}", False)]),
    )

    doc.titulo_seccion(f"Detalle por {'beneficio y rifa' if hay_rifas else 'beneficio'}")
    doc.definir_columnas([('N°', 30, 'l'), ('Clave', 48, 'l'), ('Voluntario', 219, 'l'),
                          ('Debe', 116, 'l'), ('Monto', ANCHO_UTIL - 413, 'r')])
    for lista in grupos.values():
        lista.sort(key=lambda d: _orden_antiguedad(d['voluntario']))
        primero = lista[0]
        partes = []
        if primero['grupo_fecha']:
            partes.append(primero['grupo_fecha'].strftime('%d-%m-%Y'))
        if primero['precio_unitario']:
            partes.append(f"{_pesos(primero['precio_unitario'])} por {primero['unidad']}")
        if primero['detalle_precio']:
            partes.append(primero['detalle_precio'])
        partes.append(f"{len(lista)} {'voluntario' if len(lista) == 1 else 'voluntarios'}")
        nombre = primero['grupo_nombre']
        doc.banda_grupo(nombre[:1].upper() + nombre[1:], ' · '.join(partes))
        doc.encabezado_tabla()
        for i, d in enumerate(lista):
            v = d['voluntario']
            doc.fila([i + 1, v.clave_bombero or '—', v.nombre_completo(), d['debe'],
                      _pesos(d['monto_pendiente'])], i, negritas=(4,))
        doc.fila_subtotal(f"Subtotal {nombre.lower()}", sum(d['monto_pendiente'] for d in lista))

    if multiples:
        doc.titulo_seccion('Voluntarios con más de una deuda pendiente')
        doc.definir_columnas([('N°', 30, 'l'), ('Clave', 48, 'l'), ('Voluntario', 165, 'l'),
                              ('Debe', 170, 'l'), ('Total', ANCHO_UTIL - 413, 'r')])
        doc.encabezado_tabla()
        for i, (v, lista) in enumerate(multiples):
            detalle = '; '.join(f"{d['debe']} de {d['grupo_nombre'].lower()}"
                                for d in sorted(lista, key=lambda d: d['grupo_fecha']))
            doc.fila([i + 1, v.clave_bombero or '—', v.nombre_completo(), detalle,
                      _pesos(sum(d['monto_pendiente'] for d in lista))],
                     i, negritas=(4,), envolver=(3,))

    doc.cierre([('Voluntarios con deuda', str(len(por_voluntario))),
                (f"{que.capitalize()} con deuda", str(len(grupos)))], total, [
        'Valores en pesos chilenos (CLP). «Debe» indica lo asignado que falta pagar.',
        f"Deuda calculada al {_fecha_larga(fecha_corte)}; los pagos posteriores no aparecen en esta nómina.",
        'Para regularizar tu situación, acércate a Tesorería o usa el Portal del Voluntario.',
    ], tesorero)
    return doc.terminar()


def generar_pdf_estado_deuda_voluntario(voluntario, deuda_cuotas, deudas_otras, anio,
                                        logo_base64=None, fecha_corte=None, aniversario=()):
    """
    Estado de deuda de un voluntario: cuotas del ciclo y beneficios/rifas.
    deuda_cuotas: resultado de calcular_deuda_cuotas(); deudas_otras: items de
    calcular_deudas_beneficios_y_rifas() de este voluntario.
    """
    fecha_corte = fecha_corte or date.today()
    meses = [m['mes'] for m in deuda_cuotas.get('meses_pendientes', [])]
    # aniversario: [(anio, monto)] de cuotas de aniversario sin pagar
    total_aniversario = sum((Decimal(str(m)) for _, m in aniversario), Decimal('0'))
    total_cuotas = Decimal(str(deuda_cuotas.get('monto') or 0)) + total_aniversario
    total_otras = sum((d['monto_pendiente'] for d in deudas_otras), Decimal('0'))
    total = total_cuotas + total_otras

    doc = _Nomina('ESTADO DE DEUDA', voluntario.nombre_completo(),
                  f"Estado de deuda · {voluntario.clave_bombero or ''}", _logo_desde_base64(logo_base64))
    doc.encabezado(fecha_corte)
    doc.bloque_datos(
        ('VOLUNTARIO', [(voluntario.nombre_completo(), True),
                        (f"Clave {voluntario.clave_bombero or '—'} · RUN {voluntario.rut or '—'}", False),
                        (f"Compañía: {voluntario.compania or 'Sexta'}", False)]),
        ('RESUMEN', [(f"Total adeudado: {_pesos(total)}", True),
                     (f"Cuotas {anio}: {_pesos(total_cuotas)}" + (f" ({_rango_meses(meses)})" if meses else ''), False),
                     (f"Beneficios y rifas: {_pesos(total_otras)}", False)]),
    )

    doc.titulo_seccion(f"Cuotas sociales {anio}" + (' y aniversario' if aniversario else ''))
    doc.definir_columnas([('N°', 30, 'l'), ('Cuota', 300, 'l'), ('Monto', ANCHO_UTIL - 330, 'r')])
    doc.encabezado_tabla()
    if meses or aniversario:
        filas_cuotas = [f"{MESES[m['mes'] - 1].capitalize()} {m.get('anio', anio)}"
                        for m in deuda_cuotas.get('meses_pendientes', [])]
        montos = [m['monto'] for m in deuda_cuotas.get('meses_pendientes', [])]
        filas_cuotas += [f"Cuota de aniversario {a}" for a, _ in aniversario]
        montos += [m for _, m in aniversario]
        for i, (texto, monto) in enumerate(zip(filas_cuotas, montos, strict=True)):
            doc.fila([i + 1, texto, _pesos(monto)], i, negritas=(2,))
        doc.fila_subtotal('Subtotal cuotas', total_cuotas)
    else:
        doc.fila(['', 'Sin cuotas pendientes', ''], 0)
        doc.y -= 4 * mm

    doc.titulo_seccion('Beneficios y rifas')
    doc.definir_columnas([('N°', 30, 'l'), ('Beneficio o rifa', 230, 'l'), ('Debe', 120, 'l'),
                          ('Monto', ANCHO_UTIL - 380, 'r')])
    doc.encabezado_tabla()
    if deudas_otras:
        for i, d in enumerate(sorted(deudas_otras, key=lambda d: d['grupo_fecha'])):
            nombre = d['grupo_nombre']
            doc.fila([i + 1, nombre[:1].upper() + nombre[1:], d['debe'], _pesos(d['monto_pendiente'])],
                     i, negritas=(3,))
        doc.fila_subtotal('Subtotal beneficios y rifas', total_otras)
    else:
        doc.fila(['', 'Sin beneficios ni rifas pendientes', '', ''], 0)
        doc.y -= 4 * mm

    doc.cierre([('Cuotas sociales', _pesos(total_cuotas)), ('Beneficios y rifas', _pesos(total_otras))], total, [
        'Valores en pesos chilenos (CLP).',
        f"Deuda calculada al {_fecha_larga(fecha_corte)}; los pagos posteriores no aparecen en este documento.",
        'Para regularizar tu situación, acércate a Tesorería o usa el Portal del Voluntario.',
    ], _tesorero_vigente())
    return doc.terminar()


def generar_pdf_cuotas_voluntario(voluntario, anio, pagos_dict, deuda_cuotas, precio_cuota,
                                  exento=False, motivo_exencion='', logo_base64=None, fecha_corte=None):
    """
    Estado anual de cuotas sociales de un voluntario: los 12 meses con su estado.
    pagos_dict: {mes: {'monto_pagado', 'fecha_pago', 'metodo_pago'}};
    deuda_cuotas: resultado de calcular_deuda_cuotas().
    """
    fecha_corte = fecha_corte or date.today()
    vencidos = {m['mes'] for m in deuda_cuotas.get('meses_pendientes', [])}
    total_deuda = Decimal(str(deuda_cuotas.get('monto') or 0))
    total_pagado = sum((Decimal(str(p['monto_pagado'] or 0)) for p in pagos_dict.values()), Decimal('0'))
    verde, rojo = Color(30 / 255, 125 / 255, 69 / 255), GUINDA

    doc = _Nomina('CUOTAS SOCIALES', voluntario.nombre_completo(),
                  f"Cuotas {anio} · {voluntario.clave_bombero or ''}", _logo_desde_base64(logo_base64))
    doc.encabezado(fecha_corte)
    if exento:
        resumen = [('Exento de cuota social', True), (motivo_exencion or 'Sin motivo registrado', False)]
    else:
        resumen = [(f"Deuda vencida: {_pesos(total_deuda)}", True),
                   (f"Pagado {anio}: {_pesos(total_pagado)} ({len(pagos_dict)} de 12 meses)", False),
                   (f"Valor cuota mensual: {_pesos(precio_cuota)}", False)]
    doc.bloque_datos(
        ('VOLUNTARIO', [(voluntario.nombre_completo(), True),
                        (f"Clave {voluntario.clave_bombero or '—'} · RUN {voluntario.rut or '—'}", False),
                        (f"Compañía: {voluntario.compania or 'Sexta'}", False)]),
        ('RESUMEN', resumen),
    )

    doc.titulo_seccion(f"Detalle mensual {anio}")
    doc.definir_columnas([('N°', 30, 'l'), ('Mes', 110, 'l'), ('Estado', 100, 'l'),
                          ('Fecha de pago', 100, 'l'), ('Forma de pago', 90, 'l'), ('Monto', ANCHO_UTIL - 430, 'r')])
    doc.encabezado_tabla()
    for mes in range(1, 13):
        pago = pagos_dict.get(mes)
        if pago:
            fecha = pago['fecha_pago']
            fila = ['Pagado', fecha.strftime('%d-%m-%Y') if fecha else '—',
                    (pago['metodo_pago'] or '—').capitalize(), _pesos(pago['monto_pagado'])]
            color = verde
        elif exento:
            fila, color = ['Exento', '—', '—', '—'], GRIS
        elif mes in vencidos:
            fila, color = ['Pendiente', '—', '—', _pesos(precio_cuota)], rojo
        else:
            fila, color = ['Por vencer', '—', '—', _pesos(precio_cuota)], GRIS
        doc.fila([mes, MESES[mes - 1].capitalize(), *fila], mes - 1, negritas=(2,), colores={2: color})

    lineas = [('Pagado en el año', _pesos(total_pagado))]
    if not exento:
        lineas.append((f"Meses vencidos sin pagar ({len(vencidos)})", _pesos(total_deuda)))
    doc.cierre(lineas, total_deuda, [
        'Valores en CLP. Pendiente: mes vencido sin pago. Por vencer: mes que aún no corresponde.',
        f"Estado calculado al {_fecha_larga(fecha_corte)}; los pagos posteriores no aparecen aquí.",
    ], _tesorero_vigente())
    return doc.terminar()


def generar_pdf_nomina_deudores_aniversario(cuota, deudores, logo_base64=None, fecha_corte=None):
    """deudores: lista de calcular_deudores_aniversario() -> [{'voluntario', 'monto'}]."""
    fecha_corte = fecha_corte or date.today()
    filas = sorted(deudores, key=lambda d: _orden_antiguedad(d['voluntario']))
    total = sum((Decimal(str(d['monto'])) for d in filas), Decimal('0'))
    pagados = cuota.pagos.count()

    doc = _Nomina('NÓMINA DE DEUDORES', f"Cuota de aniversario {cuota.anio}",
                  f"Deudores · cuota de aniversario {cuota.anio}", _logo_desde_base64(logo_base64))
    doc.encabezado(fecha_corte)
    tesorero = _tesorero_vigente()
    origen = cuota.acta or (f"Asamblea del {_fecha_larga(cuota.fecha_asamblea)}" if cuota.fecha_asamblea else 'Acordada en asamblea')
    doc.bloque_datos(
        ('CUOTA', [(f"{_pesos(cuota.monto)} por voluntario · pago único", True),
                   (origen, False),
                   (f"{pagados} voluntario ya pagó" if pagados == 1 else f"{pagados} voluntarios ya pagaron", False)]),
        ('RESUMEN', [(f"{len(filas)} voluntarios con la cuota pendiente", True),
                     (f"Total adeudado: {_pesos(total)}", False),
                     (f"Año {cuota.anio}", False)]),
    )

    doc.titulo_seccion('Detalle de la deuda')
    doc.definir_columnas([('N°', 30, 'l'), ('Clave', 48, 'l'), ('Voluntario', 270, 'l'),
                          ('Deuda', ANCHO_UTIL - 348, 'r')])
    doc.encabezado_tabla()
    if filas:
        for i, d in enumerate(filas):
            v = d['voluntario']
            doc.fila([i + 1, v.clave_bombero or '—', v.nombre_completo(), _pesos(d['monto'])], i, negritas=(3,))
    else:
        doc.fila(['', '', 'Todos pagaron la cuota de aniversario', ''], 0)
        doc.y -= 4 * mm

    doc.cierre([('Voluntarios con deuda', str(len(filas))), ('Valor de la cuota', _pesos(cuota.monto))], total, [
        'Valores en pesos chilenos (CLP). La cuota de aniversario se paga una sola vez en el año.',
        f"Deuda calculada al {_fecha_larga(fecha_corte)}; los pagos posteriores no aparecen en esta nómina.",
    ], tesorero)
    return doc.terminar()
