import WebSocket from 'ws'
import { InstanceStatus, type LogLevel } from '@companion-module/base'
import type { ModuleConfig, ModuleSecrets } from './config.js'

export type RitaAction = 'get' | 'set' | 'capture' | 'delete' | 'findDelay'

export interface ModuleInstanceLike {
	config: ModuleConfig
	secrets: ModuleSecrets
	log(level: LogLevel, message: string): void
	updateStatus(status: InstanceStatus, message?: string | null): void
	onConnected(): void
	onDisconnected(): void
}

export class RitaError extends Error {
	constructor(public readonly code: string) {
		super(code)
	}
}

interface PendingRequest {
	resolve: (value: any) => void
	reject: (err: Error) => void
	timer: NodeJS.Timeout
}

// MATLAB's tcpserver takes one client per port, so RiTA opens a group of them.
const CONTROL_PORT_SPAN = 5
// A capture blocks the API until the measurement finishes, so be generous.
const REQUEST_TIMEOUT_MS = 15000
const RECONNECT_DELAY_MS = 3000
const API_PATH = '/api/v1/'

export class RitaClient {
	private ws: WebSocket | null = null
	private seq = 0
	private pending = new Map<number, PendingRequest>()
	private reconnectTimer: NodeJS.Timeout | undefined
	private portOffset = 0
	private destroyed = false
	private login: Promise<void> | null = null

	constructor(private readonly module: ModuleInstanceLike) {}

	get connected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN
	}

	connect(): void {
		if (!this.module.config.host) {
			this.module.updateStatus(InstanceStatus.BadConfig, 'No IP address configured')
			return
		}
		this.destroyed = false
		this.portOffset = 0
		this.open()
	}

	destroy(): void {
		this.destroyed = true
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
		this.reconnectTimer = undefined
		this.rejectAll(new Error('connection closed'))
		if (this.ws) {
			this.ws.removeAllListeners()
			this.ws.on('error', () => {})
			this.ws.terminate()
			this.ws = null
		}
	}

	async send(action: RitaAction, target?: string, properties?: unknown): Promise<any> {
		try {
			return await this.request(action, target, properties)
		} catch (err) {
			if (err instanceof RitaError && err.code === 'authentication required') {
				await this.authenticate()
				return this.request(action, target, properties)
			}
			throw err
		}
	}

	private authenticate(): Promise<void> {
		const password = this.module.secrets.password
		if (!password) {
			this.module.updateStatus(InstanceStatus.AuthenticationFailure, 'RiTA requires a password')
			return Promise.reject(new Error('RiTA requires a password, but none is configured'))
		}
		this.login ??= this.request('set', 'session', { password })
			.then(() => {
				this.module.updateStatus(InstanceStatus.Ok)
			})
			.catch((err: Error) => {
				this.module.updateStatus(InstanceStatus.AuthenticationFailure, err.message)
				throw err
			})
			.finally(() => {
				this.login = null
			})
		return this.login
	}

	private request(action: RitaAction, target?: string, properties?: unknown): Promise<any> {
		const ws = this.ws
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return Promise.reject(new Error('not connected to RiTA'))
		}

		const sequenceNumber = ++this.seq
		const message: Record<string, unknown> = { sequenceNumber, action }
		if (target !== undefined) message.target = target
		if (properties !== undefined) message.properties = properties
		const text = JSON.stringify(message)

		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(sequenceNumber)
				reject(new Error(`no reply to ${action} ${target ?? ''}`.trim()))
			}, REQUEST_TIMEOUT_MS)
			this.pending.set(sequenceNumber, { resolve, reject, timer })

			if (this.module.config.verbose) this.module.log('debug', `> ${text.replace(/("password"\s*:\s*)"[^"]*"/g, '$1"***"')}`)
			ws.send(text, (err) => {
				if (!err) return
				clearTimeout(timer)
				this.pending.delete(sequenceNumber)
				reject(err)
			})
		})
	}

	private open(): void {
		if (this.destroyed) return
		const port = (this.module.config.port || 26101) + this.portOffset
		const url = `ws://${this.module.config.host}:${port}${API_PATH}`
		this.module.updateStatus(InstanceStatus.Connecting)

		const ws = new WebSocket(url, { handshakeTimeout: 5000 })
		this.ws = ws
		let opened = false

		ws.on('open', () => {
			opened = true
			this.module.log('info', `Connected to ${url}`)
			this.module.updateStatus(InstanceStatus.Ok)
			this.module.onConnected()
		})

		ws.on('message', (data) => this.handleMessage(data.toString()))

		ws.on('error', (err) => {
			if (opened) this.module.log('error', `WebSocket error: ${err.message}`)
		})

		ws.on('close', (code) => {
			if (this.ws !== ws) return
			this.ws = null
			this.rejectAll(new Error('connection closed'))
			if (this.destroyed) return

			if (!opened && this.portOffset < CONTROL_PORT_SPAN - 1) {
				this.portOffset++
				this.open()
				return
			}

			const base = this.module.config.port || 26101
			if (opened) {
				this.module.log('warn', `Disconnected from RiTA (code ${code})`)
				this.module.updateStatus(InstanceStatus.Disconnected)
				this.module.onDisconnected()
			} else {
				this.module.updateStatus(
					InstanceStatus.ConnectionFailure,
					`No port in ${base}-${base + CONTROL_PORT_SPAN - 1} accepted the connection`,
				)
			}
			this.scheduleReconnect()
		})
	}

	private scheduleReconnect(): void {
		if (this.destroyed || this.reconnectTimer) return
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = undefined
			this.portOffset = 0
			this.open()
		}, RECONNECT_DELAY_MS)
	}

	private handleMessage(raw: string): void {
		if (this.module.config.verbose) this.module.log('debug', `< ${raw.length > 500 ? raw.slice(0, 500) + '…' : raw}`)

		let msg: any
		try {
			msg = JSON.parse(raw)
		} catch {
			this.module.log('warn', `Unparseable message from RiTA: ${raw.slice(0, 200)}`)
			return
		}

		const entry = this.pending.get(msg?.sequenceNumber)
		if (!entry) return
		this.pending.delete(msg.sequenceNumber)
		clearTimeout(entry.timer)

		const body = msg.response ?? {}
		if (body && typeof body === 'object' && typeof body.error === 'string') {
			entry.reject(new RitaError(body.error))
		} else {
			entry.resolve(body)
		}
	}

	private rejectAll(err: Error): void {
		for (const entry of this.pending.values()) {
			clearTimeout(entry.timer)
			entry.reject(err)
		}
		this.pending.clear()
	}
}
