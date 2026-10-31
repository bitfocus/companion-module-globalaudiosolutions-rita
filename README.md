# companion-module-globalaudiosolutions-rita

[Bitfocus Companion](https://bitfocus.io/companion) module to control RiTA (Global Audio Solutions) through its
WebSocket API v1.

The help for Companion users is in [companion/HELP.md](companion/HELP.md).

## Requirements

- **RiTA 2.8.0 or later**, with its API started. The module follows RiTA's own API reference.
- **Companion 5.0 or later**, because it is built with `@companion-module/base` 2.1 (module API 2.1).

## Installing in Companion

1. In Companion, **Modules** tab → **Import module package**.
2. Choose `globalaudiosolutions-rita-<version>.tgz`.
3. **Connections** tab → look for **RiTA** → **Add**.

## Building the package

Needs Node.js 26 and yarn 4 (`corepack enable`, or `corepack yarn ...` without administrator rights).

```bash
yarn install
```

```bash
yarn package
```

That leaves `globalaudiosolutions-rita-<version>.tgz` in this folder, with the version taken from `package.json`.

Other scripts: `yarn build` compiles to `dist`, `yarn lint` runs ESLint and `yarn format` runs Prettier.

With no RiTA at hand, its test server can be started from MATLAB:

```matlab
addpath(genpath('<path>\RiTA_Matlab\software'))
rapiStreamDemo(26101, 3600)
```

## Structure

| File               | Contents                                                               |
| ------------------ | ---------------------------------------------------------------------- |
| `src/index.ts`     | The module instance, its lifecycle and the state polling               |
| `src/api.ts`       | WebSocket client: port group, `sequenceNumber`, password, reconnection |
| `src/actions.ts`   | Actions                                                                |
| `src/feedbacks.ts` | Feedbacks                                                              |
| `src/variables.ts` | Variables                                                              |
| `src/choices.ts`   | The values RiTA accepts, copied from its reference                     |
| `src/state.ts`     | The cached state                                                       |
| `src/upgrades.ts`  | Upgrade scripts for configurations of earlier versions                 |
