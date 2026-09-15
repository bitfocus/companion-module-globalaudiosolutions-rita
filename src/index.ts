import {
	InstanceBase,
	type CompanionActionSchemaWithoutResult,
	type CompanionFeedbackSchema,
	type CompanionOptionValues,
	type CompanionVariableValues,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { GetConfigFields, type ModuleConfig, type ModuleSecrets } from './config.js'
import { RitaClient, type ModuleInstanceLike } from './api.js'
import { CHANNEL_COUNT, ENGINE_COUNT, createEmptyState, type RitaState } from './state.js'
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

export default class ModuleInstance extends InstanceBase<ModuleSchema> implements ModuleInstanceLike {
	config!: ModuleConfig
	secrets!: ModuleSecrets
	rita!: RitaClient
	state: RitaState = createEmptyState()

	private pollTimer: NodeJS.Timeout | undefined
	private resumeTimer: NodeJS.Timeout | undefined
	private polling = false

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
		void this.poll()
		this.startPolling()
	}

	onDisconnected(): void {
		this.stopPolling()
		this.checkFeedbacks('connected')
	}

	/** Merges the object RiTA returns after a set into the cached state. */
	applyResponse(target: string | undefined, response: unknown): void {
		if (!target || !response || typeof response !== 'object') return
		const body = response as Record<string, any>
		// findDelay with apply:false reports a delay without setting it.
		if (body.applied === false) return

		let match: RegExpMatchArray | null
		if (target === 'generator') {
			Object.assign(this.state.generator, body)
		} else if ((match = target.match(/^dsp\/out\/(\d+)$/))) {
			Object.assign((this.state.dsp[Number(match[1])] ??= {}), body)
		} else if ((match = target.match(/^measurements\/(\d+)$/))) {
			Object.assign((this.state.measurements[Number(match[1])] ??= {}), body)
		} else {
			return
		}
		UpdateVariableValues(this)
		this.checkAllFeedbacks()
	}

	/** RiTA stops answering while it measures: hold polling, then report how the capture went. */
	afterCapture(engine: number, estimatedSeconds: unknown): void {
		this.stopPolling()
		if (this.resumeTimer) clearTimeout(this.resumeTimer)
		const seconds = Number(estimatedSeconds)
		const waitMs = (Number.isFinite(seconds) && seconds > 0 ? seconds : 10) * 1000 + 1500
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
		this.state = createEmptyState()
		UpdateVariableValues(this)
		this.rita = new RitaClient(this)
		this.rita.connect()
	}

	private startPolling(): void {
		this.stopPolling()
		const interval = Number(this.config.pollInterval)
		if (!interval || interval <= 0) return
		this.pollTimer = setInterval(() => void this.poll(), Math.max(interval, 250))
	}

	private stopPolling(): void {
		if (this.pollTimer) clearInterval(this.pollTimer)
		this.pollTimer = undefined
	}

	private async logApiVersion(): Promise<void> {
		try {
			const versions = await this.rita.send('get', 'apiVersions')
			this.log('info', `RiTA API versions: ${JSON.stringify(versions)}`)
		} catch (err) {
			this.log('debug', `Could not read apiVersions: ${(err as Error).message}`)
		}
	}

	// RiTA has no change notifications, so state that feedbacks and variables show is polled.
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

			// A bare get of dsp/out/N also dumps its 4 PEQs and both crossovers.
			for (let i = 1; i <= CHANNEL_COUNT; i++) {
				const channel = await read(`dsp/out/${i}`, ['name', 'gain', 'delay', 'polarity'])
				if (channel) this.state.dsp[i] = channel
			}
			for (let i = 1; i <= ENGINE_COUNT; i++) {
				const engine = await read(`measurements/${i}`, ['name', 'active', 'selected', 'delay', 'level'])
				if (engine) this.state.measurements[i] = engine
			}

			UpdateVariableValues(this)
			this.checkAllFeedbacks()
		} finally {
			this.polling = false
		}
	}
}
