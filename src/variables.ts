import type { CompanionVariableDefinitions, CompanionVariableValues } from '@companion-module/base'
import type ModuleInstance from './index.js'
import { ALIGN_APF_COUNT, CHANNEL_COUNT, ENGINE_COUNT, MUTE_GROUP_COUNT } from './state.js'

const onOff = (value: boolean | undefined, on: string, off: string): string =>
	value === undefined ? '' : value ? on : off

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const defs: CompanionVariableDefinitions = {
		generator_running: { name: 'Generator running' },
		generator_signal: { name: 'Generator signal' },
		generator_gain: { name: 'Generator gain (dB)' },
		generator_duration: { name: 'Generator duration (s)' },
		generator_output1: { name: 'Generator output 1' },
		generator_output2: { name: 'Generator output 2' },
		average_active: { name: 'AVG on' },
		average_has_data: { name: 'AVG has a curve' },
		average_count: { name: 'AVG number of engines' },
		average_engines: { name: 'AVG engines' },
		average_mode: { name: 'AVG mode' },
		average_name: { name: 'AVG last export name' },
		settings_dsp_type: { name: 'DSP type' },
		settings_reference_mode: { name: 'Reference mode' },
		settings_measurement_mode: { name: 'Measurement mode' },
		settings_fft_size: { name: 'FFT size' },
		settings_window: { name: 'Window' },
		settings_smoothing: { name: 'Smoothing' },
		settings_spectrum_averages: { name: 'Spectrum averages' },
		settings_averaging: { name: 'Averaging on' },
		settings_sum: { name: 'Sum on' },
		settings_coherence_threshold: { name: 'Coherence threshold' },
		sync_active: { name: 'Sync All is set' },
		sync_count: { name: 'Sync All count this session' },
		sync_possible: { name: 'Sync All is possible' },
	}
	for (let i = 1; i <= CHANNEL_COUNT; i++) {
		defs[`dsp_${i}_name`] = { name: `DSP ${i} name` }
		defs[`dsp_${i}_gain`] = { name: `DSP ${i} gain (dB)` }
		defs[`dsp_${i}_delay`] = { name: `DSP ${i} delay (ms)` }
		defs[`dsp_${i}_polarity`] = { name: `DSP ${i} polarity` }
		for (let k = 1; k <= ALIGN_APF_COUNT; k++) {
			defs[`dsp_${i}_apf${k}_enabled`] = { name: `DSP ${i} alignment APF ${k} enabled` }
			defs[`dsp_${i}_apf${k}_frequency`] = { name: `DSP ${i} alignment APF ${k} frequency (Hz)` }
			defs[`dsp_${i}_apf${k}_order`] = { name: `DSP ${i} alignment APF ${k} order` }
			defs[`dsp_${i}_apf${k}_q`] = { name: `DSP ${i} alignment APF ${k} Q` }
		}
	}
	for (let i = 1; i <= ENGINE_COUNT; i++) {
		defs[`meas_${i}_name`] = { name: `Engine ${i} name` }
		defs[`meas_${i}_active`] = { name: `Engine ${i} active` }
		defs[`meas_${i}_delay`] = { name: `Engine ${i} delay (ms)` }
		defs[`meas_${i}_dsp_delay`] = { name: `Engine ${i} DSP delay (ms)` }
		defs[`meas_${i}_level`] = { name: `Engine ${i} level` }
	}
	for (let i = 1; i <= MUTE_GROUP_COUNT; i++) {
		defs[`mute_group_${i}_name`] = { name: `Mute group ${i} name` }
		defs[`mute_group_${i}_muted`] = { name: `Mute group ${i} muted` }
		defs[`mute_group_${i}_available`] = { name: `Mute group ${i} has channels` }
	}
	self.setVariableDefinitions(defs)
}

export function UpdateVariableValues(self: ModuleInstance): void {
	const { generator, dsp, measurements } = self.state
	const values: CompanionVariableValues = {
		generator_running: onOff(generator.running, 'ON', 'OFF'),
		generator_signal: generator.signal ?? '',
		generator_gain: generator.gain ?? '',
		generator_duration: generator.duration ?? '',
		generator_output1: generator.output1 ?? '',
		generator_output2: generator.output2 ?? '',
		average_active: onOff(self.state.average.active, 'ON', 'OFF'),
		average_has_data: onOff(self.state.average.hasData, 'YES', 'NO'),
		average_count: self.state.average.count ?? '',
		average_engines: Array.isArray(self.state.average.engines) ? self.state.average.engines.join(', ') : '',
		average_mode: self.state.average.mode ?? '',
		average_name: self.state.average.name ?? '',
		settings_dsp_type: self.state.settings.dspType ?? '',
		settings_reference_mode: self.state.settings.referenceMode ?? '',
		settings_measurement_mode: self.state.settings.measurementMode ?? '',
		settings_fft_size: self.state.settings.fftSize ?? '',
		settings_window: self.state.settings.window ?? '',
		settings_smoothing: self.state.settings.smoothing ?? '',
		settings_spectrum_averages: self.state.settings.spectrumAverages ?? '',
		settings_averaging: onOff(self.state.settings.averaging, 'ON', 'OFF'),
		settings_sum: onOff(self.state.settings.sum, 'ON', 'OFF'),
		settings_coherence_threshold: self.state.settings.coherenceThreshold ?? '',
		sync_active: onOff(self.state.sync.synced, 'ON', 'OFF'),
		sync_count: self.state.sync.syncCount ?? '',
		sync_possible: onOff(self.state.sync.canSync, 'YES', 'NO'),
	}
	for (let i = 1; i <= CHANNEL_COUNT; i++) {
		const ch = dsp[i] ?? {}
		values[`dsp_${i}_name`] = ch.name ?? ''
		values[`dsp_${i}_gain`] = ch.gain ?? ''
		values[`dsp_${i}_delay`] = ch.delay ?? ''
		values[`dsp_${i}_polarity`] = onOff(ch.polarity, 'INV', 'NORM')
		for (let k = 1; k <= ALIGN_APF_COUNT; k++) {
			const apf = self.state.alignApf[i]?.[k] ?? {}
			values[`dsp_${i}_apf${k}_enabled`] = onOff(apf.enabled, 'ON', 'OFF')
			values[`dsp_${i}_apf${k}_frequency`] = apf.frequency ?? ''
			values[`dsp_${i}_apf${k}_order`] = apf.order ?? ''
			values[`dsp_${i}_apf${k}_q`] = apf.q ?? ''
		}
	}
	for (let i = 1; i <= ENGINE_COUNT; i++) {
		const m = measurements[i] ?? {}
		values[`meas_${i}_name`] = m.name ?? ''
		values[`meas_${i}_active`] = onOff(m.active, 'ON', 'OFF')
		values[`meas_${i}_delay`] = m.delay ?? ''
		values[`meas_${i}_dsp_delay`] = m.dspDelay ?? ''
		values[`meas_${i}_level`] = m.level ?? ''
	}
	for (let i = 1; i <= MUTE_GROUP_COUNT; i++) {
		const group = self.state.muteGroups[i] ?? {}
		values[`mute_group_${i}_name`] = group.name ?? ''
		values[`mute_group_${i}_muted`] = onOff(group.muted, 'MUTE', 'ON')
		values[`mute_group_${i}_available`] = onOff(group.available, 'YES', 'NO')
	}
	self.setVariableValues(values)
}
