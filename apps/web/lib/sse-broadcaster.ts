import Pusher from "pusher";
import { createLogger } from "./logger";

const log = createLogger("Pusher");

declare global {
	// eslint-disable-next-line no-var
	var pusherBroadcaster: PusherBroadcaster | undefined;
}

class PusherBroadcaster {
	private pusher: Pusher | null = null;

	constructor() {
		this.initPusher();
	}

	private initPusher(): void {
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

	async broadcast(eventType: string, data: Record<string, unknown>): Promise<void> {
		if (!this.pusher) return;

		try {
			await this.pusher.trigger("events", eventType, data);

			if (data.sessionId) {
				await this.pusher.trigger(`events-${data.sessionId}`, eventType, data);
			}
		} catch (error) {
			log.error("Broadcast failed", { event: eventType, error: (error as Error).message });
		}
	}

	async broadcastToSession(sessionId: string, eventType: string, data: Record<string, unknown>): Promise<void> {
		if (!this.pusher) return;

		try {
			await this.pusher.trigger(`events-${sessionId}`, eventType, {
				...data,
				sessionId,
			});
		} catch (error) {
			log.error("Session broadcast failed", { sessionId, event: eventType, error: (error as Error).message });
		}
	}

	getClientCount(): null {
		return null;
	}
}

if (!global.pusherBroadcaster) {
	global.pusherBroadcaster = new PusherBroadcaster();
}

const broadcaster = global.pusherBroadcaster;

export default broadcaster;
