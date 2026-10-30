"""
Vistas para generación de PDFs de cuotas
"""
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Voluntario, PagoCuota, LogoCompania
from .pdf_nominas import (generar_pdf_cuotas_voluntario, generar_pdf_nomina_deudores_cuotas, generar_pdf_nomina_deudores_beneficios,
                          generar_pdf_estado_deuda_voluntario)
from .utils_tesoreria import cuotas_aniversario_pendientes, puede_pagar_cuotas, obtener_precio_cuota, calcular_deuda_cuotas, calcular_deudores_cuotas, calcular_deudas_beneficios_y_rifas
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
        
        deuda = calcular_deuda_cuotas(voluntario, anio)
        validacion = puede_pagar_cuotas(voluntario)
        logo = LogoCompania.objects.filter(usar_en_pdfs=True).first()
        pdf_buffer = generar_pdf_cuotas_voluntario(
            voluntario, anio, pagos_dict, deuda, obtener_precio_cuota(voluntario),
            exento=not validacion['puede'], motivo_exencion=validacion.get('mensaje', ''),
            logo_base64=logo.imagen if logo else None,
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
        deudas = calcular_deudas_beneficios_y_rifas()
        beneficio_id = request.GET.get('beneficio_id')
        if beneficio_id:
            deudas = [d for d in deudas if d['grupo'] == ('beneficio', int(beneficio_id))]
        logo = LogoCompania.objects.filter(usar_en_pdfs=True).first()
        pdf_buffer = generar_pdf_nomina_deudores_beneficios(
            deudas, logo_base64=logo.imagen if logo else None
        )

        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        filename = f"deudores_beneficios_{datetime.now().strftime('%Y%m%d')}.pdf"
        response['Content-Disposition'] = f'inline; filename="{filename}"'

        return response

    except Exception as e:
        return HttpResponse(f'Error al generar PDF: {str(e)}', status=500)


@require_http_methods(["GET"])
def pdf_estado_deuda_voluntario(request, voluntario_id):
    """
    Estado de deuda de un voluntario (cuotas del año + beneficios y rifas)
    GET /api/voluntarios/{id}/pdf-deudas/
    """
    autorizado, respuesta = autorizar_request(request, modulo='finanzas', accion='view')
    if not autorizado:
        return respuesta
    try:
        voluntario = Voluntario.objects.get(id=voluntario_id)
    except Voluntario.DoesNotExist:
        return HttpResponse('Voluntario no encontrado', status=404)

    anio = datetime.now().year
    deuda_cuotas = calcular_deuda_cuotas(voluntario, anio)
    otras = [d for d in calcular_deudas_beneficios_y_rifas() if d['voluntario'].id == voluntario.id]
    logo = LogoCompania.objects.filter(usar_en_pdfs=True).first()
    aniversario = [(c.anio, c.monto) for c in cuotas_aniversario_pendientes(voluntario)]
    pdf = generar_pdf_estado_deuda_voluntario(voluntario, deuda_cuotas, otras, anio,
                                              logo_base64=logo.imagen if logo else None,
                                              aniversario=aniversario)
    response = HttpResponse(pdf.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="estado_deuda_{voluntario.clave_bombero}.pdf"'
    return response


@require_http_methods(["GET", "POST"])
def comprobante_anual_voluntario(request, voluntario_id):
    """
    Comprobante anual con todo lo que el voluntario pagó en el año.
    GET  /api/voluntarios/{id}/comprobante-anual/?anio=2026  -> ver el PDF
    POST /api/voluntarios/{id}/comprobante-anual/?anio=2026  -> enviarlo por correo
    """
    from .comprobantes import enviar_comprobante_anual, generar_pdf_comprobante_anual, pagos_del_anio
    autorizado, respuesta = autorizar_request(request, modulo='finanzas', accion='view')
    if not autorizado:
        return respuesta
    try:
        voluntario = Voluntario.objects.get(id=voluntario_id)
        anio = int(request.GET.get('anio') or datetime.now().year)
    except (Voluntario.DoesNotExist, ValueError):
        return JsonResponse({'error': 'Voluntario o año inválido'}, status=404)

    if request.method == 'GET':
        pdf = generar_pdf_comprobante_anual(voluntario, anio, pagos_del_anio(voluntario, anio))
        response = HttpResponse(pdf.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="comprobante_anual_{anio}_{voluntario.clave_bombero}.pdf"'
        return response

    if not voluntario.email:
        return JsonResponse({'error': f'{voluntario.nombre_completo()} no tiene email registrado'}, status=400)
    try:
        enviado = enviar_comprobante_anual(voluntario, anio)
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    if not enviado:
        return JsonResponse({'error': 'No se pudo enviar el correo. Intenta de nuevo en unos minutos.'}, status=502)
    return JsonResponse({'enviado': True, 'email': voluntario.email})
