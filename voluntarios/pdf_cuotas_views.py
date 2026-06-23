"""
Vistas para generación de PDFs de cuotas
"""
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Voluntario, PagoCuota, LogoCompania
from .pdf_cuotas import generar_pdf_cuotas, generar_pdf_deudores
from .utils_tesoreria import calcular_deuda_cuotas, calcular_deudores_cuotas
from datetime import datetime


@csrf_exempt
@require_http_methods(["GET"])
def pdf_cuotas_voluntario(request, voluntario_id, anio=None):
    """
    Genera PDF con estado de cuotas de un voluntario
    GET /api/voluntarios/{id}/pdf-cuotas/{anio}/
    """
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
        except:
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
    try:
        # Si no se especifica año, usar el actual
        if not anio:
            anio = datetime.now().year
        else:
            anio = int(anio)
        
        # Obtener deudores
        deudores = calcular_deudores_cuotas(anio)
        
        # Preparar datos para PDF
        meses_nombres = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                         'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        deudores_data = []
        for deudor in deudores:
            voluntario = deudor['voluntario']
            meses_str = ', '.join([meses_nombres[m['mes']] for m in deudor['meses_pendientes']])
            deudores_data.append({
                'clave': voluntario.clave_bombero or 'N/A',
                'nombre': f"{voluntario.nombre} {voluntario.apellido_paterno}",
                'compania': voluntario.compania or '',
                'meses_nombres': meses_str,
                'meses_pendientes': len(deudor['meses_pendientes']),
                'deuda_total': deudor['monto']
            })
        
        # Obtener logo (si existe)
        logo_base64 = None
        try:
            logo = LogoCompania.objects.filter(usar_en_pdfs=True).first()
            if logo:
                logo_base64 = logo.imagen
        except:
            pass
        
        # Generar PDF
        pdf_buffer = generar_pdf_deudores(
            deudores_data=deudores_data,
            anio=anio,
            logo_base64=logo_base64
        )
        
        # Crear respuesta HTTP
        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        filename = f"deudores_cuotas_{anio}.pdf"
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        
        return response
        
    except Exception as e:
        return HttpResponse(f'Error al generar PDF: {str(e)}', status=500)
