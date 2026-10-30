"""
Utilidades para envío de emails
Sistema de comprobantes automáticos por email
"""
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
import logging
from io import BytesIO
from xhtml2pdf import pisa

logger = logging.getLogger(__name__)

# Diccionario de meses en español
MESES = {
    1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
    5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
    9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}


def generar_pdf_comprobante(html_content):
    """
    Genera un PDF a partir de contenido HTML
    
    Args:
        html_content: String con el contenido HTML
    
    Returns:
        BytesIO: Buffer con el PDF generado, o None si hay error
    """
    try:
        print('[PDF] Generando PDF del comprobante...')
        result = BytesIO()
        
        # Convertir HTML a PDF
        pdf = pisa.pisaDocument(BytesIO(html_content.encode("UTF-8")), result)
        
        if pdf.err:
            print(f'[PDF] Error al generar PDF: {pdf.err}')
            return None
        
        print('[PDF] PDF generado exitosamente')
        result.seek(0)
        return result
        
    except Exception as e:
        print(f'[PDF] Error al generar PDF: {str(e)}')
        return None


def enviar_comprobante_cuota(pago, voluntario):
    """Comprobante de una cuota social (formato institucional)."""
    from .comprobantes import concepto_cuota, enviar_comprobante_pagos, folio
    return enviar_comprobante_pagos(voluntario, [concepto_cuota(pago)], folio('CS', pago.id))


def enviar_comprobante_beneficio(pago_beneficio, voluntario, beneficio):
    """Comprobante de un pago de beneficio (formato institucional)."""
    from .comprobantes import concepto_beneficio, enviar_comprobante_pagos, folio
    return enviar_comprobante_pagos(voluntario, [concepto_beneficio(pago_beneficio)], folio('BE', pago_beneficio.id))


def enviar_comprobante_rifa(pago_rifa, voluntario, rifa):
    """Comprobante de un pago de rifa (formato institucional)."""
    from .comprobantes import concepto_rifa, enviar_comprobante_pagos, folio
    return enviar_comprobante_pagos(voluntario, [concepto_rifa(pago_rifa)], folio('RI', pago_rifa.id))


def enviar_comprobante_grupo(grupo, voluntario):
    """Un solo comprobante con todo lo pagado en un carrito del portal."""
    from .comprobantes import (concepto_aniversario, concepto_beneficio, concepto_cuota, concepto_rifa,
                               enviar_comprobante_pagos, folio)
    conceptos = []
    for item in grupo.items.order_by('id'):
        if item.pago_cuota_id:
            conceptos.append(concepto_cuota(item.pago_cuota))
        elif item.pago_beneficio_id:
            conceptos.append(concepto_beneficio(item.pago_beneficio))
        elif item.pago_rifa_id:
            conceptos.append(concepto_rifa(item.pago_rifa))
        elif item.pago_cuota_aniversario_id:
            conceptos.append(concepto_aniversario(item.pago_cuota_aniversario))
    if not conceptos:
        return False
    return enviar_comprobante_pagos(voluntario, conceptos, folio('PO', grupo.id))


def enviar_comprobante_aniversario(pago, voluntario):
    """Comprobante de la cuota de aniversario (formato institucional)."""
    from .comprobantes import concepto_aniversario, enviar_comprobante_pagos, folio
    return enviar_comprobante_pagos(voluntario, [concepto_aniversario(pago)], folio('AN', pago.id))


def enviar_notificacion_rechazo(voluntario, motivo, concepto):
    """
    Envía un email notificando que una solicitud de pago (simple o grupo) fue rechazada.

    Args:
        voluntario: objeto Voluntario
        motivo: texto escrito por el tesorero (feedback_tesorero)
        concepto: descripcion corta de lo que se rechazo (ej. "Cuota 03/2026" o "Grupo #12")
    """
    try:
        if not voluntario.email:
            logger.warning(f'Voluntario {voluntario.clave_bombero} no tiene email configurado')
            return False

        subject = f'Solicitud de pago rechazada - {concepto}'
        text_content = f"""
        SOLICITUD DE PAGO RECHAZADA
        Bomberos

        Estimado/a {voluntario.nombre} {voluntario.apellido_paterno},

        Tu solicitud de pago "{concepto}" fue rechazada por el tesorero.

        Motivo: {motivo}

        Ingresa al portal de voluntarios para revisar el detalle y volver a enviar tu solicitud
        con la informacion corregida.

        Sistema de Gestión de Bomberos - Proyecto SEIS
        """
        html_content = f"""
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"></head>
        <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <div style="background:#7f1d1d;color:white;padding:20px;border-radius:8px 8px 0 0">
                <h2 style="margin:0">Solicitud de Pago Rechazada</h2>
            </div>
            <div style="background:white;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
                <p>Estimado/a <strong>{voluntario.nombre} {voluntario.apellido_paterno}</strong>,</p>
                <p>Tu solicitud de pago <strong>{concepto}</strong> fue rechazada por el tesorero.</p>
                <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0">
                    <div style="font-size:0.8rem;color:#7f1d1d;text-transform:uppercase">Motivo</div>
                    <div style="font-size:1rem;color:#333;margin-top:4px">{motivo}</div>
                </div>
                <p>Ingresa al portal de voluntarios para revisar el detalle y volver a enviar tu solicitud.</p>
                <p style="font-size:0.8rem;color:#9ca3af;margin-top:20px">Sistema de Gestión de Bomberos - Proyecto SEIS</p>
            </div>
        </body></html>
        """

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[voluntario.email],
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        logger.info(f'Notificacion de rechazo enviada a {voluntario.email}')
        return True
    except Exception as e:
        logger.error(f'Error al enviar notificacion de rechazo: {str(e)}')
        return False


def enviar_acta_por_email(evento, destinatarios, es_prueba=False):
    """
    Envía por correo el PDF del acta (Asamblea o Directorio) de un
    EventoAsistencia a una lista de direcciones, en tandas por BCC para no
    exponer los correos entre sí y no saturar el proveedor SMTP en un solo
    mensaje.

    Args:
        evento: instancia de EventoAsistencia (tipo 'asamblea' o 'directorio')
        destinatarios: lista de direcciones de correo (strings)
        es_prueba: si True, se marca el asunto como envío de prueba

    Returns:
        dict: {'enviados': int, 'errores': list[str]}
    """
    from django.core.mail import get_connection
    from .pdf_directorio import (
        generar_pdf_acta_directorio, generar_pdf_acta_asamblea,
        _calcular_numero_acta_fallback,
    )

    destinatarios = [d for d in dict.fromkeys(destinatarios) if d]  # únicos, sin vacíos
    if not destinatarios:
        return {'enviados': 0, 'errores': ['No hay destinatarios con correo registrado']}

    if evento.tipo == 'directorio':
        pdf_buffer = generar_pdf_acta_directorio(evento)
        etiqueta = 'Acta de Directorio de Compañía'
    elif evento.tipo == 'asamblea':
        pdf_buffer = generar_pdf_acta_asamblea(evento)
        etiqueta = 'Acta de Asamblea de Compañía'
    else:
        return {'enviados': 0, 'errores': [f'Tipo de evento no soportado: {evento.tipo}']}

    numero_acta = (evento.numero_acta or _calcular_numero_acta_fallback(evento))
    pdf_bytes = pdf_buffer.getvalue()
    filename = f"{etiqueta.replace(' de ', '_').replace(' ', '_')}_{numero_acta.replace('/', '-')}.pdf"

    fecha_texto = evento.fecha.strftime('%d/%m/%Y')
    prefijo_prueba = '[PRUEBA] ' if es_prueba else ''
    subject = f"{prefijo_prueba}{etiqueta} N° {numero_acta} - {fecha_texto}"
    text_content = (
        f"Estimado/a voluntario/a,\n\n"
        f"Se adjunta el {etiqueta.lower()} N° {numero_acta}, correspondiente a la sesión "
        f"del {fecha_texto}.\n\n"
        f"Sexta Compañía de Bomberos Puerto Montt\n"
        f'"Abnegación y Constancia"'
    )
    html_content = f"""
    <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#0f2346;color:white;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">{etiqueta} N° {numero_acta}</h2>
        </div>
        <div style="background:white;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <p>Estimado/a voluntario/a,</p>
            <p>Se adjunta el {etiqueta.lower()} correspondiente a la sesión del <strong>{fecha_texto}</strong>.</p>
            <p style="font-size:0.85rem;color:#9ca3af;margin-top:20px">
                Sexta Compañía de Bomberos Puerto Montt — "Abnegación y Constancia"
            </p>
        </div>
    </body></html>
    """

    TAMANO_TANDA = 40
    tandas = [destinatarios[i:i + TAMANO_TANDA] for i in range(0, len(destinatarios), TAMANO_TANDA)]

    enviados = 0
    errores = []
    try:
        with get_connection() as connection:
            for tanda in tandas:
                try:
                    msg = EmailMultiAlternatives(
                        subject=subject,
                        body=text_content,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        to=[settings.DEFAULT_FROM_EMAIL],
                        bcc=tanda,
                        connection=connection,
                    )
                    msg.attach_alternative(html_content, "text/html")
                    msg.attach(filename, pdf_bytes, 'application/pdf')
                    msg.send(fail_silently=False)
                    enviados += len(tanda)
                except Exception as e:
                    logger.error(f'Error enviando tanda de acta a {tanda}: {str(e)}')
                    errores.append(str(e))
    except Exception as e:
        logger.error(f'Error abriendo conexión SMTP para envío de acta: {str(e)}')
        errores.append(str(e))

    return {'enviados': enviados, 'errores': errores}
