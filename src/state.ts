export interface GeneratorState {
	running?: boolean
	signal?: string
	gain?: number
	duration?: string
	output1?: string
	output2?: string
	pinkNoise?: boolean
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
	level?: number
}

export interface AlignApfState {
	enabled?: boolean
	frequency?: number
	order?: number
	q?: number
}

export interface RitaState {
	generator: GeneratorState
	dsp: Record<number, DspChannelState>
	measurements: Record<number, MeasurementState>
	alignApf: Record<number, Record<number, AlignApfState>>
}

export const CHANNEL_COUNT = 8
export const ENGINE_COUNT = 8
export const ALIGN_APF_COUNT = 2

export const DSP_PROPS = ['name', 'gain', 'delay', 'polarity']
export const ENGINE_PROPS = ['name', 'active', 'selected', 'delay', 'level']
export const ALIGN_APF_PROPS = ['enabled', 'frequency', 'order', 'q']

export function createEmptyState(): RitaState {
	const state: RitaState = { generator: {}, dsp: {}, measurements: {}, alignApf: {} }
	for (let i = 1; i <= CHANNEL_COUNT; i++) {
		state.dsp[i] = {}
		state.alignApf[i] = {}
		for (let k = 1; k <= ALIGN_APF_COUNT; k++) state.alignApf[i][k] = {}
	}
	for (let i = 1; i <= ENGINE_COUNT; i++) state.measurements[i] = {}
	return state
}
