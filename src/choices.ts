export interface Choice {
	id: string
	label: string
}

const same = (values: string[]): Choice[] => values.map((v) => ({ id: v, label: v }))
const numbered = (count: number, prefix: string): Choice[] =>
	Array.from({ length: count }, (_, i) => ({ id: String(i + 1), label: `${prefix} ${i + 1}` }))

export const CHANNEL_CHOICES = numbered(8, 'Channel')
export const ENGINE_CHOICES = numbered(8, 'Engine')
export const PEQ_SLOT_CHOICES = numbered(4, 'PEQ')

export const ON_OFF_TOGGLE_CHOICES: Choice[] = [
	{ id: 'on', label: 'On' },
	{ id: 'off', label: 'Off' },
	{ id: 'toggle', label: 'Toggle' },
]

export const SIGNAL_CHOICES = same(['Pink', 'Sweep', 'M-Noise', 'External', 'Spectrum', 'TF'])
export const DURATION_CHOICES: Choice[] = ['1', '2', '5', '10'].map((v) => ({ id: v, label: `${v} s` }))
export const GENERATOR_OUTPUT_CHOICES = same(['1', '2', '3', '4'])

export const FFT_SIZE_CHOICES = same(['64 FPPO', '32768', '16384', '8192', '4096', '2048', '1024', '512', '256', '128'])
export const WINDOW_CHOICES = same([
	'Rectangular',
	'Hamming',
	'Hann',
	'Flat Top',
	'Blackman',
	'Blackman-Harris',
	'Kaiser',
	'Chebyshev',
	'Multi Window',
])
export const SMOOTHING_CHOICES = same(['None', '1/48 Oct', '1/24 Oct', '1/12 Oct', '1/6 Oct', '1/3 Oct'])
export const SPECTRUM_AVERAGES_CHOICES = same(['1', '2', '4', '8', '16', '32'])
export const SPECTRUM_PLOT_CHOICES = same(['Line', 'Bar'])

export const FILTER_TYPE_CHOICES = same([
	'None',
	'Butterworth',
	'Linkwitz-Riley',
	'Bessel',
	'Eliptic',
	'Chebyshev I',
	'Chebyshev II',
	'APF',
	'FIR GAS',
	'Parametric',
	'Chingonizer MK1',
	'Chingonizer MK2',
	'Low Shelf',
	'High Shelf',
	'FIR RevPhase',
])

export const RAW_ACTION_CHOICES = same(['get', 'set', 'capture', 'delete', 'findDelay'])
