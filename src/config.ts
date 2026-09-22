import type { SomeCompanionConfigField } from '@companion-module/base'

export type ModuleConfig = {
	host: string
	port: number
	pollInterval: number
	verbose: boolean
}

export type ModuleSecrets = {
	password?: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'Information',
			value:
				'Connects to the RiTA WebSocket control API. RiTA opens a group of consecutive control ports ' +
				'(one client per port), so the module tries up to 5 ports starting at the one configured here.',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'RiTA IP address',
			width: 6,
			default: '',
		},
		{
			type: 'number',
			id: 'port',
			label: 'Control port',
			width: 3,
			default: 26101,
			min: 1,
			max: 65535,
		},
		{
			type: 'secret-text',
			id: 'password',
			label: 'Password (empty if none)',
			width: 3,
			default: '',
		},
		{
			type: 'number',
			id: 'pollInterval',
			label: 'Level meter and sync poll interval in ms (0 = off)',
			description:
				'RiTA sends change events for everything except the level meters and the sync state, which are read at this interval. On a RiTA without events, all the state is polled at this interval.',
			width: 6,
			default: 2000,
			min: 0,
			max: 60000,
		},
		{
			type: 'checkbox',
			id: 'verbose',
			label: 'Log every API message',
			width: 6,
			default: false,
		},
	]
}
