"""
Vistas para generación de PDFs de cuotas
"""
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Voluntario, PagoCuota, LogoCompania, AsignacionBeneficio
from .pdf_cuotas import generar_pdf_cuotas
from .pdf_nominas import generar_pdf_nomina_deudores_cuotas, generar_pdf_nomina_deudores_beneficios
from .utils_tesoreria import calcular_deuda_cuotas, calcular_deudores_cuotas
from .permissions import autorizar_request
from datetime import datetime


@csrf_exempt
@require_http_methods(["GET"])
def pdf_cuotas_voluntario(request, voluntario_id, anio=None):
    """
    Genera PDF con estado de cuotas de un voluntario
    GET /api/voluntarios/{id}/pdf-cuotas/{anio}/
    """
    autorizado, respuesta = autorizar_request(request, modulo='cuotas', accion='view')
    if not autorizado:
        return respuesta

    try:
        voluntario = Voluntario.objects.get(id=voluntario_id)
        
        # Si no se especifica año, usar el actual
        if not anio:
            anio = datetime.now().year
        else:
            anio = int(anio)
        
        # Obtener pagos del año
        pagos = PagoCuota.objects.filter(
            voluntario=voluntario,
            anio=anio
        )
        
        # Crear diccionario de pagos por mes
        pagos_dict = {}
        for pago in pagos:
            pagos_dict[pago.mes] = {
                'monto_pagado': pago.monto_pagado,
                'fecha_pago': pago.fecha_pago,
                'metodo_pago': pago.metodo_pago
            }
        
        # Calcular deuda total
        deuda = calcular_deuda_cuotas(voluntario, anio)
        deuda_total = deuda['monto']
        
        # Obtener logo (si existe)
        logo_base64 = None
        try:
            logo = LogoCompania.objects.filter(usar_en_pdfs=True).first()
            if logo:
                logo_base64 = logo.imagen
        except Exception:
            pass
        
        # Generar PDF
        pdf_buffer = generar_pdf_cuotas(
            voluntario=voluntario,
            anio=anio,
            pagos_dict=pagos_dict,
            deuda_total=deuda_total,
            logo_base64=logo_base64
        )
        
        # Crear respuesta HTTP
        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        filename = f"cuotas_{voluntario.clave_bombero}_{anio}.pdf"
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        
        return response
        
    except Voluntario.DoesNotExist:
        return HttpResponse('Voluntario no encontrado', status=404)
    except Exception as e:
        return HttpResponse(f'Error al generar PDF: {str(e)}', status=500)


@csrf_exempt
@require_http_methods(["GET"])
def pdf_deudores_cuotas(request, anio=None):
    """
    Genera PDF con listado de deudores de cuotas
    GET /api/voluntarios/pdf-deudores-cuotas/{anio}/
    """
    autorizado, respuesta = autorizar_request(request, modulo='finanzas', accion='view')
    if not autorizado:
        return respuesta

    try:
        # Si no se especifica año, usar el actual
        if not anio:
            anio = datetime.now().year
        else:
            anio = int(anio)
        
        deudores = calcular_deudores_cuotas(anio)
        logo = LogoCompania.objects.filter(usar_en_pdfs=True).first()
        pdf_buffer = generar_pdf_nomina_deudores_cuotas(
            deudores, anio, logo_base64=logo.imagen if logo else None
        )

        # Crear respuesta HTTP
        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        filename = f"deudores_cuotas_{anio}.pdf"
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        
        return response

    except Exception as e:
        return HttpResponse(f'Error al generar PDF: {str(e)}', status=500)


@csrf_exempt
@require_http_methods(["GET"])
def pdf_deudores_beneficios(request):
    """
    Genera PDF con listado de deudores de beneficios
    GET /api/voluntarios/pdf-deudores-beneficios/
    """
    autorizado, respuesta = autorizar_request(request, modulo='finanzas', accion='view')
    if not autorizado:
        return respuesta

    try:
        asignaciones = AsignacionBeneficio.objects.filter(
            monto_pendiente__gt=0
        ).exclude(
            estado_pago='liberado'
        ).select_related('voluntario', 'beneficio')

        logo = LogoCompania.objects.filter(usar_en_pdfs=True).first()
        pdf_buffer = generar_pdf_nomina_deudores_beneficios(
            asignaciones, logo_base64=logo.imagen if logo else None
        )

        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        filename = f"deudores_beneficios_{datetime.now().strftime('%Y%m%d')}.pdf"
        response['Content-Disposition'] = f'inline; filename="{filename}"'

        return response

    except Exception as e:
        return HttpResponse(f'Error al generar PDF: {str(e)}', status=500)
