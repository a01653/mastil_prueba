# Reglas de Trabajo del Repo

## Versionado

- Cada cambio que se entregue debe incrementar la versión secuencialmente: `2.93`, `2.94`, `2.95`, etc.
- La versión debe actualizarse en:
  - `src/App.jsx` en `APP_VERSION`
  - `package.json` en `version`
  - `package-lock.json` en `version`

## Cierre de Entregas

- Antes de cerrar una entrega hay que ejecutar `npm run build`.
- El commit debe usar este formato:
  - `vX.XX - <resumen corto>`
- También hay que crear un tag anotado con este formato:
  - `vX.XX`
- Después hay que hacer push de `main` y del tag.

## Nota Importante

- El número de versión y el resumen corto no son fijos.
- Se generan en cada entrega según el cambio real que se haya hecho.
