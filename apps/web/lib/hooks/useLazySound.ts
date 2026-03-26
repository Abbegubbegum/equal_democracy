import { useRef, useCallback } from "react";

/**
 * Lazy-loading sound hook that defers loading howler.js until first play.
 * Drop-in replacement for useSound with the same [play] return API.
 */
export function useLazySound(src, options = {}) {
	const playFnRef = useRef(null);
	const loadingRef = useRef(false);

	const play = useCallback(() => {
		if (playFnRef.current) {
			playFnRef.current();
			return;
		}
		if (loadingRef.current) return;
		loadingRef.current = true;

		import("howler").then(({ Howl }) => {
			const sound = new Howl({
				src: [src],
				volume: options.volume ?? 1.0,
			});
			playFnRef.current = () => sound.play();
			sound.play();
		}).catch(() => {
			loadingRef.current = false;
		});
	}, [src, options.volume]);

	return [play];
}
