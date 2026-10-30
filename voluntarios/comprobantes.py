"""
Comprobantes de pago para el voluntario, en el mismo formato institucional que las nóminas.

Tres tipos:
  1. Pago único (una cuota, un beneficio, una rifa o la cuota de aniversario).
  2. Varias cuotas pagadas juntas, o un carrito del portal: un solo comprobante con el detalle.
  3. Comprobante anual: todo lo que el voluntario pagó en el año.
"""
import logging
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import escape
from reportlab.lib.units import mm

from .models import LogoCompania, PagoBeneficio, PagoCuota, PagoCuotaAniversario, PagoRifa
from .pdf_nominas import (ANCHO_UTIL, MESES, _fecha_larga, _logo_desde_base64, _Nomina, _pesos,
                          _tesorero_vigente)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------- conceptos

def _metodo(pago, con_cuenta=True):
    metodo = (pago.metodo_pago or '').strip()
    if not con_cuenta:
        return metodo.capitalize() or ('Transferencia' if pago.cuenta_bancaria_id else 'Efectivo')
    if pago.cuenta_bancaria_id:
        return f"{metodo.capitalize() or 'Transferencia'} · {pago.cuenta_bancaria.nombre}"
    return metodo.capitalize() or 'Efectivo'


def concepto_cuota(p):
    return {'fecha': p.fecha_pago, 'concepto': f"Cuota social {MESES[p.mes - 1]} {p.anio}",
            'detalle': '', 'monto': p.monto_pagado, 'pago': p, 'orden': (p.anio, p.mes), 'tipo': 'Cuotas sociales'}


def concepto_beneficio(p):
    b = p.asignacion.beneficio
    unidades = f"{p.cantidad_tarjetas} tarjeta{'s' if p.cantidad_tarjetas != 1 else ''}"
    return {'fecha': p.fecha_pago, 'concepto': b.nombre[:1].upper() + b.nombre[1:],
            'detalle': f"{unidades}{' extra' if p.tipo_pago == 'extra' else ''}", 'monto': p.monto, 'pago': p,
            'tipo': 'Beneficios'}


def concepto_rifa(p):
    nombre = p.asignacion.rifa.nombre
    return {'fecha': p.fecha_pago, 'concepto': nombre if nombre.lower().startswith('rifa') else f"Rifa {nombre}",
            'detalle': '',
            'monto': p.monto, 'pago': p, 'tipo': 'Rifas'}


def concepto_aniversario(p):
    return {'fecha': p.fecha_pago, 'concepto': f"Cuota de aniversario {p.cuota.anio}", 'detalle': 'Pago único',
            'monto': p.monto_pagado, 'pago': p, 'tipo': 'Cuota de aniversario'}


# ---------------------------------------------------------------- PDF

def _logo():
    logo = LogoCompania.objects.filter(usar_en_pdfs=True).first()
    return _logo_desde_base64(logo.imagen) if logo else None


def _bloque_voluntario(voluntario):
    return ('VOLUNTARIO', [(voluntario.nombre_completo(), True),
                           (f"Clave {voluntario.clave_bombero or '—'} · RUN {voluntario.rut or '—'}", False),
                           (f"Compañía: {voluntario.compania or 'Sexta'}", False)])


def generar_pdf_comprobante(voluntario, conceptos, folio, fecha_emision=None):
    """Comprobante de un pago o de varios pagados juntos (tipos 1 y 2)."""
    fecha_emision = fecha_emision or date.today()
    total = sum((Decimal(str(c['monto'])) for c in conceptos), Decimal('0'))
    pago = conceptos[0]['pago']
    fechas = sorted({c['fecha'] for c in conceptos})

    doc = _Nomina('COMPROBANTE', f"Pago N° {folio}", f"Comprobante {folio}", _logo())
    doc.etiqueta_fecha = 'Emitido el'
    doc.etiqueta_total = 'TOTAL PAGADO'
    doc.encabezado(fecha_emision)
    datos_pago = [(f"Fecha de pago: {_fecha_larga(fechas[0])}" if len(fechas) == 1
                   else f"Fechas de pago: {_fecha_larga(fechas[0])} al {_fecha_larga(fechas[-1])}", True),
                  (f"Forma de pago: {_metodo(pago)}", False)]
    if getattr(pago, 'numero_comprobante', None):
        datos_pago.append((f"N° de transferencia: {pago.numero_comprobante}", False))
    doc.bloque_datos(_bloque_voluntario(voluntario), ('PAGO', datos_pago))

    doc.titulo_seccion('Detalle del pago')
    con_detalle = any(c['detalle'] for c in conceptos)
    if con_detalle:
        doc.definir_columnas([('N°', 30, 'l'), ('Concepto', 250, 'l'), ('Detalle', 110, 'l'),
                              ('Monto', ANCHO_UTIL - 390, 'r')])
    else:
        doc.definir_columnas([('N°', 30, 'l'), ('Concepto', 360, 'l'), ('Monto', ANCHO_UTIL - 390, 'r')])
    doc.encabezado_tabla()
    for i, c in enumerate(conceptos):
        fila = [i + 1, c['concepto'], c['detalle'], _pesos(c['monto'])] if con_detalle             else [i + 1, c['concepto'], _pesos(c['monto'])]
        doc.fila(fila, i, negritas=(len(fila) - 1,))

    doc.cierre([('Conceptos pagados', str(len(conceptos)))], total, [
        'Valores en pesos chilenos (CLP).',
        'Este comprobante acredita el pago registrado por Tesorería de Compañía.',
    ], _tesorero_vigente())
    return doc.terminar()


# Todos los tipos de pago de un voluntario. Para sumar uno nuevo al comprobante anual basta
# agregar aquí su consulta y su concepto_*; y en el lugar donde se registra ese pago, llamar a
# enviar_comprobante_pagos(voluntario, [concepto_nuevo(pago)], folio('XX', pago.id)).
TIPOS_DE_PAGO = [
    (lambda v, anio: PagoCuota.objects.filter(voluntario=v, anio=anio).select_related('cuenta_bancaria'),
     concepto_cuota),
    (lambda v, anio: PagoCuotaAniversario.objects.filter(voluntario=v, cuota__anio=anio)
     .select_related('cuota', 'cuenta_bancaria'), concepto_aniversario),
    (lambda v, anio: PagoBeneficio.objects.filter(asignacion__voluntario=v, fecha_pago__year=anio)
     .select_related('asignacion__beneficio', 'cuenta_bancaria'), concepto_beneficio),
    (lambda v, anio: PagoRifa.objects.filter(asignacion__voluntario=v, fecha_pago__year=anio)
     .select_related('asignacion__rifa', 'cuenta_bancaria'), concepto_rifa),
]


def pagos_del_anio(voluntario, anio):
    """Todos los pagos del voluntario en el año, como conceptos ordenados por fecha."""
    conceptos = [concepto(p) for consulta, concepto in TIPOS_DE_PAGO for p in consulta(voluntario, anio)]
    return sorted(conceptos, key=lambda c: (c['fecha'], c.get('orden', (0, 0)), c['concepto']))


def generar_pdf_comprobante_anual(voluntario, anio, conceptos, fecha_emision=None):
    """Tipo 3: resumen de todo lo pagado en el año, agrupado por tipo."""
    fecha_emision = fecha_emision or date.today()
    total = sum((Decimal(str(c['monto'])) for c in conceptos), Decimal('0'))
    grupos = {}
    for c in conceptos:
        grupos.setdefault(c['tipo'], []).append(c)

    doc = _Nomina('COMPROBANTE ANUAL', f"Pagos {anio}", f"Comprobante anual {anio}", _logo())
    doc.etiqueta_fecha = 'Emitido el'
    doc.etiqueta_total = 'TOTAL PAGADO'
    doc.encabezado(fecha_emision)
    resumen = [(f"Total pagado en {anio}: {_pesos(total)}", True)]
    detalle = [f"{t}: {_pesos(sum((Decimal(str(c['monto'])) for c in cs), Decimal('0')))}" for t, cs in grupos.items()]
    # El bloque de resumen tiene espacio para dos líneas más: se juntan de a dos si hay muchos tipos
    resumen += [(' · '.join(detalle[i:i + 2]), False) for i in range(0, len(detalle), 2)][:2]
    doc.bloque_datos(_bloque_voluntario(voluntario), ('RESUMEN', resumen))

    doc.titulo_seccion(f"Pagos registrados en {anio}")
    doc.definir_columnas([('N°', 30, 'l'), ('Fecha', 62, 'l'), ('Concepto', 200, 'l'), ('Forma de pago', 120, 'l'),
                          ('Monto', ANCHO_UTIL - 412, 'r')])
    doc.encabezado_tabla()
    if conceptos:
        n = 0
        for tipo, cs in grupos.items():
            doc.banda_grupo(tipo, f"{len(cs)} pago{'s' if len(cs) != 1 else ''}")
            for c in cs:
                concepto = c['concepto'] + (f" · {c['detalle']}" if c['detalle'] and c['detalle'] != 'Pago único' else '')
                doc.fila([n + 1, c['fecha'].strftime('%d-%m-%Y'), concepto, _metodo(c['pago'], False), _pesos(c['monto'])],
                         n, negritas=(4,))
                n += 1
    else:
        doc.fila(['', '', f"Sin pagos registrados en {anio}", '', ''], 0)
        doc.y -= 4 * mm

    doc.cierre([('Pagos registrados', str(len(conceptos)))], total, [
                   'Valores en pesos chilenos (CLP).',
                   f"Incluye los pagos registrados hasta el {_fecha_larga(fecha_emision)}.",
               ], _tesorero_vigente())
    return doc.terminar()


# ---------------------------------------------------------------- correo

def _enviar(voluntario, asunto, intro, conceptos, total, adjunto, nombre_archivo):
    if not voluntario.email:
        logger.warning('Voluntario %s sin email: no se envía comprobante', voluntario.clave_bombero)
        return False
    filas = ''.join(
        f'<tr><td style="padding:6px 0;border-bottom:1px solid #eee">{escape(c["concepto"])}</td>'
        f'<td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">{_pesos(c["monto"])}</td></tr>'
        for c in conceptos[:15])
    if len(conceptos) > 15:
        filas += f'<tr><td colspan="2" style="padding:6px 0;color:#666">… y {len(conceptos) - 15} pagos más (ver PDF)</td></tr>'
    html = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#18202f">
      <div style="border-top:4px solid #6e1222;padding:20px 0 8px">
        <p style="margin:0;color:#6e1222;font-size:12px;font-weight:bold;letter-spacing:1px">SEXTA COMPAÑÍA DE BOMBEROS · PUERTO MONTT</p>
        <h2 style="margin:6px 0 0;font-size:20px">{escape(asunto)}</h2>
      </div>
      <p>Hola {escape(voluntario.nombre)},</p>
      <p>{intro}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">{filas}
        <tr><td style="padding:10px 0;font-weight:bold">Total</td>
            <td style="padding:10px 0;font-weight:bold;text-align:right">{_pesos(total)}</td></tr>
      </table>
      <p style="color:#555;font-size:13px">Adjuntamos el comprobante en PDF. Si ves algún error, responde este correo o habla con Tesorería.</p>
      <p style="color:#888;font-size:12px;margin-top:24px">Tesorería · Sexta Compañía de Bomberos de Puerto Montt</p>
    </div>"""
    texto = f"Hola {voluntario.nombre},\n\n{intro}\nTotal: {_pesos(total)}\n\nAdjuntamos el comprobante en PDF.\nTesorería · Sexta Compañía"
    try:
        msg = EmailMultiAlternatives(subject=asunto, body=texto, from_email=settings.DEFAULT_FROM_EMAIL,
                                     to=[voluntario.email])
        msg.attach_alternative(html, 'text/html')
        msg.attach(nombre_archivo, adjunto.getvalue(), 'application/pdf')
        msg.send(fail_silently=False)
        return True
    except Exception as e:
        logger.error('Error enviando comprobante a %s: %s', voluntario.email, e)
        return False


def enviar_comprobante_pagos(voluntario, conceptos, folio):
    """Tipos 1 y 2: un solo correo con un solo PDF para uno o varios pagos."""
    total = sum((Decimal(str(c['monto'])) for c in conceptos), Decimal('0'))
    asunto = (f"Comprobante de pago · {conceptos[0]['concepto']}" if len(conceptos) == 1
              else f"Comprobante de pago · {len(conceptos)} conceptos")
    pdf = generar_pdf_comprobante(voluntario, conceptos, folio)
    return _enviar(voluntario, asunto, 'Registramos tu pago. Este es el detalle:', conceptos, total, pdf,
                   f"Comprobante_{folio}_{voluntario.clave_bombero}.pdf")


def enviar_comprobante_anual(voluntario, anio):
    """Tipo 3: todo lo pagado en el año en un solo correo."""
    conceptos = pagos_del_anio(voluntario, anio)
    if not conceptos:
        raise ValueError(f'{voluntario.nombre_completo()} no tiene pagos registrados en {anio}.')
    total = sum((Decimal(str(c['monto'])) for c in conceptos), Decimal('0'))
    pdf = generar_pdf_comprobante_anual(voluntario, anio, conceptos)
    return _enviar(voluntario, f"Comprobante anual de pagos {anio}",
                   f"Este es el resumen de todos tus pagos registrados en {anio}:", conceptos, total, pdf,
                   f"Comprobante_anual_{anio}_{voluntario.clave_bombero}.pdf")


def folio(prefijo, pago_id):
    return f"{prefijo}-{pago_id:05d}"
