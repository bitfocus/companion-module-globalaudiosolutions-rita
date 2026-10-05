# companion-module-globalaudiosolutions-rita

Módulo de [Bitfocus Companion](https://bitfocus.io/companion) para controlar RiTA (Global Audio Solutions) a través de su API WebSocket v1.

La ayuda para el usuario de Companion está en [companion/HELP.md](companion/HELP.md).

## Requisitos

- **RiTA 2.8.0 o posterior**, con la API arrancada. El módulo sigue `sdk/referencia.md` de RiTA.
- **Companion 4.3 o posterior**, porque está hecho con `@companion-module/base` 2.x.

## Instalar en Companion

1. En Companion, pestaña **Modules** → **Import module package**.
2. Elegir `globalaudiosolutions-rita-<versión>.tgz`.
3. Pestaña **Connections** → buscar **RiTA** → **Add**.

## Generar el paquete

Requiere Node.js 22 y yarn 4 (con `corepack enable`, o `corepack yarn ...` sin permisos de administrador).

```bash
yarn install
```

```bash
yarn package
```

Deja `globalaudiosolutions-rita-<versión>.tgz` en esta carpeta. La versión sale de `package.json`.

Sin RiTA a mano, se puede levantar el servidor de pruebas en MATLAB:

```matlab
addpath(genpath('<ruta>\RiTA_Matlab\software'))
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
