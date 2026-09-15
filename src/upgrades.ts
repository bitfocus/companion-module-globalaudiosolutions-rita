import type { CompanionStaticUpgradeScript } from '@companion-module/base'
import type { ModuleConfig, ModuleSecrets } from './config.js'

// Once released, an upgrade script can never be removed.
export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig, ModuleSecrets>[] = []
