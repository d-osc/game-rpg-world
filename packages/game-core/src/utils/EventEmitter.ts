/**
 * EventEmitter
 * Simple type-safe event emitter
 */

type EventHandler<T = any> = (data: T) => void;

export class EventEmitter<Events extends Record<string, EventHandler>> {
	private events: Map<keyof Events, Set<EventHandler>> = new Map();

	/**
	 * Register event listener
	 */
	on<K extends keyof Events>(event: K, handler: Events[K]): void {
		if (!this.events.has(event)) {
			this.events.set(event, new Set());
		}
		this.events.get(event)!.add(handler as EventHandler);
	}

	/**
	 * Register one-time event listener
	 */
	once<K extends keyof Events>(event: K, handler: Events[K]): void {
		const onceHandler = ((data: any) => {
			handler(data);
			this.off(event, onceHandler as Events[K]);
		}) as Events[K];

		this.on(event, onceHandler);
	}

	/**
	 * Unregister event listener
	 */
	off<K extends keyof Events>(event: K, handler: Events[K]): void {
		const handlers = this.events.get(event);
		if (handlers) {
			handlers.delete(handler as EventHandler);
		}
	}

	/**
	 * Emit event
	 */
	protected emit<K extends keyof Events>(
		event: K,
		...args: Parameters<Events[K]>
	): void {
		const handlers = this.events.get(event);
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(...args);
				} catch (error) {
					console.error(`Error in event handler for ${String(event)}:`, error);
				}
			});
		}
	}

	/**
	 * Remove all listeners for an event
	 */
	removeAllListeners<K extends keyof Events>(event?: K): void {
		if (event) {
			this.events.delete(event);
		} else {
			this.events.clear();
		}
	}

	/**
	 * Get listener count for an event
	 */
	listenerCount<K extends keyof Events>(event: K): number {
		return this.events.get(event)?.size || 0;
	}
}
