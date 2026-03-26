import Pusher from "pusher";
import { createLogger } from "./logger";

const log = createLogger("Pusher");

/**
 * Pusher Broadcaster for Real-Time Events
 * Serverless-compatible replacement for SSE
 * Broadcasts events to all connected clients via Pusher channels
 */

class PusherBroadcaster {
	constructor() {
		this.pusher = null;
		this.initPusher();
	}

	initPusher() {
		// Check if Pusher is configured
		if (
			!process.env.PUSHER_APP_ID ||
			!process.env.PUSHER_KEY ||
			!process.env.PUSHER_SECRET ||
			!process.env.PUSHER_CLUSTER
		) {
			log.warn("Pusher not configured");
			return;
		}

		this.pusher = new Pusher({
			appId: process.env.PUSHER_APP_ID,
			key: process.env.PUSHER_KEY,
			secret: process.env.PUSHER_SECRET,
			cluster: process.env.PUSHER_CLUSTER,
			useTLS: true,
		});
	}

	/**
	 * Broadcast an event to all connected clients
	 * @param {string} eventType - Type of event (e.g., 'new-proposal', 'phase-change')
	 * @param {Object} data - Event data
	 */
	async broadcast(eventType, data) {
		if (!this.pusher) {
			return;
		}

		try {
			// Trigger event on the 'events' channel (global)
			await this.pusher.trigger("events", eventType, data);

			// Also broadcast to session-specific channel if sessionId is in data
			if (data.sessionId) {
				await this.pusher.trigger(`events-${data.sessionId}`, eventType, data);
			}
		} catch (error) {
			log.error("Broadcast failed", { event: eventType, error: error.message });
		}
	}

	/**
	 * Broadcast an event to a specific session channel only
	 * @param {string} sessionId - Session ID to broadcast to
	 * @param {string} eventType - Type of event
	 * @param {Object} data - Event data
	 */
	async broadcastToSession(sessionId, eventType, data) {
		if (!this.pusher) {
			return;
		}

		try {
			// Trigger event on session-specific channel
			await this.pusher.trigger(`events-${sessionId}`, eventType, {
				...data,
				sessionId,
			});
		} catch (error) {
			log.error("Session broadcast failed", { sessionId, event: eventType, error: error.message });
		}
	}

	/**
	 * Get number of connected clients (not directly available with Pusher)
	 * Returns null as Pusher manages this internally
	 */
	getClientCount() {
		return null;
	}
}

// Singleton instance with HMR support
if (!global.pusherBroadcaster) {
	global.pusherBroadcaster = new PusherBroadcaster();
}

const broadcaster = global.pusherBroadcaster;

export default broadcaster;
