import WebSocket, { type RawData } from 'ws'
import { InstanceStatus, type LogLevel } from '@companion-module/base'
import type { ModuleConfig, ModuleSecrets } from './config.js'

export type RitaAction =
	| 'get'
	| 'set'
	| 'capture'
	| 'delete'
	| 'findDelay'
	| 'clear'
	| 'export'
	| 'exportAll'
	| 'syncAll'
	| 'clearFind'
	| 'clearDelays'
	| 'clearAll'
	| 'toggle'
	| 'refresh'
	| 'subscribe'
	| 'unsubscribe'

export interface ModuleInstanceLike {
	config: ModuleConfig
	secrets: ModuleSecrets
	log(level: LogLevel, message: string): void
	updateStatus(status: InstanceStatus, message?: string | null): void
	onConnected(): void
	onDisconnected(): void
	onEvent(target: string, properties: Record<string, unknown>): void
}

/**
 * A wait that ends early if Companion aborts the button it belongs to. Companion ignores
 * whatever an aborted action throws, so the caller checks the signal afterwards and throws.
 */
export async function wait(ms: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) return
	return new Promise((resolve) => {
		const done = (): void => {
			clearTimeout(timer)
			signal?.removeEventListener('abort', done)
			resolve()
		}
		const timer = setTimeout(done, ms)
		signal?.addEventListener('abort', done, { once: true })
	})
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
// RiTA can leave a control port half-open (TCP accepts, no WebSocket handshake) after a client left it.
const HANDSHAKE_TIMEOUT_MS = 3000
const API_PATH = '/api/v1/'

export class RitaClient {
	private ws: WebSocket | null = null
	private seq = 0
	private pending = new Map<number, PendingRequest>()
	private reconnectTimer: NodeJS.Timeout | undefined
	private portOffset = 0
	private portsTried = 0
	private lastGoodOffset = -1
	private destroyed = false
	private login: Promise<void> | null = null
	private loginRejected: string | null = null
	private busyUntil = 0
	private lastConnectError: string | null = null

	constructor(private readonly module: ModuleInstanceLike) {}

	get connected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN
	}

	/** RiTA will not answer until this time (a measurement is running): wait that much longer for replies. */
	holdUntil(time: number): void {
		this.busyUntil = Math.max(this.busyUntil, time)
	}

	connect(): void {
		if (!this.module.config.host) {
			this.module.updateStatus(InstanceStatus.BadConfig, 'No IP address configured')
			return
		}
		this.destroyed = false
		this.portOffset = 0
		this.portsTried = 0
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

	private async authenticate(): Promise<void> {
		const password = this.module.secrets.password
		if (!password) {
			this.module.updateStatus(InstanceStatus.AuthenticationFailure, 'RiTA requires a password')
			throw new Error('RiTA requires a password, but none is configured')
		}
		// RiTA locks the connection after 5 wrong passwords, so a rejected one is not retried.
		// The status is set again here because a reconnect in between turned it green.
		if (this.loginRejected) {
			this.module.updateStatus(InstanceStatus.AuthenticationFailure, this.loginRejected)
			throw new RitaError(this.loginRejected)
		}
		this.login ??= this.request('set', 'session', { password })
			.then(() => {
				this.module.updateStatus(InstanceStatus.Ok)
			})
			.catch((err: Error) => {
				if (err instanceof RitaError && (err.code === 'incorrect password' || err.code === 'too many attempts')) {
					this.loginRejected = err.code
				}
				this.module.updateStatus(InstanceStatus.AuthenticationFailure, err.message)
				throw err
			})
			.finally(() => {
				this.login = null
			})
		return this.login
	}

	private async request(action: RitaAction, target?: string, properties?: unknown): Promise<any> {
		const ws = this.ws
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			throw new Error('not connected to RiTA')
		}

		const sequenceNumber = ++this.seq
		const message: Record<string, unknown> = { sequenceNumber, action }
		if (target !== undefined) message.target = target
		if (properties !== undefined) message.properties = properties
		const text = JSON.stringify(message)

		return new Promise((resolve, reject) => {
			const timer = setTimeout(
				() => {
					this.pending.delete(sequenceNumber)
					reject(new Error(`no reply to ${action} ${target ?? ''}`.trim()))
				},
				REQUEST_TIMEOUT_MS + Math.max(0, this.busyUntil - Date.now()),
			)
			this.pending.set(sequenceNumber, { resolve, reject, timer })

			if (this.module.config.verbose)
				this.module.log('debug', `> ${text.replace(/("password"\s*:\s*)"[^"]*"/g, '$1"***"')}`)
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
		const offset = this.portOffset
		const port = (this.module.config.port || 26101) + offset
		// A pasted address often brings a space along, and a typed one sometimes the port; ws
		// throws Invalid URL for either, which left the connection on Connecting for good.
		const host = String(this.module.config.host ?? '').trim()
		const url = `ws://${host}:${port}${API_PATH}`
		this.module.updateStatus(InstanceStatus.Connecting)

		let ws: WebSocket
		try {
			ws = new WebSocket(url, { handshakeTimeout: HANDSHAKE_TIMEOUT_MS })
		} catch (err) {
			this.module.updateStatus(InstanceStatus.BadConfig, `RiTA IP address is not usable: ${(err as Error).message}`)
			this.module.log('error', `Cannot open ${url}: ${(err as Error).message}`)
			return
		}
		this.ws = ws
		let opened = false

		ws.on('open', () => {
			opened = true
			this.lastGoodOffset = offset
			this.lastConnectError = null
			this.module.log('info', `Connected to ${url}`)
			// A password RiTA rejected is remembered until the settings are saved again, and no
			// request will work, so the connection must not look healthy after a reconnect.
			if (this.loginRejected) this.module.updateStatus(InstanceStatus.AuthenticationFailure, this.loginRejected)
			else this.module.updateStatus(InstanceStatus.Ok)
			this.module.onConnected()
		})

		// RiTA speaks JSON text; a binary frame is not ours. One arriving as several buffers, or
		// as an ArrayBuffer, has to be joined, because toString on those gives [object ...].
		ws.on('message', (data: RawData, isBinary: boolean) => {
			if (isBinary) return
			const text = Array.isArray(data)
				? Buffer.concat(data).toString('utf8')
				: data instanceof ArrayBuffer
					? Buffer.from(data).toString('utf8')
					: data.toString('utf8')
			this.handleMessage(text)
		})

		ws.on('error', (err) => {
			// Before the handshake, the error says what really happened (refused, unreachable,
			// timed out); the close handler puts it in the status so the user can tell them apart.
			if (opened) this.module.log('error', `WebSocket error: ${err.message}`)
			else this.lastConnectError = err.message
		})

		ws.on('close', (code) => {
			if (this.ws !== ws) return
			this.ws = null
			this.rejectAll(new Error('connection closed'))
			if (this.destroyed) return

			if (!opened && ++this.portsTried < CONTROL_PORT_SPAN) {
				this.portOffset = (this.portOffset + 1) % CONTROL_PORT_SPAN
				this.open()
				return
			}

			const base = this.module.config.port || 26101
			if (opened) {
				this.module.log('warn', `Disconnected from RiTA (code ${code})`)
				this.module.updateStatus(InstanceStatus.Disconnected)
				this.module.onDisconnected()
			} else {
				const why = this.lastConnectError ? `: ${this.lastConnectError}` : ''
				this.module.updateStatus(
					InstanceStatus.ConnectionFailure,
					`No port in ${base}-${base + CONTROL_PORT_SPAN - 1} accepted the connection${why}`,
				)
			}
			this.scheduleReconnect()
		})
	}

	private scheduleReconnect(): void {
		if (this.destroyed || this.reconnectTimer) return
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = undefined
			// RiTA hands the same port back when the old connection is dead; if it is still alive,
			// the handshake is closed at once and the loop moves on to the next one.
			this.portOffset = this.lastGoodOffset >= 0 ? this.lastGoodOffset : 0
			this.portsTried = 0
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

		if (msg?.event === 'changed' && typeof msg.target === 'string') {
			this.module.onEvent(msg.target, msg.properties ?? {})
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
