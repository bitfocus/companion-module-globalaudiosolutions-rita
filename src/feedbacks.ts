import { combineRgb, type CompanionFeedbackDefinitions } from '@companion-module/base'
import type ModuleInstance from './index.js'
import type { FeedbacksSchema } from './index.js'
import { ALIGN_APF_CHOICES, CHANNEL_CHOICES, ENGINE_CHOICES, SIGNAL_CHOICES } from './choices.js'

const GREEN = { bgcolor: combineRgb(0, 153, 51), color: combineRgb(255, 255, 255) }
const RED = { bgcolor: combineRgb(204, 0, 0), color: combineRgb(255, 255, 255) }

export function UpdateFeedbacks(self: ModuleInstance): void {
	const feedbacks: CompanionFeedbackDefinitions<FeedbacksSchema> = {
		connected: {
			type: 'boolean',
			name: 'Connected to RiTA',
			defaultStyle: GREEN,
			options: [],
			callback: () => self.rita.connected,
		},
		generator_running: {
			type: 'boolean',
			name: 'Generator is running',
			defaultStyle: GREEN,
			options: [],
			callback: () => self.state.generator.running === true,
		},
		generator_pink_noise: {
			type: 'boolean',
			name: 'Generator pink noise is on (Live TF)',
			defaultStyle: GREEN,
			options: [],
			callback: () => self.state.generator.pinkNoise === true,
		},
		average_active: {
			type: 'boolean',
			name: 'AVG is on',
			defaultStyle: GREEN,
			options: [],
			callback: () => self.state.average.active === true,
		},
		average_has_data: {
			type: 'boolean',
			name: 'AVG has a curve',
			description: 'AVG is on and there is an average to show or export',
			defaultStyle: GREEN,
			options: [],
			callback: () => self.state.average.hasData === true,
		},
		generator_signal: {
			type: 'boolean',
			name: 'Generator signal is',
			defaultStyle: GREEN,
			options: [{ type: 'dropdown', id: 'signal', label: 'Signal', default: 'Pink', choices: SIGNAL_CHOICES }],
			callback: ({ options }) => self.state.generator.signal === options.signal,
		},
		sync_active: {
			type: 'boolean',
			name: 'Sync All is set',
			description: 'A sync is in place (some engine has Find on), which is what Sync All leaves and Clear Find removes',
			defaultStyle: GREEN,
			options: [],
			callback: () => self.state.sync.synced === true,
		},
		measurement_active: {
			type: 'boolean',
			name: 'Measurement engine is active',
			defaultStyle: GREEN,
			options: [{ type: 'dropdown', id: 'engine', label: 'Engine', default: '1', choices: ENGINE_CHOICES }],
			callback: ({ options }) => self.state.measurements[Number(options.engine)]?.active === true,
		},
		measurement_selected: {
			type: 'boolean',
			name: 'Measurement engine is selected',
			defaultStyle: GREEN,
			options: [{ type: 'dropdown', id: 'engine', label: 'Engine', default: '1', choices: ENGINE_CHOICES }],
			callback: ({ options }) => self.state.measurements[Number(options.engine)]?.selected === true,
		},
		dsp_polarity: {
			type: 'boolean',
			name: 'DSP channel polarity is inverted',
			defaultStyle: RED,
			options: [{ type: 'dropdown', id: 'channel', label: 'Channel', default: '1', choices: CHANNEL_CHOICES }],
			callback: ({ options }) => self.state.dsp[Number(options.channel)]?.polarity === true,
		},
		dsp_align_apf_enabled: {
			type: 'boolean',
			name: 'DSP alignment APF is enabled',
			defaultStyle: GREEN,
			options: [
				{ type: 'dropdown', id: 'channel', label: 'Channel', default: '1', choices: CHANNEL_CHOICES },
				{ type: 'dropdown', id: 'slot', label: 'Alignment APF', default: '1', choices: ALIGN_APF_CHOICES },
			],
			callback: ({ options }) =>
				self.state.alignApf[Number(options.channel)]?.[Number(options.slot)]?.enabled === true,
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
