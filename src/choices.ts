export interface Choice {
	id: string
	label: string
}

const same = (values: string[]): Choice[] => values.map((v) => ({ id: v, label: v }))
const numbered = (count: number, prefix: string): Choice[] =>
	Array.from({ length: count }, (_, i) => ({ id: String(i + 1), label: `${prefix} ${i + 1}` }))

export const CHANNEL_CHOICES = numbered(8, 'Channel')
export const ENGINE_CHOICES = numbered(8, 'Engine')
export const ALIGN_APF_CHOICES = numbered(2, 'Alignment APF')
export const MUTE_GROUP_CHOICES = numbered(4, 'Mute group')

export const ON_OFF_TOGGLE_CHOICES: Choice[] = [
	{ id: 'on', label: 'On' },
	{ id: 'off', label: 'Off' },
	{ id: 'toggle', label: 'Toggle' },
]

// Live TF is hidden in the RiTA beta: no tab and no entry in the signal list.
export const SIGNAL_CHOICES = same(['Sweep', 'Multi Sweep', 'Pink', 'External', 'Spectrum'])
export const DURATION_CHOICES: Choice[] = ['1', '2', '4', '8', '16'].map((v) => ({ id: v, label: `${v} s` }))

// The sizes of RiTA's FFT dropdown, in its own order and with every size it can ever offer.
// 128 FPPO and anything above 32768 are only there with Auto FFT size on, and only up to the
// engine size of the moment; the Spectrum signal has none of those and no 64 FPPO either.
// Anything RiTA is not offering right then answers "unknown value".
export const FFT_SIZE_CHOICES = same([
	'128 FPPO',
	'64 FPPO',
	'262144',
	'131072',
	'65536',
	'32768',
	'16384',
	'8192',
	'4096',
	'2048',
	'1024',
	'512',
	'256',
	'128',
])
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
// The filter model RiTA draws and computes the DSP with, in the order of its dropdown.
// Newer RiTA versions may add processors, so the dropdowns that use it allow a typed value.
export const DSP_TYPE_CHOICES = same(['RiTA', 'Kingray', 'Marani', 'Galaxy'])
// The Marani models of DSP Type, in the order of RiTA's dropdown. The modes of each one are
// not here: they depend on the model, there are more than forty, and the API cannot list them.
export const DSP_MODEL_CHOICES = same([
	'Marani MIR FI',
	'Marani MIR A',
	'Marani MIR D',
	'Marani MIR E',
	'Marani MDA kDM',
	'Marani MDA kTM',
	'Marani PDA',
	'VA DF',
])

// The two Preferences modes: with one channel the eight engines share that input.
export const REFERENCE_MODE_CHOICES = same(['1 Ref. Channel', 'Several Ref. Channels'])
export const MEASUREMENT_MODE_CHOICES = same(['1 Meas. Channel', 'Several Meas. Channels'])

// The filter types of RiTA's Equalizer window, copied from RiTA's own table (TiposEQRiTA),
// with the columns each one uses. With RiTA, Kingray and Galaxy only Parametric, Low Shelf,
// High Shelf, APF and FIR RevPhase exist; a Marani adds the rest, and which of them depends
// on its model and mode, so one RiTA does not have can answer "unknown value".
export interface PeqType {
	id: string
	// Whether the G/O column is a gain. On APF and FIR RevPhase it is the order instead.
	gain: boolean
	// What the Q column means: a width, the slope in dB/oct of the Slope shelvings,
	// the order of APF and FIR RevPhase, or nothing at all.
	width: 'q' | 'slope' | 'order' | 'none'
}
export const PEQ_TYPES: PeqType[] = [
	{ id: 'Parametric', gain: true, width: 'q' },
	{ id: 'Bell Adaptive Q', gain: true, width: 'q' },
	{ id: 'Bell Classic Q', gain: true, width: 'q' },
	{ id: 'High Shelf 1st', gain: true, width: 'none' },
	{ id: 'High Shelf 2nd', gain: true, width: 'none' },
	{ id: 'High Shelf Slope', gain: true, width: 'slope' },
	{ id: 'High Shelf', gain: true, width: 'q' },
	{ id: 'Low Shelf 1st', gain: true, width: 'none' },
	{ id: 'Low Shelf 2nd', gain: true, width: 'none' },
	{ id: 'Low Shelf Slope', gain: true, width: 'slope' },
	{ id: 'Low Shelf', gain: true, width: 'q' },
	{ id: 'Low Pass 1st', gain: false, width: 'none' },
	{ id: 'Low Pass 2nd', gain: false, width: 'none' },
	{ id: 'Low Pass VariQ', gain: false, width: 'q' },
	{ id: 'High Pass 1st', gain: false, width: 'none' },
	{ id: 'High Pass 2nd', gain: false, width: 'none' },
	{ id: 'High Pass VariQ', gain: false, width: 'q' },
	{ id: 'Band Pass', gain: false, width: 'q' },
	{ id: 'Notch', gain: false, width: 'q' },
	{ id: 'APF', gain: false, width: 'order' },
	{ id: 'FIR RevPhase', gain: false, width: 'order' },
]
export const PEQ_TYPE_CHOICES: Choice[] = PEQ_TYPES.map((t) => ({ id: t.id, label: t.id }))
export const peqType = (id: string): PeqType | undefined => PEQ_TYPES.find((t) => t.id === id)

// NXF is the crossover of some Marani models and modes; with the rest it answers
// "unknown value". Its order is not dB/oct but an attenuation code, see HELP.md.
export const XOVER_TYPE_CHOICES = same([
	'None',
	'Butterworth',
	'Linkwitz-Riley',
	'Bessel',
	'Eliptic',
	'Chebyshev I',
	'Chebyshev II',
	'NXF',
])

export const RAW_ACTION_CHOICES = same([
	'get',
	'set',
	'capture',
	'delete',
	'findDelay',
	'clear',
	'export',
	'exportAll',
	'syncAll',
	'clearFind',
	'clearDelays',
	'clearAll',
	'toggle',
	'refresh',
])
