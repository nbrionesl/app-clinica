# Prototipo — Clínica Pediátrica Pequeños Pasos (Heredia)

App web sin dependencias (HTML + CSS + JS puro). Datos ficticios.

## Archivos
- `index.html` — estructura, enlace de salto, herramientas de accesibilidad, regiones en vivo.
- `styles.css` — estilos (contraste AA, foco visible, alto contraste, responsive, impresión).
- `data.js` — datos de demostración (pacientes, médicos, citas, vacunas, laboratorio, recetas).
- `app.js` — rutas, módulos y lógica.

## Módulos
1. **Citas (familias):** agendar en 4 pasos, reprogramar y cancelar. Horarios libres según médico y fecha.
2. **Expediente electrónico:** resumen, vacunas, crecimiento (gráfico + tabla), laboratorio, recetas y seguimiento de dosis.
3. **Panel médico:** agenda en vivo, llegada/consulta/finalizar, búsqueda de pacientes, notas y recetas (la familia las ve de inmediato).

## Probar el "tiempo real"
Abra la app en dos pestañas: una en `#/familia` y otra en `#/medico`. Al agendar en una, la otra se actualiza.

## Accesibilidad incluida
Idioma `es-CR`, enlace "Saltar al contenido", HTML semántico, foco visible, objetivos ≥ 44 px, botones A−/A+, alto contraste, estados con texto + símbolo (no solo color), formularios con etiquetas y resumen de errores, `aria-live` para avisos, `<dialog>` nativo, `prefers-reduced-motion`, tablas con alternativa móvil y gráfico con descripción y tabla.

## Para AI Studio
Pegue los 4 archivos tal cual. Siguientes pasos sugeridos: autenticación real, backend/base de datos, recordatorios por WhatsApp/SMS, cumplimiento de privacidad (Ley 8968 de Costa Rica).
