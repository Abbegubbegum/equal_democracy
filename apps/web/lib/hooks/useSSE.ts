import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type Pusher from "pusher-js";
import type { Channel, PresenceChannel } from "pusher-js";

export interface SSEHandlers {
	onConnected?: (_data: { message: string }) => void;
	onError?: (_error: unknown) => void;
	onNewProposal?: (_data: unknown) => void;
	onNewComment?: (_data: unknown) => void;
	onVoteUpdate?: (_data: unknown) => void;
	onRatingUpdate?: (_data: unknown) => void;
	onCommentRatingUpdate?: (_data: unknown) => void;
	onPhaseChange?: (_data: unknown) => void;
	onTransitionScheduled?: (_data: unknown) => void;
	onTerminationScheduled?: (_data: unknown) => void;
	onTiebreakerStarted?: (_data: unknown) => void;
	onNewSession?: (_data: unknown) => void;
	onSessionArchived?: (_data: unknown) => void;
}

export default function useSSE(handlers: SSEHandlers = {}) {
	const { data: session, status } = useSession();
	const pusherRef = useRef<Pusher | null>(null);
	const channelRef = useRef<Channel | null>(null);
	const presenceChannelRef = useRef<PresenceChannel | null>(null);
	const handlersRef = useRef<SSEHandlers>(handlers);
	const [activeUserCount, setActiveUserCount] = useState(0);

	useEffect(() => {
		handlersRef.current = handlers;
	}, [handlers]);

	useEffect(() => {
		if (status !== "authenticated" || !session) {
			return;
		}

		const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
		const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

		if (!pusherKey || !pusherCluster) {
			return;
		}

		let cancelled = false;

		import("pusher-js").then(({ default: Pusher }) => {
			if (cancelled) return;

			const pusher = new Pusher(pusherKey, {
				cluster: pusherCluster,
				authEndpoint: "/api/pusher/auth",
			});

			pusherRef.current = pusher;

			const channel = pusher.subscribe("events");
			channelRef.current = channel;

			const presenceChannel = pusher.subscribe("presence-active-users") as PresenceChannel;
			presenceChannelRef.current = presenceChannel;

			presenceChannel.bind("pusher:subscription_succeeded", (members: { count: number }) => {
				setActiveUserCount(members.count);
			});

			presenceChannel.bind("pusher:member_added", () => {
				setActiveUserCount((prev) => prev + 1);
			});

			presenceChannel.bind("pusher:member_removed", () => {
				setActiveUserCount((prev) => Math.max(0, prev - 1));
			});

			pusher.connection.bind("connected", () => {
				handlersRef.current.onConnected?.({ message: "Connected to Pusher" });
			});

			pusher.connection.bind("error", (error: unknown) => {
				handlersRef.current.onError?.(error);
			});

			channel.bind("new-proposal", (data: unknown) => {
				handlersRef.current.onNewProposal?.(data);
			});

			channel.bind("new-comment", (data: unknown) => {
				handlersRef.current.onNewComment?.(data);
			});

			channel.bind("vote-update", (data: unknown) => {
				handlersRef.current.onVoteUpdate?.(data);
			});

			channel.bind("rating-update", (data: unknown) => {
				handlersRef.current.onRatingUpdate?.(data);
			});

			channel.bind("comment-rating-update", (data: unknown) => {
				handlersRef.current.onCommentRatingUpdate?.(data);
			});

			channel.bind("phase-change", (data: unknown) => {
				handlersRef.current.onPhaseChange?.(data);
			});

			channel.bind("transition-scheduled", (data: unknown) => {
				handlersRef.current.onTransitionScheduled?.(data);
			});

			channel.bind("termination-scheduled", (data: unknown) => {
				handlersRef.current.onTerminationScheduled?.(data);
			});

			channel.bind("tiebreaker-started", (data: unknown) => {
				handlersRef.current.onTiebreakerStarted?.(data);
			});

			channel.bind("new-session", (data: unknown) => {
				handlersRef.current.onNewSession?.(data);
			});

			channel.bind("session-archived", (data: unknown) => {
				handlersRef.current.onSessionArchived?.(data);
			});
		});

		return () => {
			cancelled = true;
			if (channelRef.current) {
				channelRef.current.unbind_all();
				pusherRef.current?.unsubscribe("events");
			}
			if (presenceChannelRef.current) {
				presenceChannelRef.current.unbind_all();
				pusherRef.current?.unsubscribe("presence-active-users");
			}
			if (pusherRef.current) {
				pusherRef.current.disconnect();
			}
		};
	}, [session, status]);

	return {
		activeUserCount,
		close: () => {
			if (channelRef.current) {
				channelRef.current.unbind_all();
				pusherRef.current?.unsubscribe("events");
			}
			if (presenceChannelRef.current) {
				presenceChannelRef.current.unbind_all();
				pusherRef.current?.unsubscribe("presence-active-users");
			}
			if (pusherRef.current) {
				pusherRef.current.disconnect();
			}
		},
	};
}
