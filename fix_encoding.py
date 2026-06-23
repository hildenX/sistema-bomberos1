#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script para corregir encoding del backup JSON
"""
import json

print("Leyendo backup con encoding latin-1...")
with open('backup_sqlite_datos.json', 'r', encoding='latin-1') as f:
    data = json.load(f)

print(f"Total de registros: {len(data)}")

print("Guardando con UTF-8...")
with open('backup_sqlite_datos_utf8.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("✓ Archivo corregido: backup_sqlite_datos_utf8.json")
