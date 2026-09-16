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
	level?: number
}

export interface RitaState {
	generator: GeneratorState
	dsp: Record<number, DspChannelState>
	measurements: Record<number, MeasurementState>
}

export const CHANNEL_COUNT = 8
export const ENGINE_COUNT = 8

export const DSP_PROPS = ['name', 'gain', 'delay', 'polarity']
export const ENGINE_PROPS = ['name', 'active', 'selected', 'delay', 'level']

export function createEmptyState(): RitaState {
	const state: RitaState = { generator: {}, dsp: {}, measurements: {} }
	for (let i = 1; i <= CHANNEL_COUNT; i++) state.dsp[i] = {}
	for (let i = 1; i <= ENGINE_COUNT; i++) state.measurements[i] = {}
	return state
}
