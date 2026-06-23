"""
Utilidades para envío de emails
Sistema de comprobantes automáticos por email
"""
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
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
            print(f'[PDF] ❌ Error al generar PDF: {pdf.err}')
            return None
        
        print('[PDF] ✅ PDF generado exitosamente')
        result.seek(0)
        return result
        
    except Exception as e:
        print(f'[PDF] ❌ Error al generar PDF: {str(e)}')
        return None


def enviar_comprobante_cuota(pago, voluntario):
    """
    Envía un comprobante de pago de cuota por email
    
    Args:
        pago: Objeto PagoCuota
        voluntario: Objeto Voluntario
    
    Returns:
        bool: True si se envió correctamente, False si hubo error
    """
    try:
        print('=' * 60)
        print('[EMAIL DEBUG] Iniciando envío de comprobante...')
        
        # Verificar que el voluntario tenga email
        if not voluntario.email:
            print(f'[EMAIL DEBUG] ❌ Voluntario {voluntario.clave_bombero} NO tiene email')
            logger.warning(f'Voluntario {voluntario.clave_bombero} no tiene email configurado')
            return False
        
        print(f'[EMAIL DEBUG] ✅ Email encontrado: {voluntario.email}')
        
        # Preparar contexto para el template
        context = {
            'pago': pago,
            'voluntario': voluntario,
            'mes_nombre': MESES.get(pago.mes, f'Mes {pago.mes}'),
        }
        print(f'[EMAIL DEBUG] Renderizando template HTML...')
        
        # Renderizar template HTML
        html_content = render_to_string('emails/comprobante_cuota.html', context)
        print(f'[EMAIL DEBUG] ✅ Template renderizado correctamente')
        
        # Crear texto plano alternativo (para clientes de email que no soporten HTML)
        # Formatear fecha correctamente
        if hasattr(pago.fecha_pago, 'strftime'):
            fecha_formateada = pago.fecha_pago.strftime('%d/%m/%Y')
        else:
            fecha_formateada = str(pago.fecha_pago)
        
        text_content = f"""
        COMPROBANTE DE PAGO - CUOTA SOCIAL
        Bomberos
        
        Comprobante N° {pago.id}
        
        Voluntario: {voluntario.nombre} {voluntario.apellido_paterno} {voluntario.apellido_materno}
        Clave: {voluntario.clave_bombero}
        RUT: {voluntario.rut}
        
        Período: {MESES.get(pago.mes, f'Mes {pago.mes}')} {pago.anio}
        Fecha de Pago: {fecha_formateada}
        Método de Pago: {pago.metodo_pago}
        
        MONTO PAGADO: ${pago.monto_pagado:,.0f}
        
        Este es un comprobante electrónico válido.
        Sistema de Gestión de Bomberos - Proyecto SEIS
        """
        
        # Crear email
        subject = f'Comprobante de Pago - Cuota {MESES.get(pago.mes)} {pago.anio}'
        from_email = settings.DEFAULT_FROM_EMAIL
        to_email = [voluntario.email]
        
        print(f'[EMAIL DEBUG] Preparando email...')
        print(f'[EMAIL DEBUG]   Subject: {subject}')
        print(f'[EMAIL DEBUG]   From: {from_email}')
        print(f'[EMAIL DEBUG]   To: {to_email}')
        print(f'[EMAIL DEBUG]   SMTP: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}')
        print(f'[EMAIL DEBUG]   User: {settings.EMAIL_HOST_USER}')
        
        # Crear mensaje con versiones HTML y texto plano
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=to_email
        )
        msg.attach_alternative(html_content, "text/html")
        
        # Generar y adjuntar PDF
        pdf_buffer = generar_pdf_comprobante(html_content)
        if pdf_buffer:
            filename = f'Comprobante_Cuota_{pago.id}_{voluntario.clave_bombero}.pdf'
            msg.attach(filename, pdf_buffer.read(), 'application/pdf')
            print(f'[EMAIL DEBUG] ✅ PDF adjuntado: {filename}')
        else:
            print(f'[EMAIL DEBUG] ⚠️ No se pudo adjuntar PDF (continúa con el envío)')
        
        print(f'[EMAIL DEBUG] Enviando email por SMTP...')
        
        # Enviar email
        result = msg.send(fail_silently=False)
        
        print(f'[EMAIL DEBUG] ✅✅✅ EMAIL ENVIADO EXITOSAMENTE!')
        print(f'[EMAIL DEBUG] Result: {result}')
        print('=' * 60)
        
        logger.info(f'Comprobante enviado a {voluntario.email} para pago {pago.id}')
        return True
        
    except Exception as e:
        print(f'[EMAIL DEBUG] ❌❌❌ ERROR AL ENVIAR EMAIL!')
        print(f'[EMAIL DEBUG] Error: {str(e)}')
        print(f'[EMAIL DEBUG] Tipo: {type(e).__name__}')
        import traceback
        print(f'[EMAIL DEBUG] Traceback:')
        traceback.print_exc()
        print('=' * 60)
        logger.error(f'Error al enviar comprobante a {voluntario.email}: {str(e)}')
        return False


def enviar_comprobante_beneficio(pago_beneficio, voluntario, beneficio):
    """
    Envía un comprobante de pago de beneficio por email con PDF adjunto
    
    Args:
        pago_beneficio: Objeto PagoBeneficio
        voluntario: Objeto Voluntario
        beneficio: Objeto Beneficio
    
    Returns:
        bool: True si se envió correctamente, False si hubo error
    """
    try:
        print('=' * 60)
        print('[EMAIL BENEFICIO] Iniciando envío de comprobante...')
        
        # Verificar que el voluntario tenga email
        if not voluntario.email:
            print(f'[EMAIL BENEFICIO] ❌ Voluntario {voluntario.clave_bombero} NO tiene email')
            logger.warning(f'Voluntario {voluntario.clave_bombero} no tiene email configurado')
            return False
        
        print(f'[EMAIL BENEFICIO] ✅ Email encontrado: {voluntario.email}')
        
        # Preparar contexto
        context = {
            'pago': pago_beneficio,
            'voluntario': voluntario,
            'beneficio': beneficio,
        }
        print(f'[EMAIL BENEFICIO] Renderizando template HTML...')
        
        # Renderizar template HTML
        html_content = render_to_string('emails/comprobante_beneficio.html', context)
        print(f'[EMAIL BENEFICIO] ✅ Template renderizado correctamente')
        
        # Formatear fecha correctamente
        if hasattr(pago_beneficio.fecha_pago, 'strftime'):
            fecha_formateada = pago_beneficio.fecha_pago.strftime('%d/%m/%Y')
        else:
            fecha_formateada = str(pago_beneficio.fecha_pago)
        
        # Crear texto plano
        text_content = f"""
        COMPROBANTE DE PAGO - BENEFICIO
        Bomberos
        
        Comprobante N° {pago_beneficio.id}
        
        Voluntario: {voluntario.nombre} {voluntario.apellido_paterno}
        Beneficio: {beneficio.nombre}
        Fecha de Pago: {fecha_formateada}
        Cantidad de Tarjetas: {pago_beneficio.cantidad_tarjetas}
        
        MONTO PAGADO: ${pago_beneficio.monto:,.0f}
        
        Este es un comprobante electrónico válido.
        Sistema de Gestión de Bomberos - Proyecto SEIS
        """
        
        # Crear email
        subject = f'Comprobante de Pago - {beneficio.nombre}'
        from_email = settings.DEFAULT_FROM_EMAIL
        to_email = [voluntario.email]
        
        print(f'[EMAIL BENEFICIO] Preparando email...')
        print(f'[EMAIL BENEFICIO]   Subject: {subject}')
        print(f'[EMAIL BENEFICIO]   To: {to_email}')
        
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=to_email
        )
        msg.attach_alternative(html_content, "text/html")
        
        # Generar y adjuntar PDF
        pdf_buffer = generar_pdf_comprobante(html_content)
        if pdf_buffer:
            filename = f'Comprobante_Beneficio_{pago_beneficio.id}_{voluntario.clave_bombero}.pdf'
            msg.attach(filename, pdf_buffer.read(), 'application/pdf')
            print(f'[EMAIL BENEFICIO] ✅ PDF adjuntado: {filename}')
        else:
            print(f'[EMAIL BENEFICIO] ⚠️ No se pudo adjuntar PDF (continúa con el envío)')
        
        print(f'[EMAIL BENEFICIO] Enviando email por SMTP...')
        
        # Enviar email
        result = msg.send(fail_silently=False)
        
        print(f'[EMAIL BENEFICIO] ✅✅✅ EMAIL ENVIADO EXITOSAMENTE!')
        print(f'[EMAIL BENEFICIO] Result: {result}')
        print('=' * 60)
        
        logger.info(f'Comprobante de beneficio enviado a {voluntario.email}')
        return True
        
    except Exception as e:
        print(f'[EMAIL BENEFICIO] ❌❌❌ ERROR AL ENVIAR EMAIL!')
        print(f'[EMAIL BENEFICIO] Error: {str(e)}')
        import traceback
        traceback.print_exc()
        print('=' * 60)
        logger.error(f'Error al enviar comprobante de beneficio: {str(e)}')
        return False


def enviar_comprobante_rifa(pago_rifa, voluntario, rifa):
    """
    Envía un comprobante de pago de rifa por email.
    """
    import json
    try:
        if not voluntario.email:
            logger.warning(f'Voluntario {voluntario.clave_bombero} no tiene email')
            return False

        asignacion = pago_rifa.asignacion
        numeros = json.loads(asignacion.numeros or '[]')
        numeros_str = ', '.join(f"{r['desde']}–{r['hasta']}" for r in numeros) if numeros else 'Sin asignar'

        fecha_formateada = pago_rifa.fecha_pago.strftime('%d/%m/%Y') if hasattr(pago_rifa.fecha_pago, 'strftime') else str(pago_rifa.fecha_pago)

        subject = f'Comprobante de Pago - {rifa.nombre}'
        text_content = f"""
COMPROBANTE DE PAGO - RIFA
Bomberos Sexta Compañía

Comprobante N° {pago_rifa.id}

Voluntario: {voluntario.nombre} {voluntario.apellido_paterno}
Rifa: {rifa.nombre} (Ciclo {rifa.ciclo})
Fecha de Pago: {fecha_formateada}
Talonarios: {asignacion.talonarios_asignados}
Números: {numeros_str}

MONTO PAGADO: ${pago_rifa.monto:,.0f}
Método: {pago_rifa.metodo_pago}
{f'Comprobante N°: {pago_rifa.numero_comprobante}' if pago_rifa.numero_comprobante else ''}

Este es un comprobante electrónico válido.
Sistema de Gestión de Bomberos - Proyecto SEIS
        """

        html_content = f"""
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
    <div style="background:linear-gradient(135deg,#c41e3a,#8b1429);color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h2 style="margin:0">Comprobante de Pago</h2>
        <p style="margin:4px 0 0 0;opacity:0.85">{rifa.nombre}</p>
    </div>
    <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <p>Estimado/a <strong>{voluntario.nombre} {voluntario.apellido_paterno}</strong>,</p>
        <p>Confirmamos el siguiente pago de rifa:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;color:#6b7280">Rifa</td><td style="padding:8px;border-bottom:1px solid #f3f4f6;font-weight:600">{rifa.nombre} — Ciclo {rifa.ciclo}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;color:#6b7280">Fecha</td><td style="padding:8px;border-bottom:1px solid #f3f4f6">{fecha_formateada}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;color:#6b7280">Talonarios</td><td style="padding:8px;border-bottom:1px solid #f3f4f6">{asignacion.talonarios_asignados}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;color:#6b7280">Números</td><td style="padding:8px;border-bottom:1px solid #f3f4f6">{numeros_str}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;color:#6b7280">Método</td><td style="padding:8px;border-bottom:1px solid #f3f4f6">{pago_rifa.metodo_pago.capitalize()}</td></tr>
            {f'<tr><td style="padding:8px;border-bottom:1px solid #f3f4f6;color:#6b7280">Comprobante N°</td><td style="padding:8px;border-bottom:1px solid #f3f4f6">{pago_rifa.numero_comprobante}</td></tr>' if pago_rifa.numero_comprobante else ''}
        </table>
        <div style="background:#fef2f2;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:0.8rem;color:#7f1d1d;text-transform:uppercase;letter-spacing:0.5px">Monto Pagado</div>
            <div style="font-size:1.8rem;font-weight:700;color:#c41e3a">${pago_rifa.monto:,.0f}</div>
        </div>
        <p style="font-size:0.8rem;color:#9ca3af;margin-top:20px">Comprobante generado automáticamente — Sistema de Gestión Bomberos Sexta Compañía</p>
    </div>
</body></html>
        """

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[voluntario.email]
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        logger.info(f'Comprobante de rifa enviado a {voluntario.email}')
        return True

    except Exception as e:
        logger.error(f'Error al enviar comprobante de rifa: {str(e)}')
        return False
