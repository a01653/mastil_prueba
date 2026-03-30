# Mástil interactivo de guitarra

Aplicación web para estudiar **escalas, patrones, rutas musicales y acordes** sobre el mástil de la guitarra de forma visual e interactiva.

Está pensada como herramienta práctica de estudio para entender la relación entre **notas, intervalos, digitaciones, voicings, patrones y armonía** directamente sobre el diapasón.

## Descripción

El proyecto permite visualizar escalas y acordes en un mástil interactivo, generar patrones habituales de guitarra, analizar voicings y comparar digitaciones cercanas dentro de una zona concreta del mástil.

También incluye un modo de exploración para seleccionar notas manualmente y detectar acordes posibles a partir de esa selección.

## Funcionalidades principales

### Escalas
- Escalas mayores y menores
- Pentatónica mayor y menor
- Modos griegos
- Escalas armónicas, melódicas, bebop, disminuidas, de tonos enteros y otras variantes
- Escalas personalizadas por intervalos

### Visualización sobre el mástil
- Vista por **notas**
- Vista por **intervalos**
- Vista combinada de notas e intervalos
- Opción para mostrar también las notas fuera de la escala
- Resaltado de raíz, 3ª, 5ª y tensiones

### Patrones
- **5 boxes** para pentatónicas
- **3NPS** para escalas de 7 notas
- **CAGED**
- Casillas de referencia para blues

### Ruta musical
- Cálculo de recorridos entre una nota inicial y otra final
- Modos de ruta libre, por posición, por patrón o por sistema concreto
- Preferencias de continuidad por cuerda, verticalidad y permanencia en patrón

### Acordes
- Construcción de:
  - triadas
  - cuatriadas
  - acordes extendidos
- Soporte para:
  - inversiones
  - voicings cerrados
  - voicings abiertos
  - drops
  - tensiones 6, 7, 9, 11 y 13
- Selección de digitaciones reales
- Análisis del acorde y del voicing mostrado

### Acordes cercanos
- Comparación de hasta 4 acordes
- Búsqueda de digitaciones dentro de un rango concreto de trastes
- Ordenación por cercanía al acorde de referencia
- Estudio de voice leading y armonización práctica

### Investigar en mástil
- Selección manual de notas sobre el mástil
- Detección de acordes posibles a partir de esas notas
- Posibilidad de copiar el acorde detectado al panel principal
- Reproducción opcional de la selección

### Configuración
- Persistencia automática en navegador
- Exportación e importación de configuración
- Presets rápidos

## Tecnologías

- **React**
- **Vite**
- **Tailwind CSS**
- **Lucide React**

## Objetivo del proyecto

Este proyecto nace como herramienta de apoyo al estudio de guitarra para:

- localizar notas en el mástil
- entender intervalos y construcción de escalas
- relacionar escalas con acordes
- estudiar patrones reales de digitación
- analizar inversiones, drops y voicings
- trabajar progresiones y acordes cercanos de forma visual

## Instalación

```bash
npm install
npm run dev
````

## Build de producción

```bash
npm run build
```

## Vista previa local

```bash
npm run preview
```

## Estructura general del proyecto

* **Escalas**: selección de tonalidad, escala y visualización
* **Patrones**: boxes, 3NPS y CAGED
* **Ruta**: cálculo de recorrido musical entre dos posiciones
* **Acordes**: construcción, análisis y digitaciones
* **Acordes cercanos**: comparación de voicings en rango
* **Modo estudio**: análisis armónico y funcional

## Estado del proyecto

Proyecto en desarrollo activo, con foco en:

* mejora de voicings y digitaciones
* refinado de lógica armónica
* mejoras de usabilidad e interfaz
* ampliación del análisis musical

## Autor

**Jesus Quevedo Rodriguez**


