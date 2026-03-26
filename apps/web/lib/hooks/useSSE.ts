import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Custom hook for Pusher real-time events
 * Automatically connects to Pusher and listens for real-time updates
 * Pusher is lazy-loaded via dynamic import to reduce initial bundle size
 *
 * @param {Object} handlers - Object with event handlers
 * @param {Function} handlers.onNewProposal - Called when a new proposal is created
 * @param {Function} handlers.onNewComment - Called when a new comment is added
 * @param {Function} handlers.onVoteUpdate - Called when votes are cast
 * @param {Function} handlers.onRatingUpdate - Called when proposal ratings change
 * @param {Function} handlers.onCommentRatingUpdate - Called when comment ratings change
 * @param {Function} handlers.onPhaseChange - Called when session phase changes
 * @param {Function} handlers.onTransitionScheduled - Called when phase transition is scheduled
 * @param {Function} handlers.onNewSession - Called when a new session is created
 * @param {Function} handlers.onSessionArchived - Called when a session is archived
 * @param {Function} handlers.onConnected - Called when connection is established
 * @param {Function} handlers.onError - Called when an error occurs
 * @returns {Object} - Object with activeUserCount state
 */
export default function useSSE(handlers = {}) {
	const { data: session, status } = useSession();
	const pusherRef = useRef(null);
	const channelRef = useRef(null);
	const presenceChannelRef = useRef(null);
	const handlersRef = useRef(handlers);
	const [activeUserCount, setActiveUserCount] = useState(0);

	// Update handlers ref when handlers change
	useEffect(() => {
		handlersRef.current = handlers;
	}, [handlers]);

	useEffect(() => {
		// Only connect if user is authenticated
		if (status !== "authenticated" || !session) {
			return;
		}

		// Get Pusher config from environment variables
		const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
		const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

		if (!pusherKey || !pusherCluster) {
			return;
		}

		let cancelled = false;

		// Dynamic import: pusher-js is loaded only when needed
		import("pusher-js").then(({ default: Pusher }) => {
			if (cancelled) return;

			// Create Pusher connection with auth endpoint
			const pusher = new Pusher(pusherKey, {
				cluster: pusherCluster,
				authEndpoint: "/api/pusher/auth",
			});

			pusherRef.current = pusher;

			// Subscribe to the events channel
			const channel = pusher.subscribe("events");
			channelRef.current = channel;

			// Subscribe to presence channel for active user tracking
			const presenceChannel = pusher.subscribe("presence-active-users");
			presenceChannelRef.current = presenceChannel;

			// Listen for presence events
			presenceChannel.bind("pusher:subscription_succeeded", (members) => {
				setActiveUserCount(members.count);
			});

			presenceChannel.bind("pusher:member_added", () => {
				setActiveUserCount((prev) => prev + 1);
			});

			presenceChannel.bind("pusher:member_removed", () => {
				setActiveUserCount((prev) => Math.max(0, prev - 1));
			});

			// Connection state events
			pusher.connection.bind("connected", () => {
				if (handlersRef.current.onConnected) {
					handlersRef.current.onConnected({
						message: "Connected to Pusher",
					});
				}
			});

			pusher.connection.bind("error", (error) => {
				if (handlersRef.current.onError) {
					handlersRef.current.onError(error);
				}
			});

			// Listen for new proposals
			channel.bind("new-proposal", (data) => {
				if (handlersRef.current.onNewProposal) {
					handlersRef.current.onNewProposal(data);
				}
			});

			// Listen for new comments
			channel.bind("new-comment", (data) => {
				if (handlersRef.current.onNewComment) {
					handlersRef.current.onNewComment(data);
				}
			});

			// Listen for vote updates
			channel.bind("vote-update", (data) => {
				if (handlersRef.current.onVoteUpdate) {
					handlersRef.current.onVoteUpdate(data);
				}
			});

			// Listen for rating updates
			channel.bind("rating-update", (data) => {
				if (handlersRef.current.onRatingUpdate) {
					handlersRef.current.onRatingUpdate(data);
				}
			});

			// Listen for comment rating updates
			channel.bind("comment-rating-update", (data) => {
				if (handlersRef.current.onCommentRatingUpdate) {
					handlersRef.current.onCommentRatingUpdate(data);
				}
			});

			// Listen for phase changes
			channel.bind("phase-change", (data) => {
				if (handlersRef.current.onPhaseChange) {
					handlersRef.current.onPhaseChange(data);
				}
			});

			// Listen for transition scheduled
			channel.bind("transition-scheduled", (data) => {
				if (handlersRef.current.onTransitionScheduled) {
					handlersRef.current.onTransitionScheduled(data);
				}
			});

			// Listen for termination scheduled (phase 2)
			channel.bind("termination-scheduled", (data) => {
				if (handlersRef.current.onTerminationScheduled) {
					handlersRef.current.onTerminationScheduled(data);
				}
			});

			// Listen for tiebreaker started
			channel.bind("tiebreaker-started", (data) => {
				if (handlersRef.current.onTiebreakerStarted) {
					handlersRef.current.onTiebreakerStarted(data);
				}
			});

			// Listen for new sessions
			channel.bind("new-session", (data) => {
				if (handlersRef.current.onNewSession) {
					handlersRef.current.onNewSession(data);
				}
			});

			// Listen for session archived
			channel.bind("session-archived", (data) => {
				if (handlersRef.current.onSessionArchived) {
					handlersRef.current.onSessionArchived(data);
				}
			});
		});

		// Cleanup on unmount
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

	// Return active user count and a function to manually close the connection if needed
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
