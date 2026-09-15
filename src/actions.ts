import type { CompanionActionDefinitions } from '@companion-module/base'
import type ModuleInstance from './index.js'
import type { ActionsSchema } from './index.js'
import type { RitaAction } from './api.js'
import {
	CHANNEL_CHOICES,
	DURATION_CHOICES,
	ENGINE_CHOICES,
	FFT_SIZE_CHOICES,
	FILTER_TYPE_CHOICES,
	GENERATOR_OUTPUT_CHOICES,
	ON_OFF_TOGGLE_CHOICES,
	PEQ_SLOT_CHOICES,
	RAW_ACTION_CHOICES,
	SIGNAL_CHOICES,
	SMOOTHING_CHOICES,
	SPECTRUM_AVERAGES_CHOICES,
	SPECTRUM_PLOT_CHOICES,
	WINDOW_CHOICES,
} from './choices.js'

function resolveBool(mode: unknown, current: boolean | undefined): boolean {
	if (mode === 'on') return true
	if (mode === 'off') return false
	return !current
}

const channelOption = {
	type: 'dropdown',
	id: 'channel',
	label: 'Channel',
	default: '1',
	choices: CHANNEL_CHOICES,
} as const

const engineOption = {
	type: 'dropdown',
	id: 'engine',
	label: 'Engine',
	default: '1',
	choices: ENGINE_CHOICES,
} as const

const modeOption = {
	type: 'dropdown',
	id: 'mode',
	label: 'Action',
	default: 'toggle',
	choices: ON_OFF_TOGGLE_CHOICES,
} as const

const memoryOption = {
	type: 'textinput',
	id: 'memory',
	label: 'Memory number or name',
	default: '1',
	useVariables: true,
} as const

export function UpdateActions(self: ModuleInstance): void {
	// Errors from RiTA (busy, unknown value, ...) are logged instead of thrown into Companion.
	const send = async (action: RitaAction, target?: string, properties?: unknown): Promise<any> => {
		try {
			const response = await self.rita.send(action, target, properties)
			if (action === 'set' || action === 'findDelay') self.applyResponse(target, response)
			return response
		} catch (err) {
			self.log('warn', `${action} ${target ?? ''} failed: ${(err as Error).message}`)
			return undefined
		}
	}

	const crossoverOptions = (defaultFrequency: number) => [
		channelOption,
		{ type: 'dropdown', id: 'filterType', label: 'Type', default: 'Linkwitz-Riley', choices: FILTER_TYPE_CHOICES },
		{ type: 'number', id: 'frequency', label: 'Frequency (Hz)', default: defaultFrequency, min: 1, max: 30000 },
		{ type: 'number', id: 'order', label: 'Order (Linkwitz-Riley: even only)', default: 4, min: 1, max: 8 },
		{ type: 'number', id: 'q', label: 'Q', default: 0.707, min: 0.01, max: 100, step: 0.01 },
	] as const

	const actions: CompanionActionDefinitions<ActionsSchema> = {
		generator_signal: {
			name: 'Generator: set signal',
			options: [{ type: 'dropdown', id: 'signal', label: 'Signal', default: 'Pink', choices: SIGNAL_CHOICES }],
			callback: async ({ options }) => {
				await send('set', 'generator', { signal: options.signal })
			},
		},
		generator_gain: {
			name: 'Generator: set gain',
			options: [{ type: 'number', id: 'gain', label: 'Gain (dB)', default: -24, min: -96, max: 0, step: 0.5 }],
			callback: async ({ options }) => {
				await send('set', 'generator', { gain: Number(options.gain) })
			},
		},
		generator_duration: {
			name: 'Generator: set sweep duration',
			options: [{ type: 'dropdown', id: 'duration', label: 'Duration', default: '2', choices: DURATION_CHOICES }],
			callback: async ({ options }) => {
				await send('set', 'generator', { duration: options.duration })
			},
		},
		generator_outputs: {
			name: 'Generator: set outputs',
			options: [
				{ type: 'dropdown', id: 'output1', label: 'Output 1', default: '1', choices: GENERATOR_OUTPUT_CHOICES },
				{ type: 'dropdown', id: 'output2', label: 'Output 2', default: '2', choices: GENERATOR_OUTPUT_CHOICES },
			],
			callback: async ({ options }) => {
				await send('set', 'generator', { output1: options.output1, output2: options.output2 })
			},
		},

		settings_fft_size: {
			name: 'Settings: FFT size',
			options: [{ type: 'dropdown', id: 'value', label: 'FFT size', default: '16384', choices: FFT_SIZE_CHOICES }],
			callback: async ({ options }) => {
				await send('set', 'settings', { fftSize: options.value })
			},
		},
		settings_window: {
			name: 'Settings: window',
			options: [{ type: 'dropdown', id: 'value', label: 'Window', default: 'Hann', choices: WINDOW_CHOICES }],
			callback: async ({ options }) => {
				await send('set', 'settings', { window: options.value })
			},
		},
		settings_smoothing: {
			name: 'Settings: smoothing',
			options: [{ type: 'dropdown', id: 'value', label: 'Smoothing', default: 'None', choices: SMOOTHING_CHOICES }],
			callback: async ({ options }) => {
				await send('set', 'settings', { smoothing: options.value })
			},
		},
		settings_spectrum_averages: {
			name: 'Settings: spectrum averages',
			options: [
				{ type: 'dropdown', id: 'value', label: 'Averages', default: '1', choices: SPECTRUM_AVERAGES_CHOICES },
			],
			callback: async ({ options }) => {
				await send('set', 'settings', { spectrumAverages: options.value })
			},
		},
		settings_averaging: {
			name: 'Settings: averaging on/off',
			options: [{ type: 'checkbox', id: 'value', label: 'Averaging', default: true }],
			callback: async ({ options }) => {
				await send('set', 'settings', { averaging: Boolean(options.value) })
			},
		},
		settings_sum: {
			name: 'Settings: sum on/off',
			options: [{ type: 'checkbox', id: 'value', label: 'Sum', default: true }],
			callback: async ({ options }) => {
				await send('set', 'settings', { sum: Boolean(options.value) })
			},
		},
		settings_spectrum_plot: {
			name: 'Settings: spectrum plot style',
			options: [{ type: 'dropdown', id: 'value', label: 'Plot', default: 'Line', choices: SPECTRUM_PLOT_CHOICES }],
			callback: async ({ options }) => {
				await send('set', 'settings', { spectrumPlot: options.value })
			},
		},
		settings_coherence_threshold: {
			name: 'Settings: coherence threshold',
			options: [{ type: 'number', id: 'value', label: 'Threshold (0-1)', default: 0.5, min: 0, max: 1, step: 0.01 }],
			callback: async ({ options }) => {
				await send('set', 'settings', { coherenceThreshold: Number(options.value) })
			},
		},

		measurement_capture: {
			name: 'Measurement: capture',
			description:
				'Turns the engine on and measures with the current generator signal (not Spectrum or TF). ' +
				'RiTA does not answer anything else until it finishes.',
			options: [engineOption],
			callback: async ({ options }) => {
				const engine = Number(options.engine)
				const response = await send('capture', `measurements/${engine}`)
				if (response) self.afterCapture(engine, response.estimatedSeconds)
			},
		},
		measurement_active: {
			name: 'Measurement: activate engine',
			options: [engineOption, modeOption],
			callback: async ({ options }) => {
				const engine = Number(options.engine)
				await send('set', `measurements/${engine}`, {
					active: resolveBool(options.mode, self.state.measurements[engine]?.active),
				})
			},
		},
		measurement_find_delay: {
			name: 'Measurement: find delay',
			options: [engineOption, { type: 'checkbox', id: 'apply', label: 'Apply the delay found', default: true }],
			callback: async ({ options }) => {
				const response = await send(
					'findDelay',
					`measurements/${options.engine}`,
					options.apply ? undefined : { apply: false },
				)
				if (!response) return
				self.log('info', `Engine ${options.engine} delay: ${response.delay} ms${response.applied ? ' (applied)' : ''}`)
				if (response.warning) self.log('warn', `Engine ${options.engine} find delay: ${response.warning}`)
			},
		},
		measurement_delay: {
			name: 'Measurement: set delay',
			options: [
				engineOption,
				{ type: 'number', id: 'delay', label: 'Delay (ms)', default: 0, min: -1000, max: 1000, step: 0.01 },
			],
			callback: async ({ options }) => {
				await send('set', `measurements/${options.engine}`, { delay: Number(options.delay) })
			},
		},
		measurement_inputs: {
			name: 'Measurement: set inputs',
			options: [
				engineOption,
				{ type: 'number', id: 'measurementInput', label: 'Measurement input', default: 1, min: 1, max: 64 },
				{ type: 'number', id: 'referenceInput', label: 'Reference input', default: 2, min: 1, max: 64 },
			],
			callback: async ({ options }) => {
				await send('set', `measurements/${options.engine}`, {
					measurementInput: Number(options.measurementInput),
					referenceInput: Number(options.referenceInput),
				})
			},
		},
		measurement_name: {
			name: 'Measurement: rename engine',
			options: [engineOption, { type: 'textinput', id: 'name', label: 'Name', default: '', useVariables: true }],
			callback: async ({ options }) => {
				await send('set', `measurements/${options.engine}`, { name: String(options.name) })
			},
		},

		memory_capture: {
			name: 'Memory: store trace from engine',
			options: [engineOption],
			callback: async ({ options }) => {
				await send('capture', 'memories', { measurement: Number(options.engine) })
			},
		},
		memory_visible: {
			name: 'Memory: show / hide',
			options: [memoryOption, modeOption],
			callback: async ({ options }) => {
				const target = `memories/${options.memory}`
				let visible = options.mode === 'on'
				if (options.mode === 'toggle') {
					const current = await send('get', target, ['visible'])
					if (!current) return
					visible = !current.visible
				}
				await send('set', target, { visible })
			},
		},
		memory_name: {
			name: 'Memory: rename',
			options: [memoryOption, { type: 'textinput', id: 'name', label: 'New name', default: '', useVariables: true }],
			callback: async ({ options }) => {
				await send('set', `memories/${options.memory}`, { name: String(options.name) })
			},
		},
		memory_delete: {
			name: 'Memory: delete',
			options: [memoryOption],
			callback: async ({ options }) => {
				await send('delete', `memories/${options.memory}`)
			},
		},

		dsp_gain: {
			name: 'DSP: set channel gain',
			options: [
				channelOption,
				{ type: 'number', id: 'gain', label: 'Gain (dB)', default: 0, min: -96, max: 24, step: 0.1 },
			],
			callback: async ({ options }) => {
				await send('set', `dsp/out/${options.channel}`, { gain: Number(options.gain) })
			},
		},
		dsp_gain_step: {
			name: 'DSP: adjust channel gain',
			options: [
				channelOption,
				{ type: 'number', id: 'step', label: 'Step (dB)', default: 1, min: -24, max: 24, step: 0.1 },
			],
			callback: async ({ options }) => {
				const channel = Number(options.channel)
				const current = self.state.dsp[channel]?.gain
				if (current === undefined) {
					self.log('warn', `DSP channel ${channel} gain is not known yet; enable polling or wait for it`)
					return
				}
				await send('set', `dsp/out/${channel}`, { gain: Math.round((current + Number(options.step)) * 100) / 100 })
			},
		},
		dsp_delay: {
			name: 'DSP: set channel delay',
			options: [
				channelOption,
				{ type: 'number', id: 'delay', label: 'Delay (ms)', default: 0, min: 0, max: 1000, step: 0.01 },
			],
			callback: async ({ options }) => {
				await send('set', `dsp/out/${options.channel}`, { delay: Number(options.delay) })
			},
		},
		dsp_polarity: {
			name: 'DSP: set channel polarity',
			options: [channelOption, { ...modeOption, label: 'Invert' }],
			callback: async ({ options }) => {
				const channel = Number(options.channel)
				await send('set', `dsp/out/${channel}`, {
					polarity: resolveBool(options.mode, self.state.dsp[channel]?.polarity),
				})
			},
		},
		dsp_name: {
			name: 'DSP: rename channel',
			options: [channelOption, { type: 'textinput', id: 'name', label: 'Name', default: '', useVariables: true }],
			callback: async ({ options }) => {
				await send('set', `dsp/out/${options.channel}`, { name: String(options.name) })
			},
		},
		dsp_peq: {
			name: 'DSP: set parametric EQ',
			options: [
				channelOption,
				{ type: 'dropdown', id: 'slot', label: 'Slot', default: '1', choices: PEQ_SLOT_CHOICES },
				{ type: 'dropdown', id: 'filterType', label: 'Type', default: 'Parametric', choices: FILTER_TYPE_CHOICES },
				{ type: 'number', id: 'frequency', label: 'Frequency (Hz)', default: 1000, min: 1, max: 30000 },
				{ type: 'number', id: 'gain', label: 'Gain (dB)', default: 0, min: -30, max: 30, step: 0.1 },
				{ type: 'number', id: 'q', label: 'Q (slope for shelving)', default: 1, min: 0.01, max: 100, step: 0.01 },
			],
			callback: async ({ options }) => {
				await send('set', `dsp/out/${options.channel}/peq/${options.slot}`, {
					type: options.filterType,
					frequency: Number(options.frequency),
					gain: Number(options.gain),
					q: Number(options.q),
				})
			},
		},
		dsp_highpass: {
			name: 'DSP: set high-pass',
			options: [...crossoverOptions(80)],
			callback: async ({ options }) => {
				await send('set', `dsp/out/${options.channel}/highpass`, {
					type: options.filterType,
					frequency: Number(options.frequency),
					order: Number(options.order),
					q: Number(options.q),
				})
			},
		},
		dsp_lowpass: {
			name: 'DSP: set low-pass',
			options: [...crossoverOptions(120)],
			callback: async ({ options }) => {
				await send('set', `dsp/out/${options.channel}/lowpass`, {
					type: options.filterType,
					frequency: Number(options.frequency),
					order: Number(options.order),
					q: Number(options.q),
				})
			},
		},

		raw_command: {
			name: 'Advanced: send API command',
			description: 'Sends any request to RiTA, for objects this module does not cover yet.',
			options: [
				{ type: 'dropdown', id: 'action', label: 'Action', default: 'set', choices: RAW_ACTION_CHOICES },
				{ type: 'textinput', id: 'target', label: 'Target', default: 'generator', useVariables: true },
				{
					type: 'textinput',
					id: 'properties',
					label: 'Properties (JSON, optional)',
					default: '{"running": true}',
					useVariables: true,
				},
			],
			callback: async ({ options }) => {
				const rawProps = String(options.properties ?? '').trim()
				let properties: unknown
				if (rawProps) {
					try {
						properties = JSON.parse(rawProps)
					} catch {
						self.log('warn', `Properties is not valid JSON: ${rawProps}`)
						return
					}
				}
				const target = String(options.target ?? '').trim()
				const response = await send(options.action as RitaAction, target || undefined, properties)
				if (response !== undefined) self.log('info', `${options.action} ${target}: ${JSON.stringify(response)}`)
			},
		},
	}

	self.setActionDefinitions(actions)
}
