import {
	InstanceBase,
	type CompanionActionSchemaWithoutResult,
	type CompanionFeedbackSchema,
	type CompanionOptionValues,
	type CompanionVariableValues,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { GetConfigFields, type ModuleConfig, type ModuleSecrets } from './config.js'
import { RitaClient, RitaError, type ModuleInstanceLike } from './api.js'
import {
	ALIGN_APF_COUNT,
	ALIGN_APF_PROPS,
	AVERAGE_PROPS,
	CHANNEL_COUNT,
	DSP_PROPS,
	ENGINE_COUNT,
	ENGINE_PROPS,
	SETTINGS_PROPS,
	createEmptyState,
	type RitaState,
} from './state.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdateVariableDefinitions, UpdateVariableValues } from './variables.js'
import { UpgradeScripts } from './upgrades.js'

export type ActionsSchema = Record<string, CompanionActionSchemaWithoutResult<CompanionOptionValues>>
export type FeedbacksSchema = Record<string, CompanionFeedbackSchema<CompanionOptionValues>>

export type ModuleSchema = {
	config: ModuleConfig
	secrets: ModuleSecrets
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: CompanionVariableValues
}

export { UpgradeScripts }

// With change events, a slow full read catches anything missed, and its first request
// after a password change on RiTA is what triggers logging in again.
const RESYNC_MS = 30000
// level is a meter: subscribing to it would send an event every half second per engine.
const ENGINE_EVENT_PROPS = ENGINE_PROPS.filter((p) => p !== 'level')

export default class ModuleInstance extends InstanceBase<ModuleSchema> implements ModuleInstanceLike {
	config!: ModuleConfig
	secrets!: ModuleSecrets
	rita!: RitaClient
	state: RitaState = createEmptyState()

	private pollTimer: NodeJS.Timeout | undefined
	private levelTimer: NodeJS.Timeout | undefined
	private resumeTimer: NodeJS.Timeout | undefined
	private polling = false
	private overviewPolling = false
	private eventsSupported = false
	// Older RiTA versions have no alignapf or average object: stop asking once they answer unknown target.
	private alignApfSupported = true
	private averageSupported = true

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets ?? {}
		UpdateActions(this)
		UpdateFeedbacks(this)
		UpdateVariableDefinitions(this)
		this.startClient()
	}

	async destroy(): Promise<void> {
		this.stopPolling()
		if (this.resumeTimer) clearTimeout(this.resumeTimer)
		this.rita?.destroy()
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets ?? {}
		this.startClient()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	onConnected(): void {
		this.checkFeedbacks('connected')
		void this.logApiVersion()
		void this.startSync()
	}

	onDisconnected(): void {
		this.stopPolling()
		this.checkFeedbacks('connected')
	}

	onEvent(target: string, properties: Record<string, unknown>): void {
		this.applyResponse(target, properties)
	}

	/** Merges an object RiTA returned for a target into the cached state. */
	applyResponse(target: string | undefined, response: unknown): void {
		if (!target || !response || typeof response !== 'object') return
		const body = response as Record<string, any>
		// findDelay with apply:false reports a delay without setting it; with Live TF it only starts searching.
		if (body.applied === false || body.status === 'searching') return

		let match: RegExpMatchArray | null
		if (target === 'generator') {
			Object.assign(this.state.generator, body)
		} else if (target === 'settings') {
			Object.assign(this.state.settings, body)
		} else if (target === 'average') {
			Object.assign(this.state.average, body)
		} else if ((match = target.match(/^dsp\/out\/(\d+)$/))) {
			Object.assign((this.state.dsp[Number(match[1])] ??= {}), body)
		} else if ((match = target.match(/^measurements\/(\d+)$/))) {
			Object.assign((this.state.measurements[Number(match[1])] ??= {}), body)
		} else if ((match = target.match(/^dsp\/out\/(\d+)\/alignapf\/(\d+)$/))) {
			const channel = (this.state.alignApf[Number(match[1])] ??= {})
			Object.assign((channel[Number(match[2])] ??= {}), body)
		} else {
			return
		}
		UpdateVariableValues(this)
		this.checkAllFeedbacks()
	}

	/** Switching one engine can switch the others (Live TF runs on one engine only), so read them all. */
	async refreshEngines(): Promise<void> {
		for (let i = 1; i <= ENGINE_COUNT; i++) await this.refresh(`measurements/${i}`, ENGINE_EVENT_PROPS)
	}

	async refresh(target: string, properties?: string[]): Promise<void> {
		try {
			this.applyResponse(target, await this.rita.send('get', target, properties))
		} catch (err) {
			this.log('debug', `Refresh ${target}: ${(err as Error).message}`)
		}
	}

	/** RiTA stops answering while it measures: hold polling, then report how the capture went. */
	afterCapture(engine: number, estimatedSeconds: unknown): void {
		this.stopPolling()
		if (this.resumeTimer) clearTimeout(this.resumeTimer)
		const seconds = Number(estimatedSeconds)
		const waitMs = (Number.isFinite(seconds) && seconds > 0 ? seconds : 10) * 1000 + 1500
		this.rita.holdUntil(Date.now() + waitMs)
		this.resumeTimer = setTimeout(() => {
			this.resumeTimer = undefined
			if (!this.rita.connected) return
			void this.reportCapture(engine).finally(() => this.startPolling())
		}, waitMs)
	}

	private async reportCapture(engine: number): Promise<void> {
		try {
			const status = await this.rita.send('get', `measurements/${engine}`, ['captureStatus'])
			if (status.lastError) {
				this.log('error', `Capture on engine ${engine} failed: ${status.lastError} ${status.lastErrorAt ?? ''}`.trim())
			} else if (status.warning) {
				this.log('warn', `Capture on engine ${engine}: ${status.warning}`)
			} else {
				this.log('info', `Capture on engine ${engine} finished`)
			}
		} catch (err) {
			this.log('warn', `Could not read capture status: ${(err as Error).message}`)
		}
		await this.poll()
	}

	private startClient(): void {
		this.stopPolling()
		this.rita?.destroy()
		this.eventsSupported = false
		this.state = createEmptyState()
		UpdateVariableValues(this)
		this.rita = new RitaClient(this)
		this.rita.connect()
	}

	private async startSync(): Promise<void> {
		const client = this.rita
		await this.subscribeAll()
		await this.poll()
		if (client === this.rita && client.connected) this.startPolling()
	}

	private async subscribeAll(): Promise<void> {
		this.eventsSupported = true
		this.alignApfSupported = true
		this.averageSupported = true
		const targets: [string, string[] | undefined][] = [
			['generator', undefined],
			['settings', SETTINGS_PROPS],
			['average', AVERAGE_PROPS],
		]
		for (let i = 1; i <= CHANNEL_COUNT; i++) targets.push([`dsp/out/${i}`, DSP_PROPS])
		for (let i = 1; i <= ENGINE_COUNT; i++) targets.push([`measurements/${i}`, ENGINE_EVENT_PROPS])
		for (let i = 1; i <= CHANNEL_COUNT; i++) {
			for (let k = 1; k <= ALIGN_APF_COUNT; k++) targets.push([`dsp/out/${i}/alignapf/${k}`, ALIGN_APF_PROPS])
		}

		for (const [target, properties] of targets) {
			const isAlignApf = target.includes('/alignapf/')
			const isAverage = target === 'average'
			if ((isAlignApf && !this.alignApfSupported) || (isAverage && !this.averageSupported)) continue
			try {
				const response = await this.rita.send('subscribe', target, properties)
				this.applyResponse(target, response?.state)
			} catch (err) {
				if (err instanceof RitaError && err.code === 'unknown action') {
					this.eventsSupported = false
					this.log('info', 'This RiTA does not send change events: polling instead')
					return
				}
				if (isAlignApf && err instanceof RitaError && err.code === 'unknown target') {
					this.alignApfSupported = false
					this.log('info', 'This RiTA has no alignment APFs')
					continue
				}
				if (isAverage && err instanceof RitaError && err.code === 'unknown target') {
					this.averageSupported = false
					this.log('info', 'This RiTA has no average object')
					continue
				}
				this.log('warn', `Subscribe ${target}: ${(err as Error).message}`)
			}
		}
	}

	private startPolling(): void {
		this.stopPolling()
		const configured = Number(this.config.pollInterval)
		const interval = configured > 0 ? Math.max(configured, 250) : 0
		if (this.eventsSupported) {
			this.pollTimer = setInterval(() => void this.poll(), RESYNC_MS)
			if (interval) this.levelTimer = setInterval(() => void this.pollOverview(), interval)
		} else if (interval) {
			this.pollTimer = setInterval(() => void this.poll(), interval)
		}
	}

	private stopPolling(): void {
		clearInterval(this.pollTimer)
		clearInterval(this.levelTimer)
		this.pollTimer = undefined
		this.levelTimer = undefined
	}

	private async logApiVersion(): Promise<void> {
		try {
			const versions = await this.rita.send('get', 'apiVersions')
			this.log('info', `RiTA API versions: ${JSON.stringify(versions)}`)
		} catch (err) {
			this.log('debug', `Could not read apiVersions: ${(err as Error).message}`)
		}
	}

	private async poll(): Promise<void> {
		if (this.polling || !this.rita.connected) return
		this.polling = true
		try {
			const read = async (target: string, properties?: string[]): Promise<Record<string, any> | undefined> => {
				try {
					return await this.rita.send('get', target, properties)
				} catch (err) {
					this.log('debug', `Poll ${target}: ${(err as Error).message}`)
					return undefined
				}
			}

			const generator = await read('generator')
			if (generator) this.state.generator = generator
			this.applyResponse('settings', await read('settings', SETTINGS_PROPS))

			// A bare get of dsp/out/N also dumps its filters and FIRs.
			for (let i = 1; i <= CHANNEL_COUNT; i++) {
				const channel = await read(`dsp/out/${i}`, DSP_PROPS)
				if (channel) this.state.dsp[i] = channel
			}
			for (let i = 1; i <= ENGINE_COUNT; i++) {
				const engine = await read(`measurements/${i}`, ENGINE_PROPS)
				if (engine) this.state.measurements[i] = engine
			}
			this.applyOverview(await read('measurements'))
			await this.pollAlignApf()
			await this.pollAverage()

			UpdateVariableValues(this)
			this.checkAllFeedbacks()
		} finally {
			this.polling = false
		}
	}

	/** Export is asynchronous: how it went shows up in exportStatus of the measurements object. */
	async waitForExport(label: string): Promise<Record<string, any> | undefined> {
		for (let i = 0; i < 120; i++) {
			await new Promise((resolve) => setTimeout(resolve, 1000))
			let status: any
			try {
				status = (await this.rita.send('get', 'measurements'))?.exportStatus
			} catch {
				continue
			}
			if (!status || status.running) continue
			if (!status.lastError) return status
			this.log('warn', `${label} failed: ${status.lastError}`)
			return undefined
		}
		this.log('warn', `${label}: no result after 120 s`)
		return undefined
	}

	private async pollAverage(): Promise<void> {
		if (!this.averageSupported) return
		try {
			Object.assign(this.state.average, await this.rita.send('get', 'average', AVERAGE_PROPS))
		} catch (err) {
			if (err instanceof RitaError && err.code === 'unknown target') this.averageSupported = false
			else this.log('debug', `Poll average: ${(err as Error).message}`)
		}
	}

	private async pollAlignApf(): Promise<void> {
		for (let i = 1; i <= CHANNEL_COUNT; i++) {
			for (let k = 1; k <= ALIGN_APF_COUNT; k++) {
				if (!this.alignApfSupported) return
				try {
					const response = await this.rita.send('get', `dsp/out/${i}/alignapf/${k}`, ALIGN_APF_PROPS)
					Object.assign(((this.state.alignApf[i] ??= {})[k] ??= {}), response)
				} catch (err) {
					if (err instanceof RitaError && err.code === 'unknown target') this.alignApfSupported = false
					else this.log('debug', `Poll dsp/out/${i}/alignapf/${k}: ${(err as Error).message}`)
				}
			}
		}
	}

	// One request brings the 8 engines (level meters included) plus synced and syncCount,
	// which RiTA does not send as events.
	private async pollOverview(): Promise<void> {
		if (this.overviewPolling || this.polling || !this.rita.connected) return
		this.overviewPolling = true
		try {
			this.applyOverview(await this.rita.send('get', 'measurements'))
			UpdateVariableValues(this)
			this.checkAllFeedbacks()
		} catch (err) {
			this.log('debug', `Poll measurements: ${(err as Error).message}`)
		} finally {
			this.overviewPolling = false
		}
	}

	private applyOverview(overview: any): void {
		if (!overview || typeof overview !== 'object') return
		if (Array.isArray(overview.measurements)) {
			for (const engine of overview.measurements) {
				const index = Number(engine.index)
				if (!index) continue
				Object.assign((this.state.measurements[index] ??= {}), {
					name: engine.name,
					active: engine.active,
					selected: engine.selected,
					delay: engine.delay,
					level: engine.level,
				})
			}
		}
		if (typeof overview.synced === 'boolean') this.state.sync.synced = overview.synced
		if (typeof overview.syncCount === 'number') {
			const previous = this.state.sync.syncCount
			this.state.sync.syncCount = overview.syncCount
			if (previous !== undefined && overview.syncCount > previous) this.log('info', 'Sync All done in RiTA')
		}
	}
}
