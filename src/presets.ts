import { combineRgb, type CompanionButtonStyleProps, type CompanionPresetDefinitions } from '@companion-module/base'
import type { CompanionPresetSection } from '@companion-module/base'
import type ModuleInstance from './index.js'
import type { ModuleSchema } from './index.js'
import { CHANNEL_COUNT, ENGINE_COUNT, MUTE_GROUP_COUNT } from './state.js'

// The buttons a RiTA user builds by hand over and over: a capture per engine, the engines
// themselves, Sync All, AVG, the mute groups and the polarity and gain of the DSP channels.
// Each one carries the feedback that tells the user what RiTA has, so the button lights up.
const GREEN = { bgcolor: combineRgb(0, 153, 51), color: combineRgb(255, 255, 255) }
const RED = { bgcolor: combineRgb(204, 0, 0), color: combineRgb(255, 255, 255) }
const BLACK: CompanionButtonStyleProps = {
	text: '',
	size: 'auto',
	color: combineRgb(255, 255, 255),
	bgcolor: combineRgb(0, 0, 0),
}
const style = (text: string): CompanionButtonStyleProps => ({ ...BLACK, text })
const numbers = (count: number): string[] => Array.from({ length: count }, (_, i) => String(i + 1))

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions<ModuleSchema> = {
		generator_spectrum: {
			type: 'simple',
			name: 'Spectrum on / off',
			keywords: ['generator', 'spectrum', 'rta'],
			style: style('Spectrum\n$(rita:generator_signal)'),
			steps: [{ down: [{ actionId: 'generator_spectrum', options: { mode: 'toggle', engine: '1' } }], up: [] }],
			feedbacks: [{ feedbackId: 'generator_running', options: {}, style: GREEN }],
		},
		average_active: {
			type: 'simple',
			name: 'AVG on / off',
			keywords: ['average', 'avg'],
			style: style('AVG\n$(rita:average_count)'),
			steps: [{ down: [{ actionId: 'average_active', options: { mode: 'toggle' } }], up: [] }],
			feedbacks: [{ feedbackId: 'average_active', options: {}, style: GREEN }],
		},
		average_export: {
			type: 'simple',
			name: 'AVG export impulse',
			keywords: ['average', 'avg', 'export'],
			style: style('Export\nAVG'),
			steps: [{ down: [{ actionId: 'average_export', options: { name: 'AVG' } }], up: [] }],
			feedbacks: [{ feedbackId: 'average_has_data', options: {}, style: GREEN }],
		},
		measurement_sync_all: {
			type: 'simple',
			name: 'Sync all',
			keywords: ['sync', 'align'],
			style: style('Sync\nall'),
			steps: [{ down: [{ actionId: 'measurement_sync_all', options: {} }], up: [] }],
			feedbacks: [{ feedbackId: 'sync_active', options: {}, style: GREEN }],
		},
		measurement_clear_find: {
			type: 'simple',
			name: 'Clear find',
			keywords: ['sync', 'clear', 'find'],
			style: style('Clear\nfind'),
			steps: [{ down: [{ actionId: 'measurement_clear_find', options: {} }], up: [] }],
			feedbacks: [],
		},
		measurement_export_all: {
			type: 'simple',
			name: 'Export all',
			keywords: ['export'],
			style: style('Export\nall'),
			steps: [{ down: [{ actionId: 'measurement_export_all', options: {} }], up: [] }],
			feedbacks: [],
		},
	}

	// The signal buttons light up when RiTA has that signal selected.
	for (const signal of ['Sweep', 'Multi Sweep', 'Pink', 'Spectrum', 'External']) {
		presets[`generator_signal_${signal.replace(' ', '_').toLowerCase()}`] = {
			type: 'simple',
			name: `Signal: ${signal}`,
			keywords: ['generator', 'signal'],
			style: style(signal.replace(' ', '\n')),
			steps: [{ down: [{ actionId: 'generator_signal', options: { signal } }], up: [] }],
			feedbacks: [{ feedbackId: 'generator_signal', options: { signal }, style: GREEN }],
		}
	}

	for (const engine of numbers(ENGINE_COUNT)) {
		presets[`measurement_capture_${engine}`] = {
			type: 'simple',
			name: `Capture on engine ${engine}`,
			keywords: ['capture', 'measure', 'engine'],
			style: style(`Capture\n$(rita:meas_${engine}_name)`),
			steps: [{ down: [{ actionId: 'measurement_capture', options: { engine } }], up: [] }],
			feedbacks: [],
		}
		presets[`measurement_active_${engine}`] = {
			type: 'simple',
			name: `Engine ${engine} on / off`,
			keywords: ['engine', 'active'],
			style: style(`$(rita:meas_${engine}_name)\n$(rita:meas_${engine}_delay) ms`),
			steps: [{ down: [{ actionId: 'measurement_active', options: { engine, mode: 'toggle' } }], up: [] }],
			feedbacks: [{ feedbackId: 'measurement_active', options: { engine }, style: GREEN }],
		}
	}

	for (const group of numbers(MUTE_GROUP_COUNT)) {
		presets[`mute_group_${group}`] = {
			type: 'simple',
			name: `Mute group ${group}`,
			keywords: ['mute', 'group', 'processor'],
			style: style(`$(rita:mute_group_${group}_name)`),
			steps: [{ down: [{ actionId: 'mute_group', options: { group, mode: 'toggle' } }], up: [] }],
			feedbacks: [{ feedbackId: 'mute_group_muted', options: { group }, style: RED }],
		}
	}

	for (const channel of numbers(CHANNEL_COUNT)) {
		presets[`dsp_polarity_${channel}`] = {
			type: 'simple',
			name: `Channel ${channel} polarity`,
			keywords: ['dsp', 'polarity', 'invert'],
			style: style(`$(rita:dsp_${channel}_name)\nPol`),
			steps: [{ down: [{ actionId: 'dsp_polarity', options: { channel, mode: 'toggle' } }], up: [] }],
			feedbacks: [{ feedbackId: 'dsp_polarity', options: { channel }, style: RED }],
		}
		presets[`dsp_gain_up_${channel}`] = {
			type: 'simple',
			name: `Channel ${channel} gain +1 dB`,
			keywords: ['dsp', 'gain'],
			style: style(`$(rita:dsp_${channel}_name)\n+1 dB`),
			steps: [{ down: [{ actionId: 'dsp_gain_step', options: { channel, step: 1 } }], up: [] }],
			feedbacks: [],
		}
		presets[`dsp_gain_down_${channel}`] = {
			type: 'simple',
			name: `Channel ${channel} gain -1 dB`,
			keywords: ['dsp', 'gain'],
			style: style(`$(rita:dsp_${channel}_name)\n-1 dB`),
			steps: [{ down: [{ actionId: 'dsp_gain_step', options: { channel, step: -1 } }], up: [] }],
			feedbacks: [],
		}
	}

	const structure: CompanionPresetSection<ModuleSchema>[] = [
		{
			id: 'generator',
			name: 'Generator',
			description: 'The signal RiTA plays, and the continuous Spectrum measurement',
			definitions: [
				'generator_spectrum',
				...['sweep', 'multi_sweep', 'pink', 'spectrum', 'external'].map((s) => `generator_signal_${s}`),
			],
		},
		{
			id: 'measurement',
			name: 'Measurement',
			description: 'A capture per engine, the engines themselves, and what Sync All leaves and removes',
			definitions: [
				{
					id: 'capture',
					type: 'simple',
					name: 'Capture',
					description: 'Measures on that engine with the signal RiTA has, and turns the engine on',
					presets: numbers(ENGINE_COUNT).map((n) => `measurement_capture_${n}`),
				},
				{
					id: 'engines',
					type: 'simple',
					name: 'Engines',
					description: 'The number buttons of RiTA: the name and the delay of the engine, and its light',
					presets: numbers(ENGINE_COUNT).map((n) => `measurement_active_${n}`),
				},
				{
					id: 'sync',
					type: 'simple',
					name: 'Sync and export',
					presets: ['measurement_sync_all', 'measurement_clear_find', 'measurement_export_all'],
				},
			],
		},
		{
			id: 'average',
			name: 'AVG',
			description: 'The average of the selected engines, and its impulse response',
			definitions: ['average_active', 'average_export'],
		},
		{
			id: 'mute_groups',
			name: 'Mute groups',
			description: 'The 4 mute buttons of the processor connected to RiTA',
			definitions: numbers(MUTE_GROUP_COUNT).map((n) => `mute_group_${n}`),
		},
		{
			id: 'dsp',
			name: 'DSP',
			description: 'Polarity and gain of the 8 DSP channels, in steps of 1 dB',
			definitions: [
				{
					id: 'dsp_polarity',
					type: 'simple',
					name: 'Polarity',
					presets: numbers(CHANNEL_COUNT).map((n) => `dsp_polarity_${n}`),
				},
				{
					id: 'dsp_gain',
					type: 'simple',
					name: 'Gain',
					presets: numbers(CHANNEL_COUNT).flatMap((n) => [`dsp_gain_up_${n}`, `dsp_gain_down_${n}`]),
				},
			],
		},
	]

	self.setPresetDefinitions(structure, presets)
}
