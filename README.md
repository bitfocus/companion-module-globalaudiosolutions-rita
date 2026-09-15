# companion-module-globalaudiosolutions-rita

Módulo de [Bitfocus Companion](https://bitfocus.io/companion) para controlar RiTA (Global Audio Solutions) a través de su API WebSocket v1.

La ayuda para el usuario de Companion está en [companion/HELP.md](companion/HELP.md).

## Estado

La API de RiTA sigue en borrador (ver `RiTA_Matlab/sdk/README.md`). El módulo sigue `sdk/referencia.md` y, para la contraseña, el objeto `session` (`set session {"password": ...}`), que existe en el servidor pero aún no aparece en la referencia de la SDK.

Hecho con `@companion-module/base` 2.x: necesita Companion 4.3 o posterior.

## Instalar en Companion

1. En Companion, pestaña **Modules** → **Import module package**.
2. Elegir `globalaudiosolutions-rita-<versión>.tgz`.
3. Pestaña **Connections** → buscar **RiTA** → **Add**.

## Generar el paquete

Requiere Node.js 22.

```bash
npm install
```

```bash
npm run package
```

Deja `globalaudiosolutions-rita-<versión>.tgz` en esta carpeta. La versión sale de `package.json`.

Sin RiTA a mano, se puede levantar el servidor de pruebas en MATLAB:

```matlab
addpath('<ruta>\RiTA_Matlab\software\api')
rapiStreamDemo(26101, 3600)
```

## Estructura

| Fichero | Contenido |
|---|---|
| `src/index.ts` | Instancia del módulo, ciclo de vida y sondeo de estado |
| `src/api.ts` | Cliente WebSocket: grupo de puertos, `sequenceNumber`, contraseña, reconexión |
| `src/actions.ts` | Acciones |
| `src/feedbacks.ts` | Feedbacks |
| `src/variables.ts` | Variables |
| `src/choices.ts` | Listas de valores permitidos, copiadas de la referencia |
| `src/state.ts` | Estado en caché |
| `src/upgrades.ts` | Scripts de actualización de configuraciones antiguas |
