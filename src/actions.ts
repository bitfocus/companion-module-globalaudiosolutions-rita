import type { CompanionActionDefinitions } from '@companion-module/base'
import type ModuleInstance from './index.js'
import type { ActionsSchema } from './index.js'
import { RitaError, wait, type RitaAction } from './api.js'
import { AVERAGE_PROPS, DSP_PROPS, ENGINE_PROPS, asList } from './state.js'
import {
	ALIGN_APF_CHOICES,
	CHANNEL_CHOICES,
	DSP_MODEL_CHOICES,
	DSP_TYPE_CHOICES,
	DURATION_CHOICES,
	MUTE_GROUP_CHOICES,
	ENGINE_CHOICES,
	FFT_SIZE_CHOICES,
	MEASUREMENT_MODE_CHOICES,
	ON_OFF_TOGGLE_CHOICES,
	PEQ_TYPE_CHOICES,
	peqType,
	RAW_ACTION_CHOICES,
	REFERENCE_MODE_CHOICES,
	SIGNAL_CHOICES,
	SMOOTHING_CHOICES,
	SPECTRUM_AVERAGES_CHOICES,
	SPECTRUM_PLOT_CHOICES,
	WINDOW_CHOICES,
	XOVER_TYPE_CHOICES,
} from './choices.js'

// RiTA refuses these while a find holds a delay that would not fit the new window.
const FIND_HINT = {
	'unknown value': 'RiTA refused the value; if a find is in place, clear it first with Measurement: clear find',
}

// From RiTA 2.8.1 the Spectrum signal has no 64 FPPO, and choosing Spectrum moves the size
// to 32768 by itself.
const FFT_SIZE_HINT = {
	'unknown value':
		'RiTA refused the FFT size. 128 FPPO and anything above 32768 need Auto FFT size on, and only up to the engine size of the moment, the one the Engine size variable shows; the Spectrum signal has none of those and no 64 FPPO either; and if a find is in place, a size that does not fit its delay is refused too: clear it with Measurement: clear find',
}

// DSP Type reached the API after RiTA 2.8.0, and the list of processors can grow.
const DSP_TYPE_HINT = {
	'unknown property': 'This RiTA has no DSP Type (Preferences > DSP): it needs a newer version',
	'unknown value': 'RiTA does not know that DSP type; this one has RiTA, Kingray, Marani and Galaxy',
}

// The two Preferences modes also reached the API after RiTA 2.8.0.
const MODE_HINT = {
	'unknown property': 'This RiTA does not have that mode in Preferences: it needs a newer version',
}

// From RiTA 2.8.1, with a processor in the DSP Type the cuts are checked against its mode,
// exactly like RiTA's own screen: a type or an order that mode does not have is refused
// instead of being moved to the nearest one, as the real RiTA used to do.
const XOVER_HINT = {
	'unknown value':
		'RiTA refused it. With a processor as DSP type, the crossover type and its order have to be ones that model and mode have; NXF only exists on some of them',
}

// Auto FFT size arrived with RiTA 2.8.1 as well.
const FFT_AUTO_HINT = {
	'unknown property': 'This RiTA has no Auto FFT size (Preferences): it needs 2.8.1 or later',
}

// The position of the exported files also arrived with 2.8.1, and before that it was a field
// on RiTA's own screen that the API could not write.
const POSITION_HINT = {
	'unknown property':
		'This RiTA has no export position: it needs 2.8.1 or later, where the Position field moved to the API',
}

// The Marani model and its mode arrived with RiTA 2.8.1.
const DSP_MODEL_HINT = {
	'unknown property': 'This RiTA has no DSP model or mode (Preferences > DSP): it needs 2.8.1 or later',
	// From RiTA 2.8.1 a mode asked for with DSP type RiTA answers this too, instead of an internal error.
	'unknown value':
		'RiTA refused it: the model has to be one of its own list, and the mode one of the modes of that model, written exactly as RiTA writes it. With DSP type RiTA there are no modes at all',
}

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
	expressionDescription: 'Channel number as text, 1 to 8',
} as const

const engineOption = {
	type: 'dropdown',
	id: 'engine',
	label: 'Engine',
	default: '1',
	choices: ENGINE_CHOICES,
	// In expression mode the result has to be the number as text, '1' to '8': a number does
	// not match the list and Companion skips the action.
	expressionDescription: 'Engine number as text, 1 to 8',
} as const

// On, Off or Toggle is a choice, not a value to compute: an expression here would have to
// give exactly 'on', 'off' or 'toggle', and anything else makes Companion skip the action
// without saying why. Two buttons, or On and Off in one, do the same job and always work.
const modeOption = {
	type: 'dropdown',
	id: 'mode',
	label: 'Action',
	default: 'toggle',
	choices: ON_OFF_TOGGLE_CHOICES,
	disableAutoExpression: true,
} as const

const memoryOption = {
	type: 'textinput',
	id: 'memory',
	label: 'Memory number or name',
	default: '1',
	useVariables: true,
} as const

const apfSlotOption = {
	type: 'dropdown',
	id: 'slot',
	label: 'Alignment APF',
	default: '1',
	choices: ALIGN_APF_CHOICES,
	expressionDescription: 'APF number as text, 1 or 2',
} as const

const slotOption = {
	type: 'number',
	id: 'slot',
	label: 'Filter (1-20)',
	default: 1,
	min: 1,
	max: 20,
	asInteger: true,
} as const

export function UpdateActions(self: ModuleInstance): void {
	// Errors from RiTA (busy, unknown value, ...) are logged instead of thrown into Companion.
	// hints: a friendlier text for a given RiTA error code, instead of the bare code.
	// RiTA puts in note what it changed beyond what was asked: a channel shared by the eight
	// engines, the engines it turned off. Several of them come joined with '; '.
	const logNote = (target: string | undefined, response: any): void => {
		if (typeof response?.note !== 'string' || !response.note) return
		const engine = target?.match(/^measurements\/(\d+)$/)
		self.log('info', `${engine ? `Engine ${engine[1]}` : (target ?? 'RiTA')}: ${response.note}`)
	}

	const send = async (
		action: RitaAction,
		target?: string,
		properties?: unknown,
		hints?: Record<string, string>,
	): Promise<any> => {
		try {
			const response = await self.rita.send(action, target, properties)
			if (action === 'set' || action === 'findDelay') self.applyResponse(target, response)
			self.logNotices(response)
			logNote(target, response)
			return response
		} catch (err) {
			if (err instanceof RitaError && hints?.[err.code]) {
				self.log('warn', `${action} ${target ?? ''}: ${hints[err.code]}`)
				return undefined
			}
			// 'busy' is RiTA holding everything until it finishes: a single-shot measurement, a find
			// or an export all, asked for from here or from RiTA's own window. The request is refused
			// whole and nothing of it is applied, so pressing the button again when it ends is enough.
			if (err instanceof RitaError && err.code === 'busy') {
				self.log(
					'warn',
					`${action} ${target ?? ''}: RiTA is busy with a measurement, a find or an export, and changed nothing. Wait for it to finish`,
				)
				return undefined
			}
			// A linked channel (Link DSP in RiTA) follows its master, and the linked parts are read only.
			if (err instanceof RitaError && err.code === 'find in place') {
				self.log('warn', 'Clear delays needs the find cleared first: use Measurement: clear find')
				return undefined
			}
			if (err instanceof RitaError && err.code === 'read only' && target?.startsWith('dsp/out/')) {
				// Since RiTA 2.8.1 each channel has a number of bands in use (the Bands dropdown of the
				// Equalizer window): a filter above it cannot be switched on, and RiTA answers the same
				// code as a linked channel. The band count cannot be read, so both causes are named.
				const slot = target.match(/^dsp\/out\/\d+\/peq\/(\d+)$/)
				const props = properties as Record<string, unknown> | undefined
				// Only switching a filter ON hits the band limit; switching it off never does.
				if (slot && props && typeof props === 'object' && props.enabled === true) {
					self.log(
						'warn',
						`${target}: filter ${slot[1]} could not be switched. Either it is above the bands in use for that ` +
							'channel in RiTA (Equalizer window, Bands), or the EQ of the channel is linked to another one',
					)
					return undefined
				}
				self.log('warn', `${target}: read only, this part of the channel is linked to another one in RiTA`)
				return undefined
			}
			self.log('warn', `${action} ${target ?? ''} failed: ${(err as Error).message}`)
			return undefined
		}
	}

	// The name of an engine and the name of its DSP channel are one field in RiTA, and a set is
	// answered with how the field ended up: from RiTA 2.8.1 a name another
	// engine already has is not repeated, and the text is trimmed.
	const logName = (what: string, asked: string, response: any): void => {
		const kept = response?.name
		if (typeof kept !== 'string' || kept === asked) return
		self.log(
			'info',
			`${what} is called "${kept}", not "${asked}": RiTA does not repeat the name of another engine, and it trims the text`,
		)
	}

	// A single measurement (Sweep, Multi Sweep, Pink, External) holds the sound card and the
	// signal file it is playing, so from RiTA 2.8.1 the signal, the gain and
	// the duration answer 'busy' while it runs and nothing of the request is applied: in RiTA
	// those same controls are greyed out. On an earlier RiTA they went through and the
	// measurement could be lost. Spectrum never blocks them: writing the signal stops it.
	const generatorBusy = {
		busy:
			'a single measurement is running (Sweep, Multi Sweep, Pink or External) and RiTA changed nothing: the ' +
			'signal, the gain and the duration have to wait until it finishes. Spectrum does not block them',
	}

	// Sweep, Multi Sweep, Pink and External measure once and block RiTA until done;
	// Spectrum and Live TF answer continuous:true and keep running until the generator is stopped.
	const capture = async (engine: number): Promise<void> => {
		const response = await send('capture', `measurements/${engine}`, undefined, {
			'generator running':
				'a continuous measurement is running: stop it first with Generator: Spectrum on / off, or by choosing another signal, which from RiTA 2.8.1 stops it',
		})
		if (!response) return
		if (response.continuous) {
			self.log('info', `${response.signal ?? 'Continuous measurement'} running on engine ${engine}`)
			await self.refresh('generator')
			await self.refreshEngines()
		} else {
			self.afterCapture(engine, response.estimatedSeconds)
		}
	}

	const crossoverOptions = (defaultFrequency: number) =>
		[
			channelOption,
			{
				type: 'dropdown',
				id: 'filterType',
				label: 'Type',
				default: 'Linkwitz-Riley',
				choices: XOVER_TYPE_CHOICES,
				tooltip: 'NXF only on the Marani models and modes that have it; with the rest it is refused',
			},
			{ type: 'number', id: 'frequency', label: 'Frequency (Hz)', default: defaultFrequency, min: 20, max: 20000 },
			{
				type: 'number',
				id: 'order',
				label: 'Order (Linkwitz-Riley: even only). On NXF, 1 to 8 is the attenuation, not dB/oct',
				default: 4,
				min: 1,
				max: 8,
				asInteger: true,
			},
			// In a crossover this is not a Q: it is the passband ripple in dB on Chebyshev I and
			// Eliptic, the stopband attenuation in dB on Chebyshev II, and ignored by the rest.
			{
				type: 'number',
				id: 'q',
				label: 'Ripple or attenuation (dB), Chebyshev and Eliptic only',
				default: 1,
				min: 0.1,
				max: 120,
				step: 0.1,
			},
		] as const

	const actions: CompanionActionDefinitions<ActionsSchema> = {
		generator_spectrum: {
			name: 'Generator: Spectrum on / off',
			description:
				'On: selects Spectrum and measures it continuously on the chosen engine, adding it to the ones already running. Off: stops it.',
			options: [modeOption, engineOption],
			callback: async ({ options }) => {
				const { running, signal } = self.state.generator
				if (!resolveBool(options.mode, running === true && signal === 'Spectrum')) {
					await send('set', 'generator', { running: false })
					return
				}
				if (signal !== 'Spectrum') {
					if (!(await send('set', 'generator', { signal: 'Spectrum' }, generatorBusy))) return
					// Choosing Spectrum moves the FFT size off 64 FPPO, so what was read is stale.
					await self.refreshSettings()
				}
				await capture(Number(options.engine ?? 1))
			},
		},
		generator_signal: {
			name: 'Generator: set signal',
			description:
				'From RiTA 2.8.1, choosing another signal while Spectrum is running stops it, so the next ' +
				'capture measures. RiTA takes about a second and a half to stop, and the module shows it the moment it does. A ' +
				'single measurement, on the other hand, is not interrupted: that same RiTA refuses the signal and changes ' +
				'nothing while it runs, and the log says so.',
			options: [{ type: 'dropdown', id: 'signal', label: 'Signal', default: 'Sweep', choices: SIGNAL_CHOICES }],
			callback: async ({ options }) => {
				if (await send('set', 'generator', { signal: options.signal }, generatorBusy)) await self.refreshSettings()
			},
		},
		generator_gain: {
			name: 'Generator: set gain',
			description:
				'While a single measurement is running, RiTA 2.8.1 and later refuse this and change nothing: the ' +
				'log says so, and the button works again as soon as the measurement ends.',
			options: [{ type: 'number', id: 'gain', label: 'Gain (dB)', default: -24, min: -48, max: 0, step: 0.5 }],
			callback: async ({ options }) => {
				await send('set', 'generator', { gain: Number(options.gain) }, generatorBusy)
			},
		},
		generator_duration: {
			name: 'Generator: set duration',
			description:
				'The length of the sweep, which with Auto FFT size on is also the engine size. While a single measurement is ' +
				'running, RiTA 2.8.1 and later refuse this and change nothing, because the duration makes the ' +
				'signal again.',
			options: [{ type: 'dropdown', id: 'duration', label: 'Duration', default: '2', choices: DURATION_CHOICES }],
			callback: async ({ options }) => {
				if (!(await send('set', 'generator', { duration: options.duration }, generatorBusy))) return
				// With Auto FFT size the engine keeps the next power of two above the sweep, so the
				// duration moves the engine size and the FFT size with it.
				if (self.state.settings.fftSizeAuto) await self.refreshSettings()
			},
		},
		generator_outputs: {
			name: 'Generator: set outputs',
			description:
				'Sound card output channels. RiTA only accepts channels the card has, and the two outputs cannot be the same.',
			options: [
				{ type: 'number', id: 'output1', label: 'Output 1', default: 1, min: 1, max: 64, asInteger: true },
				{ type: 'number', id: 'output2', label: 'Output 2', default: 2, min: 1, max: 64, asInteger: true },
			],
			callback: async ({ options }) => {
				const output1 = String(options.output1)
				const output2 = String(options.output2)
				if (output1 === output2) {
					self.log('warn', 'Generator outputs: the two outputs cannot be the same channel')
					return
				}
				await send(
					'set',
					'generator',
					{ output1, output2 },
					{
						'unknown value':
							'RiTA refused these outputs: the card must have them, and swapping the two at once needs a third channel in between',
					},
				)
			},
		},

		settings_dsp_type: {
			name: 'Settings: DSP type',
			description:
				'The DSP Type of Preferences > DSP: the filter model RiTA draws and computes its DSP with, its own or the one ' +
				'of a processor. RiTA converts the filters of the eight channels so the curves do not change, which moves the Q ' +
				'of the bells and the shelvings and the frequency of the Bessel cuts. Needs RiTA 2.8.0 or later.',
			options: [
				{
					type: 'dropdown',
					id: 'value',
					label: 'DSP type',
					default: 'RiTA',
					choices: DSP_TYPE_CHOICES,
					allowCustom: true,
					tooltip: 'A newer RiTA may know more processors: type the name in',
				},
			],
			callback: async ({ options }) => {
				await send('set', 'settings', { dspType: options.value }, DSP_TYPE_HINT)
			},
		},
		settings_dsp_model: {
			name: 'Settings: DSP model',
			description:
				'The Marani model of Preferences > DSP. Setting it puts RiTA in Marani with that model and its default mode, ' +
				'or with the mode written here. The model and its mode decide which EQ filter types there are and whether the ' +
				'cuts have NXF; filters of a type the new model does not have are switched off, and RiTA says which in the ' +
				'log. Needs RiTA 2.8.1 or later.',
			options: [
				{
					type: 'dropdown',
					id: 'value',
					label: 'Model',
					default: 'Marani MIR A',
					choices: DSP_MODEL_CHOICES,
					allowCustom: true,
					tooltip: 'A newer RiTA may know more models: type the name in',
				},
				{
					type: 'textinput',
					id: 'mode',
					label: 'Mode (optional, exactly as RiTA writes it)',
					default: '',
					useVariables: true,
				},
			],
			callback: async ({ options }) => {
				// RiTA checks the pair together, so a model and a mode go in the same message.
				const mode = String(options.mode ?? '').trim()
				const properties = mode ? { dspModel: options.value, dspMode: mode } : { dspModel: options.value }
				await send('set', 'settings', properties, DSP_MODEL_HINT)
			},
		},
		settings_dsp_mode: {
			name: 'Settings: DSP mode',
			description:
				'The mode of the processor channel: IN or OUT and, on a Marani, its EQ and crossover mode, exactly as RiTA ' +
				'writes it, for example "OUT: XOVER-IIR + 8 PEQ". The labels depend on the model and there is no way to list ' +
				'them over the API, so they are typed in; $(rita:settings_dsp_mode) shows the one in use. The mode limits the ' +
				'PEQ bands, the cuts and their slopes, and the FIR. With DSP type RiTA there are no modes. ' +
				'Needs RiTA 2.8.1 or later.',
			options: [{ type: 'textinput', id: 'value', label: 'Mode', default: '', useVariables: true }],
			callback: async ({ options }) => {
				const mode = String(options.value ?? '').trim()
				if (!mode) {
					self.log('warn', 'Settings: DSP mode needs the mode as RiTA writes it, for example OUT: XOVER-IIR + 8 PEQ')
					return
				}
				await send('set', 'settings', { dspMode: mode }, DSP_MODEL_HINT)
			},
		},
		settings_fft_size_auto: {
			name: 'Settings: Auto FFT size on / off',
			description:
				'The Normal / Auto FFT Size switch of Preferences. On, each engine keeps the next power of two above the sweep ' +
				'length, from 65536 to 262144 samples, the FFT size list gains those sizes and 128 FPPO, and the channel delay ' +
				'reaches as far as the engine lasts: 680 ms for every 32768 samples at 48 kHz (5440 with 262144), ' +
				'half of that at 96 kHz. Off, each engine goes back to 32768 and the ' +
				'measurements are cut to it. RiTA says in the log what it had to change. Needs RiTA 2.8.1 or later.',
			options: [modeOption],
			callback: async ({ options }) => {
				const wanted = resolveBool(options.mode, self.state.settings.fftSizeAuto)
				if (!(await send('set', 'settings', { fftSizeAuto: wanted }, FFT_AUTO_HINT))) return
				// It moves the engine size and with it the FFT size, so the settings are read again.
				await self.refreshSettings()
			},
		},
		settings_export_position: {
			name: 'Settings: export position',
			description:
				'The position written after the name of every file the module exports: the engines of Measurement: export all ' +
				'and the impulse of AVG: export impulse. It stays until it is changed, and empty means no position. RiTA has no ' +
				'field for it any more, so this is the only way to set it. Up to 60 characters, and whatever a file name cannot ' +
				'have becomes a dash. Needs RiTA 2.8.1 or later.',
			options: [
				{
					type: 'textinput',
					id: 'value',
					label: 'Position (empty, none)',
					default: '',
					useVariables: true,
				},
			],
			callback: async ({ options }) => {
				const asked = String(options.value ?? '')
				const response = await send('set', 'settings', { exportPosition: asked }, POSITION_HINT)
				// RiTA cleans it up, so the log says what it really kept.
				const kept = response?.exportPosition
				if (typeof kept === 'string' && kept !== asked) {
					self.log('info', kept ? `Export position stored as "${kept}"` : 'Export position cleared')
				}
			},
		},
		settings_reference_mode: {
			name: 'Settings: reference mode',
			description:
				'The reference channel mode of Preferences. With 1 Ref. Channel the eight engines share the reference input, ' +
				'so setting it on one engine sets it on all of them. Needs RiTA 2.8.0 or later.',
			options: [
				{
					type: 'dropdown',
					id: 'value',
					label: 'Reference mode',
					default: '1 Ref. Channel',
					choices: REFERENCE_MODE_CHOICES,
				},
			],
			callback: async ({ options }) => {
				await send('set', 'settings', { referenceMode: options.value }, MODE_HINT)
			},
		},
		settings_measurement_mode: {
			name: 'Settings: measurement mode',
			description:
				'The measurement channel mode of Preferences. With 1 Meas. Channel the eight engines share the measurement ' +
				'input and turning one engine on turns the others off. RiTA also puts itself in that mode when a two-input ' +
				'sound card is chosen. Needs RiTA 2.8.0 or later.',
			options: [
				{
					type: 'dropdown',
					id: 'value',
					label: 'Measurement mode',
					default: '1 Meas. Channel',
					choices: MEASUREMENT_MODE_CHOICES,
				},
			],
			callback: async ({ options }) => {
				// With one measurement channel RiTA leaves a single engine on, so the buttons have to be read again.
				if (await send('set', 'settings', { measurementMode: options.value }, MODE_HINT)) {
					await self.refreshEngines()
				}
			},
		},
		settings_fft_size: {
			name: 'Settings: FFT size',
			options: [{ type: 'dropdown', id: 'value', label: 'FFT size', default: '16384', choices: FFT_SIZE_CHOICES }],
			callback: async ({ options }) => {
				await send('set', 'settings', { fftSize: options.value }, FFT_SIZE_HINT)
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
				await send('set', 'settings', { smoothing: options.value }, FIND_HINT)
			},
		},
		settings_spectrum_averages: {
			name: 'Settings: spectrum averages',
			options: [{ type: 'dropdown', id: 'value', label: 'Averages', default: '1', choices: SPECTRUM_AVERAGES_CHOICES }],
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
				'Turns the engine on and measures with the current signal. Sweep, Multi Sweep, Pink and External measure once ' +
				'and RiTA does not answer anything else until they finish. Spectrum keeps measuring until the generator is stopped.',
			options: [engineOption],
			callback: async ({ options }) => {
				await capture(Number(options.engine))
			},
		},
		measurement_active: {
			name: 'Measurement: activate engine',
			description:
				'In 1 Meas. Channel mode RiTA turns the other engines off when one is turned on, except with the Spectrum ' +
				'signal, and the module writes to the log which ones it turned off.',
			options: [engineOption, modeOption],
			callback: async ({ options }) => {
				const engine = Number(options.engine)
				const response = await send('set', `measurements/${engine}`, {
					active: resolveBool(options.mode, self.state.measurements[engine]?.active),
				})
				if (response) await self.refreshEngines()
			},
		},
		measurement_find_delay: {
			name: 'Measurement: find delay',
			options: [engineOption, { type: 'checkbox', id: 'apply', label: 'Apply the delay found', default: true }],
			callback: async ({ options }, context) => {
				const engine = Number(options.engine)
				const response = await send('findDelay', `measurements/${engine}`, options.apply ? undefined : { apply: false })
				if (!response) return
				if (response.status === 'searching') {
					// With Live TF running RiTA searches in the background and writes the result to delay.
					const seconds = Number(response.estimatedSeconds)
					self.log('info', `Engine ${engine}: searching delay with Live TF`)
					await wait((seconds > 0 ? seconds : 3) * 1000 + 1000, context.signal)
					if (context.signal.aborted) throw new Error(`Engine ${engine}: the button was stopped`)
					await self.refresh(`measurements/${engine}`, ['delay'])
					self.log('info', `Engine ${engine} delay: ${self.state.measurements[engine]?.delay} ms`)
					return
				}
				self.log('info', `Engine ${engine} delay: ${response.delay} ms${response.applied ? ' (applied)' : ''}`)
				if (response.warning) self.log('warn', `Engine ${engine} find delay: ${response.warning}`)
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
			description:
				'Sound card input channels of the engine. In 1 Ref. Channel mode RiTA applies the reference input to all eight engines.',
			options: [
				engineOption,
				{
					type: 'number',
					id: 'measurementInput',
					label: 'Measurement input',
					default: 1,
					min: 1,
					max: 64,
					asInteger: true,
				},
				{
					type: 'number',
					id: 'referenceInput',
					label: 'Reference input',
					default: 2,
					min: 1,
					max: 64,
					asInteger: true,
				},
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
			description:
				'The engine and its DSP channel have one name, so this is the same as DSP: rename channel. From RiTA ' +
				'2.8.1 a name another engine already has is not repeated: it takes the first free ' +
				'one, Bajo and then Bajo_1, and the log says what RiTA kept. An empty name, and Name, can be repeated.',
			options: [engineOption, { type: 'textinput', id: 'name', label: 'Name', default: '', useVariables: true }],
			callback: async ({ options }) => {
				const asked = String(options.name)
				const response = await send('set', `measurements/${options.engine}`, { name: asked })
				logName(`Engine ${options.engine}`, asked, response)
			},
		},

		mute_group: {
			name: 'Mute group: mute / unmute',
			description:
				'One of the 4 mute buttons of the external processor. Toggle does what the button in RiTA does: it unmutes the group when every channel is muted, and mutes it otherwise. The channels of each group are assigned in RiTA.',
			options: [
				{
					type: 'dropdown',
					id: 'group',
					label: 'Mute group',
					default: '1',
					choices: MUTE_GROUP_CHOICES,
					expressionDescription: 'Mute group number as text, 1 to 8',
				},
				modeOption,
			],
			callback: async ({ options }) => {
				const group = Number(options.group)
				const target = `muteGroups/${group}`
				const hints = { 'no channels': 'this mute group has no channels on a connected processor' }
				const response =
					options.mode === 'toggle'
						? await send('toggle', target, undefined, hints)
						: await send('set', target, { muted: options.mode === 'on' }, hints)
				if (!response) return
				self.applyResponse(target, response)
				const failed = asList<string>(response.failed)
				if (failed.length) self.log('warn', `Mute group ${group}: did not reach ${failed.join(', ')}`)
			},
		},

		average_active: {
			name: 'AVG: on / off',
			description: 'The AVG button: averages the selected engines. The same control as Settings: averaging on/off.',
			options: [modeOption],
			callback: async ({ options }) => {
				await send('set', 'average', { active: resolveBool(options.mode, self.state.average.active) })
			},
		},
		average_export: {
			name: 'AVG: export impulse',
			description:
				'Exports the impulse response of the average to the Memory Bank folder, in the format chosen in RiTA. ' +
				'Characters not allowed in file names become "-"; an empty name exports as AVG.',
			options: [{ type: 'textinput', id: 'name', label: 'File name', default: 'AVG', useVariables: true }],
			callback: async ({ options }, context) => {
				const response = await send('export', 'average', { name: String(options.name ?? '') })
				if (!response) return
				self.log('info', `Exporting AVG as "${response.name}" (${response.format}) to ${response.folder}`)
				const status = await self.waitForExport(`AVG export "${response.name}"`, context.signal)
				if (status) self.log('info', `AVG exported as "${status.name || response.name}"`)
				await self.refresh('average', AVERAGE_PROPS)
			},
		},
		measurement_sync_all: {
			name: 'Measurement: sync all',
			description:
				"RiTA's Sync All (button and Y shortcut): aligns with each other the engines that already have a measurement. " +
				'It does not touch AVG, and it does nothing while a sync is already in place: clear the find first.',
			options: [],
			callback: async () => {
				const before = self.state.sync.syncCount
				const response = await send('syncAll', 'measurements')
				// RiTA answers a one-engine list as the engine alone, so the list is made once here
				// and used everywhere below.
				const list = asList<any>(response?.measurements)
				if (!list.length) return
				// With a sync already in place RiTA does nothing and answers the same syncCount.
				if (response.synced === true && before !== undefined && response.syncCount === before) {
					self.log('warn', 'Sync all: a sync is already in place, clear it first with Measurement: clear find')
					self.applyOverview(response)
					return
				}
				// One pass for the eight engines, instead of rebuilding every variable eight times.
				self.applyOverview(response, true)
				const aligned = list.filter((m) => m.active).map((m) => `${m.name} ${m.delay} ms`)
				self.log('info', `Sync all: ${aligned.length ? aligned.join(', ') : 'done'}`)
			},
		},
		measurement_clear_find: {
			name: 'Measurement: clear find',
			description: "RiTA's Clear Find: removes the sync left by Sync All.",
			options: [],
			callback: async () => {
				const response = await send('clearFind', 'measurements')
				if (response) self.applyOverview(response)
			},
		},
		measurement_clear_delays: {
			name: 'Measurement: clear delays',
			description:
				"RiTA's Clear delays: sets the DSP delay of the 8 channels to 0. As in RiTA it is refused while a sync is in place: clear the find first.",
			options: [],
			callback: async () => {
				const response = await send('clearDelays', 'measurements')
				if (response) self.applyOverview(response)
			},
		},
		measurement_clear_all: {
			name: 'Measurement: clear everything',
			description:
				"RiTA's Clear with Everything, and with no dialog: it wipes the measurements, the DSP and the names of all the channels.",
			options: [],
			callback: async () => {
				const response = await send('clearAll', 'measurements')
				if (response) {
					self.applyOverview(response)
					self.log('info', 'Cleared everything: measurements, DSP and names')
				}
			},
		},
		measurement_export_all: {
			name: 'Measurement: export all',
			description:
				'Export All of RiTA: exports the selected engines to the project folder, in the format chosen in RiTA. ' +
				'With a Position set in RiTA, each file is named <engine>_<position>.',
			options: [],
			callback: async (_event, context) => {
				const response = await send('exportAll', 'measurements')
				if (!response) return
				const engines = Array.isArray(response.measurements)
					? `engines ${response.measurements.join(', ')}`
					: `${response.measurements} engines`
				const position = response.position ? `, position "${response.position}"` : ''
				self.log('info', `Exporting ${engines} (${response.format}${position}) to ${response.folder}`)
				if (await self.waitForExport('Export all', context.signal)) self.log('info', 'Export all finished')
			},
		},

		memory_capture: {
			name: 'Memory: store trace from engine',
			description:
				"The memory takes the engine's name, and from RiTA 2.8.1 a name already in the " +
				'table takes the first free one instead: Main, then Main_1, Main_2. The log says which row it is ' +
				'and what it ended up called, which is the name the other Memory actions take.',
			options: [engineOption],
			callback: async ({ options }) => {
				const response = await send('capture', 'memories', { measurement: Number(options.engine) })
				if (!response) return
				// RiTA 2.8.1 answers the name the row ended up with, but every RiTA
				// before that one answers the name it asked for and renames the row afterwards, so the
				// table is read back: with either of them the log says what the memory is really called.
				const list = await send('get', 'memories')
				const row = asList<any>(list?.memories).find((m) => Number(m?.index) === Number(response.index))
				const name = typeof row?.name === 'string' && row.name ? row.name : response.name
				self.log(
					'info',
					`Stored engine ${response.measurement ?? options.engine} as memory ${response.index} "${name}"`,
				)
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
				{ type: 'number', id: 'gain', label: 'Gain (dB)', default: 0, min: -60, max: 60, step: 0.1 },
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
					self.log('warn', `DSP channel ${channel} gain is not known yet`)
					return
				}
				const next = Math.min(60, Math.max(-60, Math.round((current + Number(options.step)) * 100) / 100))
				await send('set', `dsp/out/${channel}`, { gain: next })
			},
		},
		dsp_delay: {
			name: 'DSP: set channel delay',
			options: [
				channelOption,
				{
					type: 'number',
					id: 'delay',
					label: 'Delay (ms). Over 680 needs Auto FFT size; then it reaches the engine length, half as far at 96 kHz',
					default: 0,
					min: 0,
					max: 5440,
					step: 0.01,
				},
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
			description:
				'The same name as the engine of that channel, the one Measurement: rename engine writes: a name ' +
				'another channel already has is not repeated from RiTA 2.8.1.',
			options: [channelOption, { type: 'textinput', id: 'name', label: 'Name', default: '', useVariables: true }],
			callback: async ({ options }) => {
				const asked = String(options.name)
				const response = await send('set', `dsp/out/${options.channel}`, { name: asked })
				logName(`DSP channel ${options.channel}`, asked, response)
			},
		},
		dsp_clear: {
			name: 'DSP: clear channel',
			description:
				'Same as the Clear button of the row: resets the channel and also clears that engine measurement. ' +
				'On a linked channel it also undoes the link, as RiTA does, and without asking.',
			options: [channelOption],
			callback: async ({ options }) => {
				const channel = Number(options.channel)
				if ((await send('clear', `dsp/out/${channel}`)) === undefined) return
				await self.refresh(`dsp/out/${channel}`, DSP_PROPS)
				await self.refresh(`measurements/${channel}`, ENGINE_PROPS)
			},
		},
		dsp_peq: {
			name: 'DSP: set EQ filter',
			description:
				'One of the 20 filters of the Equalizer window. A filter that is not enabled is stored but does not sound. ' +
				'Each type uses only some of the fields, and only the ones it uses are sent: the rest are left alone. With a ' +
				'Marani, which types exist depends on its model and mode, and one it does not have answers "unknown value".',
			options: [
				channelOption,
				slotOption,
				{ type: 'checkbox', id: 'enabled', label: 'Enabled', default: true },
				{
					type: 'dropdown',
					id: 'filterType',
					label: 'Type',
					default: 'Parametric',
					choices: PEQ_TYPE_CHOICES,
					allowCustom: true,
					tooltip: 'Only Parametric, Low Shelf, High Shelf, APF and FIR RevPhase exist with DSP type RiTA',
				},
				{ type: 'number', id: 'frequency', label: 'Frequency (Hz)', default: 1000, min: 20, max: 20000 },
				{
					type: 'number',
					id: 'gain',
					label: 'Gain (dB), bells and shelvings only',
					default: 0,
					min: -20,
					max: 20,
					step: 0.1,
				},
				{
					type: 'number',
					id: 'order',
					label: 'Order, APF and FIR RevPhase only',
					default: 1,
					min: 1,
					max: 2,
					asInteger: true,
				},
				{
					type: 'number',
					id: 'q',
					label: 'Q, or the slope in dB/oct (6-12) on the Slope shelvings',
					default: 1,
					min: 0.1,
					max: 128,
					step: 0.01,
				},
			],
			callback: async ({ options }) => {
				const type = String(options.filterType)
				const info = peqType(type)
				const properties: Record<string, unknown> = {
					type,
					enabled: options.enabled !== false,
					frequency: Number(options.frequency),
				}
				// Only the fields that type uses: a cut has no gain, and only the all-pass and the
				// FIR RevPhase have an order. A type this module does not know (a newer RiTA) gets
				// the usual pair, gain and Q.
				if (!info || info.gain) properties.gain = Number(options.gain)
				if (info?.width === 'order') properties.order = Number(options.order)
				if (!info || info.width === 'q' || info.width === 'slope') properties.q = Number(options.q)
				await send('set', `dsp/out/${options.channel}/peq/${Number(options.slot)}`, properties)
			},
		},
		dsp_peq_enabled: {
			name: 'DSP: EQ filter on / off',
			options: [channelOption, slotOption, modeOption],
			callback: async ({ options }) => {
				const target = `dsp/out/${options.channel}/peq/${Number(options.slot)}`
				let enabled = options.mode === 'on'
				if (options.mode === 'toggle') {
					const current = await send('get', target, ['enabled'])
					if (!current) return
					enabled = !current.enabled
				}
				await send('set', target, { enabled })
			},
		},
		dsp_align_apf: {
			name: 'DSP: set alignment APF',
			description:
				'One of the 2 alignment all-pass filters of the channel, separate from the 20 EQ filters. Auto Align replaces both on every run.',
			options: [
				channelOption,
				apfSlotOption,
				{ type: 'checkbox', id: 'enabled', label: 'Enabled', default: true },
				{ type: 'number', id: 'frequency', label: 'Frequency (Hz)', default: 1000, min: 20, max: 20000 },
				{ type: 'number', id: 'order', label: 'Order', default: 2, min: 1, max: 2, asInteger: true },
				{ type: 'number', id: 'q', label: 'Q', default: 0.7, min: 0.1, max: 10, step: 0.01 },
			],
			callback: async ({ options }) => {
				await send('set', `dsp/out/${options.channel}/alignapf/${options.slot}`, {
					enabled: options.enabled !== false,
					frequency: Number(options.frequency),
					order: Number(options.order),
					q: Number(options.q),
				})
			},
		},
		dsp_align_apf_enabled: {
			name: 'DSP: alignment APF on / off',
			options: [channelOption, apfSlotOption, modeOption],
			callback: async ({ options }) => {
				const channel = Number(options.channel)
				const slot = Number(options.slot)
				await send('set', `dsp/out/${channel}/alignapf/${slot}`, {
					enabled: resolveBool(options.mode, self.state.alignApf[channel]?.[slot]?.enabled),
				})
			},
		},
		dsp_highpass: {
			name: 'DSP: set high-pass',
			options: [...crossoverOptions(80)],
			callback: async ({ options }) => {
				await send(
					'set',
					`dsp/out/${options.channel}/highpass`,
					{
						type: options.filterType,
						frequency: Number(options.frequency),
						order: Number(options.order),
						q: Number(options.q),
					},
					XOVER_HINT,
				)
			},
		},
		dsp_lowpass: {
			name: 'DSP: set low-pass',
			options: [...crossoverOptions(120)],
			callback: async ({ options }) => {
				await send(
					'set',
					`dsp/out/${options.channel}/lowpass`,
					{
						type: options.filterType,
						frequency: Number(options.frequency),
						order: Number(options.order),
						q: Number(options.q),
					},
					XOVER_HINT,
				)
			},
		},

		raw_command: {
			name: 'Advanced: send API command',
			description: 'Sends any request to RiTA, for objects this module does not cover yet.',
			options: [
				{ type: 'dropdown', id: 'action', label: 'Action', default: 'get', choices: RAW_ACTION_CHOICES },
				{ type: 'textinput', id: 'target', label: 'Target', default: 'generator', useVariables: true },
				{
					type: 'textinput',
					id: 'properties',
					label: 'Properties (JSON, optional)',
					default: '',
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

	// Every callback is awaited by Companion, so a button that runs its actions one after
	// another waits for each one: the capture does not start before the signal is set. What
	// takes as long as the measurement is not the request, which RiTA answers at once with
	// the time it will take, but the report afterwards, which runs on its own timer
	// (afterCapture). Errors are already in the log, written by send with RiTA's reason.
	self.setActionDefinitions(actions)
}
