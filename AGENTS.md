# Reglas de Trabajo del Repo

## Flujo Normal

- Primero se hacen los cambios en local.
- Antes de dar una entrega por buena, hay que validar el resultado en local.
- La validación local debe incluir `npm run build`.
- Antes de levantar `npm run preview`, hay que incrementar `APP_VERSION` en `src/App.jsx` para que la versión visible en local ya refleje el cambio.
- Si hace falta revisar la interfaz o el resultado final, se puede levantar `npm run preview` y mostrar la URL local.
- Entre el `preview` local y la publicación no se debe cambiar ese `APP_VERSION`: si luego el usuario pide publicar, se usa exactamente el mismo número.

## Publicación

- No se debe hacer commit, tag ni push automáticamente al terminar un cambio.
- Solo se publica cuando el usuario lo pida explícitamente con una orden tipo "súbelo".

## Versionado al Publicar

- La versión visible en `preview` debe seguir la secuencia `2.93`, `2.94`, `2.95`, etc.
- Cuando el usuario pida publicar, hay que reutilizar esa misma versión ya mostrada en local; no se incrementa otra vez.
- La versión debe actualizarse en:
  - `src/App.jsx` en `APP_VERSION`
  - `package.json` en `version`
  - `package-lock.json` en `version`

## Commit y Tag al Publicar

- Cuando el usuario pida publicar, el commit debe usar este formato:
  - `vX.XX - <resumen corto>`
- También hay que crear un tag anotado con este formato:
  - `vX.XX`
- Después hay que hacer push de `main` y del tag.

## Nota Importante

- El número de versión y el resumen corto no son fijos.
- Se generan en cada publicación según el cambio real que se haya hecho.
