import type { CompanionVariableDefinitions, CompanionVariableValues } from '@companion-module/base'
import type ModuleInstance from './index.js'
import { ALIGN_APF_COUNT, CHANNEL_COUNT, ENGINE_COUNT } from './state.js'

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
		generator_pink_noise: { name: 'Generator pink noise (Live TF)' },
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
		defs[`meas_${i}_level`] = { name: `Engine ${i} level` }
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
		generator_pink_noise: onOff(generator.pinkNoise, 'ON', 'OFF'),
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
		values[`meas_${i}_level`] = m.level ?? ''
	}
	self.setVariableValues(values)
}
