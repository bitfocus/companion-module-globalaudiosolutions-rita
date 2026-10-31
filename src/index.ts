import {
	InstanceBase,
	type CompanionActionSchemaWithoutResult,
	type CompanionFeedbackSchema,
	type CompanionOptionValues,
	type CompanionVariableValues,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { GetConfigFields, type ModuleConfig, type ModuleSecrets } from './config.js'
import { RitaClient, RitaError, wait, type ModuleInstanceLike } from './api.js'
import {
	ALIGN_APF_COUNT,
	ALIGN_APF_PROPS,
	AVERAGE_PROPS,
	CHANNEL_COUNT,
	DSP_PROPS,
	ENGINE_COUNT,
	OPTIONAL_SETTINGS_LABELS,
	OPTIONAL_SETTINGS_PROPS,
	asList,
	ENGINE_PROPS,
	MUTE_GROUP_COUNT,
	MUTE_GROUP_PROPS,
	SETTINGS_PROPS,
	createEmptyState,
	type RitaState,
} from './state.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { UpdateVariableDefinitions, UpdateVariableValues } from './variables.js'
import { UpgradeScripts } from './upgrades.js'

// The options of each action and each feedback, with the type Companion hands the callback:
// a dropdown answers the id of the chosen entry, which in this module is always text (the
// engine 1 is '1'), a text input answers text, a number field a number and a checkbox a
// boolean. Writing them down is what makes the compiler catch a mistyped option id.
/** A reply from RiTA: which fields it has depends on the target, so each one is checked as it is read. */
export type RitaReply = Record<string, any>

type Act<TOptions extends CompanionOptionValues> = CompanionActionSchemaWithoutResult<TOptions>
type NoOptions = Record<string, never>

export type ActionsSchema = {
	generator_spectrum: Act<{ mode: string; engine: string }>
	generator_signal: Act<{ signal: string }>
	generator_gain: Act<{ gain: number }>
	generator_duration: Act<{ duration: string }>
	generator_outputs: Act<{ output1: number; output2: number }>
	settings_dsp_type: Act<{ value: string }>
	settings_dsp_model: Act<{ value: string; mode: string }>
	settings_dsp_mode: Act<{ value: string }>
	settings_fft_size_auto: Act<{ mode: string }>
	settings_export_position: Act<{ value: string }>
	settings_reference_mode: Act<{ value: string }>
	settings_measurement_mode: Act<{ value: string }>
	settings_fft_size: Act<{ value: string }>
	settings_window: Act<{ value: string }>
	settings_smoothing: Act<{ value: string }>
	settings_spectrum_averages: Act<{ value: string }>
	settings_averaging: Act<{ value: boolean }>
	settings_sum: Act<{ value: boolean }>
	settings_spectrum_plot: Act<{ value: string }>
	settings_coherence_threshold: Act<{ value: number }>
	measurement_capture: Act<{ engine: string }>
	measurement_active: Act<{ engine: string; mode: string }>
	measurement_find_delay: Act<{ engine: string; apply: boolean }>
	measurement_delay: Act<{ engine: string; delay: number }>
	measurement_inputs: Act<{ engine: string; measurementInput: number; referenceInput: number }>
	measurement_name: Act<{ engine: string; name: string }>
	measurement_sync_all: Act<NoOptions>
	measurement_clear_find: Act<NoOptions>
	measurement_clear_delays: Act<NoOptions>
	measurement_clear_all: Act<NoOptions>
	measurement_export_all: Act<NoOptions>
	mute_group: Act<{ group: string; mode: string }>
	average_active: Act<{ mode: string }>
	average_export: Act<{ name: string }>
	memory_capture: Act<{ engine: string }>
	memory_visible: Act<{ memory: string; mode: string }>
	memory_name: Act<{ memory: string; name: string }>
	memory_delete: Act<{ memory: string }>
	dsp_gain: Act<{ channel: string; gain: number }>
	dsp_gain_step: Act<{ channel: string; step: number }>
	dsp_delay: Act<{ channel: string; delay: number }>
	dsp_polarity: Act<{ channel: string; mode: string }>
	dsp_name: Act<{ channel: string; name: string }>
	dsp_clear: Act<{ channel: string }>
	dsp_peq: Act<{
		channel: string
		slot: number
		enabled: boolean
		filterType: string
		frequency: number
		gain: number
		order: number
		q: number
	}>
	dsp_peq_enabled: Act<{ channel: string; slot: number; mode: string }>
	dsp_align_apf: Act<{
		channel: string
		slot: string
		enabled: boolean
		frequency: number
		order: number
		q: number
	}>
	dsp_align_apf_enabled: Act<{ channel: string; slot: string; mode: string }>
	dsp_highpass: Act<{ channel: string; filterType: string; frequency: number; order: number; q: number }>
	dsp_lowpass: Act<{ channel: string; filterType: string; frequency: number; order: number; q: number }>
	raw_command: Act<{ action: string; target: string; properties: string }>
}

export type FeedbacksSchema = {
	connected: CompanionFeedbackSchema<NoOptions>
	generator_running: CompanionFeedbackSchema<NoOptions>
	generator_signal: CompanionFeedbackSchema<{ signal: string }>
	mute_group_muted: CompanionFeedbackSchema<{ group: string }>
	mute_group_available: CompanionFeedbackSchema<{ group: string }>
	average_active: CompanionFeedbackSchema<NoOptions>
	average_has_data: CompanionFeedbackSchema<NoOptions>
	settings_dsp_type: CompanionFeedbackSchema<{ value: string }>
	settings_reference_mode: CompanionFeedbackSchema<{ value: string }>
	settings_measurement_mode: CompanionFeedbackSchema<{ value: string }>
	sync_active: CompanionFeedbackSchema<NoOptions>
	sync_possible: CompanionFeedbackSchema<NoOptions>
	measurement_active: CompanionFeedbackSchema<{ engine: string }>
	measurement_selected: CompanionFeedbackSchema<{ engine: string }>
	dsp_polarity: CompanionFeedbackSchema<{ channel: string }>
	dsp_align_apf_enabled: CompanionFeedbackSchema<{ channel: string; slot: string }>
}

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
/** Whether a request failed because of the password, which is the same for every target. */
function isPasswordProblem(err: unknown): boolean {
	if (err instanceof RitaError) return err.code === 'incorrect password' || err.code === 'too many attempts'
	return err instanceof Error && err.message.includes('requires a password')
}

// How the log names each of the three Preferences settings that reshape the DSP.
const DSP_FOLLOW_LABELS = { dspType: 'type is now', dspModel: 'model is now', dspMode: 'mode is now' }

export default class ModuleInstance extends InstanceBase<ModuleSchema> implements ModuleInstanceLike {
	config!: ModuleConfig
	secrets!: ModuleSecrets
	rita!: RitaClient
	state: RitaState = createEmptyState()

	private pollTimer: NodeJS.Timeout | undefined
	private levelTimer: NodeJS.Timeout | undefined
	private resumeTimer: NodeJS.Timeout | undefined
	// A settings save or a disabled connection must stop the waits that are still running.
	private destroyed = false
	private polling = false
	private overviewPolling = false
	private eventsSupported = false
	// Older RiTA versions have no alignapf or average object: stop asking once they answer unknown target.
	private alignApfSupported = true
	private averageSupported = true
	private muteGroupsSupported = true
	// The Preferences settings that arrived after RiTA 2.8.0: no entry until this RiTA has answered
	// for that property, so one that failed for another reason is asked again on the slow resync.
	private optional = new Map<string, 'supported' | 'absent'>()

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets ?? {}
		UpdateActions(this)
		UpdateFeedbacks(this)
		UpdateVariableDefinitions(this)
		UpdatePresets(this)
		this.startClient()
	}

	async destroy(): Promise<void> {
		this.destroyed = true
		this.stopPolling()
		if (this.resumeTimer) clearTimeout(this.resumeTimer)
		this.resumeTimer = undefined
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

	/** settings properties this RiTA actually has: naming one it does not fails the whole get. */
	private settingsProps(): string[] {
		const extra = OPTIONAL_SETTINGS_PROPS.filter((prop) => this.optional.get(prop) === 'supported')
		return extra.length ? [...SETTINGS_PROPS, ...extra] : SETTINGS_PROPS
	}

	/** Each one on its own, so a RiTA without it does not take the other settings down with it. */
	private async probeOptionalSettings(): Promise<void> {
		for (const prop of OPTIONAL_SETTINGS_PROPS) {
			if (this.optional.has(prop)) continue
			try {
				const response = await this.rita.send('get', 'settings', [prop])
				if (response?.[prop] !== undefined) {
					this.optional.set(prop, 'supported')
					this.applyResponse('settings', response)
				}
			} catch (err) {
				const label = OPTIONAL_SETTINGS_LABELS[prop] ?? prop
				if (err instanceof RitaError && err.code === 'unknown property') {
					this.optional.set(prop, 'absent')
					this.log('info', `This RiTA has no ${label} in Preferences: the action that sets it is refused`)
				} else {
					this.log('debug', `Probe ${prop}: ${(err as Error).message}`)
				}
			}
		}
	}

	/** A DSP Type change converts the filters of the eight channels, so what was read is stale. */
	private async rereadDspAfterTypeChange(): Promise<void> {
		for (let i = 1; i <= CHANNEL_COUNT; i++) await this.refresh(`dsp/out/${i}`, DSP_PROPS)
		await this.pollAlignApf()
		UpdateVariableValues(this)
		this.checkAllFeedbacks()
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
			const before = {
				dspType: this.state.settings.dspType,
				dspModel: this.state.settings.dspModel,
				dspMode: this.state.settings.dspMode,
			}
			Object.assign(this.state.settings, body)
			// The type, the model and its mode all convert the filters of the eight channels and
			// switch off what the new one does not have, so whatever was read is stale. RiTA says
			// what it dropped in the notices of its own answer; this is about the cached values.
			const changed = (Object.keys(before) as (keyof typeof before)[]).filter((key) => {
				const now = this.state.settings[key]
				return before[key] !== undefined && now !== undefined && now !== before[key]
			})
			if (changed.length) {
				// The model and the mode go empty when the type stops being a processor: naming them
				// would only put "null" in the log.
				const what =
					changed
						.filter((key) => this.state.settings[key] != null)
						.map((key) => `${DSP_FOLLOW_LABELS[key]} ${this.state.settings[key]}`)
						.join(', ') || 'changed'
				this.log(
					'info',
					`DSP ${what}: the Q of the bells and the shelvings and the frequency of the Bessel cuts are now the ` +
						'numbers of that model, and whatever it does not have is off. Reading the channels again',
				)
				void this.rereadDspAfterTypeChange()
			}
		} else if (target === 'average') {
			Object.assign(this.state.average, body)
		} else if ((match = target.match(/^dsp\/out\/(\d+)$/))) {
			Object.assign((this.state.dsp[Number(match[1])] ??= {}), body)
		} else if ((match = target.match(/^measurements\/(\d+)$/))) {
			Object.assign((this.state.measurements[Number(match[1])] ??= {}), body)
		} else if ((match = target.match(/^muteGroups\/(\d+)$/))) {
			Object.assign((this.state.muteGroups[Number(match[1])] ??= {}), body)
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

	/** RiTA changes settings on its own: picking Spectrum moves fftSize off 64 FPPO. */
	async refreshSettings(): Promise<void> {
		await this.refresh('settings', this.settingsProps())
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
			this.logNotices(status)
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
		// The capture that was running belongs to the old connection: its report would arrive
		// on the new one, with the time of a measurement nobody is waiting for any more.
		if (this.resumeTimer) clearTimeout(this.resumeTimer)
		this.resumeTimer = undefined
		this.rita?.destroy()
		this.eventsSupported = false
		this.optional = new Map()
		this.state = createEmptyState()
		UpdateVariableValues(this)
		this.rita = new RitaClient(this)
		this.rita.connect()
	}

	private async startSync(): Promise<void> {
		const client = this.rita
		await this.probeOptionalSettings()
		await this.subscribeAll()
		await this.poll()
		if (client === this.rita && client.connected) this.startPolling()
	}

	private async subscribeAll(): Promise<void> {
		this.eventsSupported = true
		this.alignApfSupported = true
		this.averageSupported = true
		this.muteGroupsSupported = true
		const targets: [string, string[] | undefined][] = [
			['generator', undefined],
			['settings', this.settingsProps()],
			['average', AVERAGE_PROPS],
		]
		for (let i = 1; i <= CHANNEL_COUNT; i++) targets.push([`dsp/out/${i}`, DSP_PROPS])
		for (let i = 1; i <= ENGINE_COUNT; i++) targets.push([`measurements/${i}`, ENGINE_EVENT_PROPS])
		for (let i = 1; i <= CHANNEL_COUNT; i++) {
			for (let k = 1; k <= ALIGN_APF_COUNT; k++) targets.push([`dsp/out/${i}/alignapf/${k}`, ALIGN_APF_PROPS])
		}
		for (let i = 1; i <= MUTE_GROUP_COUNT; i++) targets.push([`muteGroups/${i}`, MUTE_GROUP_PROPS])

		for (const [target, properties] of targets) {
			const isAlignApf = target.includes('/alignapf/')
			const isAverage = target === 'average'
			const isMuteGroup = target.startsWith('muteGroups/')
			if (
				(isAlignApf && !this.alignApfSupported) ||
				(isAverage && !this.averageSupported) ||
				(isMuteGroup && !this.muteGroupsSupported)
			) {
				continue
			}
			try {
				const response = await this.rita.send('subscribe', target, properties)
				this.applyResponse(target, response?.state)
			} catch (err) {
				// A password problem is the same for every target: saying it once beats 39 identical
				// lines in the log, which is what the eight channels and their filters produced.
				if (isPasswordProblem(err)) {
					this.log('warn', `Cannot subscribe: ${(err as Error).message}`)
					return
				}
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
				if (isMuteGroup && err instanceof RitaError && err.code === 'unknown target') {
					this.muteGroupsSupported = false
					this.log('info', 'This RiTA has no mute groups')
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
			await this.probeOptionalSettings()
			this.applyResponse('settings', await read('settings', this.settingsProps()))

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
			await this.pollMuteGroups()

			UpdateVariableValues(this)
			this.checkAllFeedbacks()
		} finally {
			this.polling = false
		}
	}

	/** Export is asynchronous: how it went shows up in exportStatus of the measurements object. */
	async waitForExport(label: string, signal?: AbortSignal): Promise<Record<string, any> | undefined> {
		// The export belongs to this connection and to the button that asked for it: a settings
		// save, a disabled connection or an aborted button stop the wait instead of asking on.
		const client = this.rita
		for (let i = 0; i < 120; i++) {
			await wait(1000, signal)
			if (this.destroyed || client !== this.rita) return undefined
			if (signal?.aborted) throw new Error(`${label}: the button was stopped`)
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

	private async pollMuteGroups(): Promise<void> {
		if (!this.muteGroupsSupported) return
		try {
			const all = await this.rita.send('get', 'muteGroups')
			for (const group of asList<any>(all?.groups)) {
				const index = Number(group.index)
				if (index) Object.assign((this.state.muteGroups[index] ??= {}), group)
			}
		} catch (err) {
			if (err instanceof RitaError && err.code === 'unknown target') this.muteGroupsSupported = false
			else this.log('debug', `Poll muteGroups: ${(err as Error).message}`)
		}
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
		} catch (err) {
			this.log('debug', `Poll measurements: ${(err as Error).message}`)
		} finally {
			this.overviewPolling = false
		}
	}

	/** Message boxes RiTA would have shown: it answers instead of waiting for an OK, and says so here. */
	logNotices(response: RitaReply | undefined): void {
		for (const notice of asList<any>(response?.notices)) {
			const answer = notice?.answer ? ` (answered ${notice.answer})` : ''
			this.log('warn', `RiTA: ${notice?.title ?? ''} ${notice?.message ?? ''}${answer}`.trim())
		}
	}

	/**
	 * The measurements list, as answered by get and by syncAll, clearFind, clearDelays and
	 * clearAll. One pass for the eight engines, and one refresh of the variables and feedbacks
	 * at the end. With ownRequest the caller writes its own log line, so a sync that grew
	 * because of this module is not announced as something that happened in RiTA.
	 */
	applyOverview(overview: RitaReply | undefined, ownRequest = false): void {
		if (!overview || typeof overview !== 'object') return
		{
			for (const engine of asList<any>(overview.measurements)) {
				const index = Number(engine.index)
				if (!index) continue
				Object.assign((this.state.measurements[index] ??= {}), {
					name: engine.name,
					active: engine.active,
					selected: engine.selected,
					delay: engine.delay,
					dspDelay: engine.dspDelay,
					level: engine.level,
				})
			}
		}
		if (typeof overview.synced === 'boolean') this.state.sync.synced = overview.synced
		if (typeof overview.canSync === 'boolean') this.state.sync.canSync = overview.canSync
		if (typeof overview.syncCount === 'number') {
			const previous = this.state.sync.syncCount
			this.state.sync.syncCount = overview.syncCount
			if (!ownRequest && previous !== undefined && overview.syncCount > previous) {
				this.log('info', 'Sync All done in RiTA')
			}
		}
		UpdateVariableValues(this)
		this.checkAllFeedbacks()
	}
}
