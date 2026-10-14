import { useEffect, useRef } from 'react';

export const CHAT_INACTIVITY_MS = 30_000;

/** One reminder per idle period; activity or a new reply starts a fresh 30 seconds. */
export function useChatInactivity(enabled: boolean, pending: boolean, sessionId: string, turnCount: number, onIdle: () => void) {
  const callback = useRef(onIdle);
  callback.current = onIdle;
  const reminded = useRef(false);
  const session = useRef(sessionId);

  useEffect(() => {
    if (session.current !== sessionId) {
      session.current = sessionId;
      reminded.current = false;
    }
    if (!enabled || pending) {
      reminded.current = false;
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { if (timer !== undefined) clearTimeout(timer); };
    const arm = () => {
      clear();
      if (document.visibilityState !== 'visible' || reminded.current) return;
      timer = setTimeout(() => {
        reminded.current = true;
        callback.current();
      }, CHAT_INACTIVITY_MS);
    };
    const activity = () => { reminded.current = false; arm(); };
    const visibility = () => { clear(); reminded.current = false; arm(); };
    // Listen to user gestures, not scroll events caused by our own auto-scroll.
    const events = ['pointerdown', 'pointermove', 'keydown', 'input', 'wheel', 'touchstart', 'touchmove'] as const;
    for (const event of events) window.addEventListener(event, activity, { capture: true, passive: true });
    document.addEventListener('visibilitychange', visibility);
    arm();
    return () => {
      clear();
      for (const event of events) window.removeEventListener(event, activity, true);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled, pending, sessionId, turnCount]);
}
