export interface GeneratorState {
	running?: boolean
	signal?: string
	gain?: number
	duration?: string
	output1?: string
	output2?: string
}

export interface DspChannelState {
	name?: string
	gain?: number
	delay?: number
	polarity?: boolean
}

export interface MeasurementState {
	name?: string
	active?: boolean
	selected?: boolean
	delay?: number
	// The arrival of the measurement; dspDelay is the delay of the DSP channel, what Sync All writes.
	dspDelay?: number
	level?: number
}

export interface AlignApfState {
	enabled?: boolean
	frequency?: number
	order?: number
	q?: number
}

export interface AverageState {
	active?: boolean
	count?: number
	hasData?: boolean
	engines?: number[]
	mode?: string
	name?: string
}

export interface SettingsState {
	dspType?: string
	fftSize?: string
	window?: string
	smoothing?: string
	spectrumAverages?: string
	averaging?: boolean
	sum?: boolean
	coherenceThreshold?: number
}

export interface MuteGroupState {
	name?: string
	muted?: boolean
	available?: boolean
}

export interface SyncState {
	synced?: boolean
	syncCount?: number
	canSync?: boolean
}

export interface RitaState {
	generator: GeneratorState
	settings: SettingsState
	sync: SyncState
	dsp: Record<number, DspChannelState>
	measurements: Record<number, MeasurementState>
	alignApf: Record<number, Record<number, AlignApfState>>
	average: AverageState
	muteGroups: Record<number, MuteGroupState>
}

export const CHANNEL_COUNT = 8
export const ENGINE_COUNT = 8
export const ALIGN_APF_COUNT = 2
// The 4 assignable mute buttons of the external processor; the channels are assigned in RiTA.
export const MUTE_GROUP_COUNT = 4
export const MUTE_GROUP_PROPS = ['name', 'muted', 'available']

export const DSP_PROPS = ['name', 'gain', 'delay', 'polarity']
export const ENGINE_PROPS = ['name', 'active', 'selected', 'delay', 'level']
export const ALIGN_APF_PROPS = ['enabled', 'frequency', 'order', 'q']
export const AVERAGE_PROPS = ['active', 'count', 'hasData', 'engines', 'mode', 'name']
// The DSP Type of Preferences > DSP, added to the API after RiTA 2.8.0. It is deliberately
// NOT in SETTINGS_PROPS: a get that names a property its RiTA does not have fails the whole
// request with "unknown property", which would leave every settings variable empty. It is
// asked for on its own and only added to the list once RiTA has answered it.
export const DSP_TYPE_PROP = 'dspType'

// RiTA changes fftSize on its own when Live TF starts with smoothing on, so it is followed, never restored.
export const SETTINGS_PROPS = [
	'fftSize',
	'window',
	'smoothing',
	'spectrumAverages',
	'averaging',
	'sum',
	'coherenceThreshold',
]

export function createEmptyState(): RitaState {
	const state: RitaState = {
		generator: {},
		settings: {},
		sync: {},
		dsp: {},
		measurements: {},
		alignApf: {},
		average: {},
		muteGroups: {},
	}
	for (let i = 1; i <= MUTE_GROUP_COUNT; i++) state.muteGroups[i] = {}
	for (let i = 1; i <= CHANNEL_COUNT; i++) {
		state.dsp[i] = {}
		state.alignApf[i] = {}
		for (let k = 1; k <= ALIGN_APF_COUNT; k++) state.alignApf[i][k] = {}
	}
	for (let i = 1; i <= ENGINE_COUNT; i++) state.measurements[i] = {}
	return state
}
