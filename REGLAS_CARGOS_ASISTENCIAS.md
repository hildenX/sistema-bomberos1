# 📋 REGLAS DE NEGOCIO: CARGOS Y ASISTENCIAS

## 🎯 RESUMEN EJECUTIVO

Este documento detalla TODAS las reglas de negocio del sistema de Cargos y su relación con el sistema de Asistencias, basado en el análisis del código p6p existente.

---

## 🏛️ TIPOS DE CARGOS

### 1. **CARGOS DE COMANDANCIA** (8 cargos)
```javascript
- Superintendente
- Comandante 1
- Comandante 2
- Comandante 3
- Intendente General
- Tesorero General
- Secretario General
- Ayudante General
```

**Características:**
- ✅ Aparecen en asistencias CON su cargo
- ✅ Cuentan como "Oficiales de Comandancia"
- ✅ Suman al ranking de asistencias
- ✅ Pueden asistir a TODAS las actividades

---

### 2. **CARGOS DE COMPAÑÍA - OFICIALES** (10 cargos)
```javascript
- Capitán
- Director ← ⚠️ SOLO este asiste a Directorios
- Secretario
- Tesorero
- Capellán
- Intendente
- Teniente Primero
- Teniente Segundo
- Teniente Tercero
- Teniente Cuarto
```

**Características:**
- ✅ Aparecen en asistencias CON su cargo
- ✅ Cuentan como "Oficiales de Compañía"
- ✅ Suman al ranking de asistencias
- ⚠️ **SOLO el DIRECTOR asiste a reuniones de Directorio**

---

### 3. **CARGOS DE CONFIANZA - TÉCNICOS** (8 cargos)
```javascript
- Jefe de Máquinas
- Maquinista 1°
- Maquinista 2°
- Maquinista 3°
- Ayudante
- Ayudante 1°
- Ayudante 2°
- Ayudante 3°
```

**Características:**
- ✅ Aparecen en asistencias CON su cargo
- ✅ Cuentan como "Cargos de Confianza"
- ✅ Suman al ranking de asistencias

---

### 4. **CARGOS DE CONSEJO** (3 cargos) ⚠️ REGLA ESPECIAL
```javascript
- Miembro Consejo de Disciplina de Cía
- Miembro Junta Calificadora
- Miembro Junta Revisora de Cuentas
```

**⚠️ CARACTERÍSTICAS ESPECIALES:**
- ❌ **NO aparecen en asistencias CON su cargo**
- ✅ **Aparecen con su GRADO por antigüedad:**
  - Voluntario (< 20 años)
  - Voluntario Honorario de Compañía (20-24 años)
  - Voluntario Honorario del Cuerpo (25-49 años)
  - Voluntario Insigne de Chile (50+ años)
- ✅ Suman al ranking como voluntarios regulares
- ✅ Se registran en BD pero su cargo NO se muestra en asistencias

---

## 📊 TIPOS DE ASISTENCIAS

### 1. **EMERGENCIA**
```javascript
- Todos pueden asistir
- Suma al ranking
- Campos: clave, dirección, hora
```

### 2. **ASAMBLEA**
```javascript
- Todos pueden asistir
- Suma al ranking
- Tipos:
  - Ordinaria
  - Extraordinaria
```

### 3. **EJERCICIOS**
```javascript
- Todos pueden asistir
- Suma al ranking
- Tipos:
  - De Compañía
  - De Cuerpo
```

### 4. **CITACIONES**
```javascript
- Todos pueden asistir
- Suma al ranking
- Campo: nombre citación
```

### 5. **OTRAS ACTIVIDADES**
```javascript
- Todos pueden asistir
- Suma al ranking
- Campo: motivo
```

### 6. **DIRECTORIO** ⚠️ REGLA ESPECIAL
```javascript
⚠️ SOLO asisten los DIRECTORES de cada compañía
❌ NO suma al ranking de asistencias
✅ Se registra en BD para control
✅ Cuenta para estadísticas pero NO para ranking individual
```

---

## 🏆 REGLAS DEL RANKING DE ASISTENCIAS

### ✅ **SÍ SUMAN AL RANKING:**
```javascript
1. Voluntarios activos
2. Oficiales de Comandancia (con cargo mostrado)
3. Oficiales de Compañía (con cargo mostrado)
4. Cargos de Confianza (con cargo mostrado)
5. Miembros de Consejo (con grado, NO cargo)
6. Asistencias a:
   - Emergencias
   - Asambleas
   - Ejercicios
   - Citaciones
   - Otras actividades
```

### ❌ **NO SUMAN AL RANKING:**
```javascript
1. Mártires (se registran pero NO cuentan)
2. Voluntarios con estado ≠ 'activo'
3. Asistencias a Directorios
4. Voluntarios externos (participantes/canjes)
```

---

## 🔄 FLUJO: REGISTRO DE ASISTENCIA

### **PASO 1: Obtener Cargo Vigente**
```javascript
obtenerCargoVigente(bomberoId):
  1. Buscar cargos del bombero
  2. Filtrar por año actual
  3. Si tiene fechaFinCargo:
     - Validar que NO haya expirado
  4. Si NO tiene fechaFinCargo:
     - Es vigente todo el año
  5. Retornar el cargo más reciente
```

### **PASO 2: Determinar Categoría en Asistencia**
```javascript
SI bombero.estado === 'martir':
    categoria = 'Voluntario Mártir'
    
SINO SI tiene cargo vigente:
    SI cargo es de COMANDANCIA:
        categoria = 'Oficial de Comandancia'
        mostrarCargo = SÍ
        
    SINO SI cargo es OFICIAL de COMPAÑÍA:
        categoria = 'Oficial de Compañía'
        mostrarCargo = SÍ
        
    SINO SI cargo es de CONFIANZA:
        categoria = 'Cargo de Confianza'
        mostrarCargo = SÍ
        
    SINO SI cargo es de CONSEJO: ⚠️ REGLA ESPECIAL
        // NO mostrar cargo, mostrar grado por antigüedad
        antiguedad = calcularAntiguedad(fechaIngreso)
        SI antiguedad >= 50:
            categoria = 'Voluntario Insigne de Chile'
        SINO SI antiguedad >= 25:
            categoria = 'Voluntario Honorario del Cuerpo'
        SINO SI antiguedad >= 20:
            categoria = 'Voluntario Honorario de Compañía'
        SINO:
            categoria = 'Voluntario'
        mostrarCargo = NO
        
SINO (sin cargo):
    // Clasificar por antigüedad
    antiguedad = calcularAntiguedad(fechaIngreso)
    categoria = según antiguedad
```

### **PASO 3: Guardar en DetalleAsistencia**
```javascript
{
    evento_id: X,
    voluntario_id: Y,
    nombre_completo: "Juan Pérez",
    clave_bombero: "667",
    categoria: "Oficial de Compañía" o "Voluntario Honorario" etc,
    cargo: "Capitán" o NULL (si es consejo),
    anio_cargo: 2025 o NULL
}
```

### **PASO 4: Actualizar Ranking**
```javascript
SI tipo_asistencia !== 'directorio':
    SI voluntario.estado === 'activo':
        ranking[año][voluntario_id].total++
        ranking[año][voluntario_id][tipo]++
```

---

## 📐 REGLAS DE VALIDACIÓN

### **1. Cargo Vigente**
```javascript
✅ Válido SI:
   - añoCargo === año actual
   - Y (fechaFinCargo === NULL O fechaFinCargo >= hoy)
   
❌ NO válido SI:
   - añoCargo ≠ año actual
   - O fechaFinCargo < hoy
```

### **2. Asistencia a Directorio**
```javascript
✅ Puede asistir SI:
   - Tiene cargo de "Director"
   - Cargo es vigente
   - Estado === 'activo'
   
❌ NO puede asistir SI:
   - NO tiene cargo de Director
   - Cargo expiró
   - Estado ≠ 'activo'
```

### **3. Participación en Ranking**
```javascript
✅ Participa SI:
   - estado === 'activo'
   - tipo_asistencia ≠ 'directorio'
   
❌ NO participa SI:
   - estado ≠ 'activo'
   - O tipo_asistencia === 'directorio'
```

---

## 🗂️ ESTRUCTURA EN BASE DE DATOS

### **Modelo: Cargo**
```python
{
    'voluntario': FK(Voluntario),
    'tipo_cargo': 'comandancia'/'compania'/'consejo'/'tecnico',
    'nombre_cargo': 'Capitán',
    'anio': 2025,
    'fecha_inicio': '2025-01-01',
    'fecha_fin': NULL o '2025-12-31',
    'observaciones': ''
}
```

### **Modelo: EventoAsistencia**
```python
{
    'tipo': 'emergencia'/'asamblea'/'ejercicios'/'citaciones'/'otras'/'directorio',
    'fecha': '2025-11-14',
    'descripcion': '...',
    
    // Estadísticas automáticas
    'total_asistentes': 15,
    'oficiales_comandancia': 2,
    'oficiales_compania': 5,
    'cargos_confianza': 3,
    'voluntarios': 5,
    
    'suma_ranking': True/False  ← SI tipo ≠ 'directorio'
}
```

### **Modelo: DetalleAsistencia**
```python
{
    'evento': FK(EventoAsistencia),
    'voluntario': FK(Voluntario),
    'nombre_completo': 'Juan Pérez',
    'clave_bombero': '667',
    'categoria': 'Oficial de Compañía',  ← Por antigüedad si es consejo
    'cargo': 'Capitán',  ← NULL si es consejo
    'anio_cargo': 2025,
    'es_externo': False
}
```

---

## ⚠️ CASOS ESPECIALES CRÍTICOS

### **CASO 1: Miembro de Junta Calificadora**
```
Cargo en BD: "Miembro Junta Calificadora" (tipo: consejo)
Antigüedad: 28 años

EN ASISTENCIA SE MUESTRA:
✅ Categoria: "Voluntario Honorario del Cuerpo"
❌ Cargo: NULL (NO se muestra)
✅ Suma al ranking: SÍ
```

### **CASO 2: Director asistiendo a Emergencia**
```
Cargo en BD: "Director" (tipo: compania)

EN ASISTENCIA SE MUESTRA:
✅ Categoria: "Oficial de Compañía"
✅ Cargo: "Director"
✅ Suma al ranking: SÍ
```

### **CASO 3: Oficial de Compañía o Cargo de Confianza asistiendo a Directorio**
```
⚠️ REGLA: Solo Oficiales de Compañía + Cargos de Confianza asisten a Directorios

Cargo en BD: "Capitán" (tipo: compania)
O "Jefe de Máquinas" (tipo: tecnico)

EN ASISTENCIA SE MUESTRA:
✅ Categoria: "Oficial de Compañía" o "Cargo de Confianza"
✅ Cargo: "Capitán" o "Jefe de Máquinas"
❌ Suma al ranking: NO

SI NO tiene estos cargos:
❌ ERROR: No puede asistir a Directorios
```

### **CASO 4: Mártir con cargo de Superintendente**
```
Estado: 'martir'
Cargo: "Superintendente" (tipo: comandancia)

EN ASISTENCIA SE MUESTRA:
✅ Categoria: "Voluntario Mártir"
❌ Cargo: NULL (prioridad al estado mártir)
❌ Suma al ranking: NO (los mártires NO suman)
```

---

## 🎯 RESUMEN PARA IMPLEMENTACIÓN

### **PRIORIDAD 1: Migrar Cargos a Django**
- Crear API endpoints
- Validar cargos vigentes
- Clasificar por tipo (comandancia/compania/consejo/tecnico)

### **PRIORIDAD 2: Implementar Asistencias**
- Crear registros de eventos
- Validar reglas de directorio
- Aplicar lógica de categorías

### **PRIORIDAD 3: Ranking Automático**
- Excluir directorios
- Excluir mártires
- Contar por tipo de asistencia

---

## 📝 NOTAS IMPORTANTES

1. **Los cargos de consejo SON válidos** pero NO se muestran en asistencias
2. **Solo el Director** puede asistir a reuniones de directorio
3. **Los directorios NO suman** al ranking individual
4. **Los mártires se registran** pero NO cuentan en ranking
5. **Los externos** (participantes/canjes) se cuentan en total pero NO en ranking

---

**Fecha de Análisis:** 14/11/2025  
**Fuente:** Código p6p/js/asistencias.js, cargos.js, historial-asistencias.js  
**Estado:** ✅ COMPLETO - Listo para implementación en Django
