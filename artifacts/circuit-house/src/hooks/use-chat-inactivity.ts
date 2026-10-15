import { useEffect, useRef } from 'react';

export const CHAT_INACTIVITY_MS = 120_000;

export const CHAT_INACTIVITY_MESSAGE = 'Are you still there?';

/** One reminder until the shopper sends another message, including after refresh. */
export function useChatInactivity(enabled: boolean, pending: boolean, sessionId: string, messages: ReadonlyArray<{ role: string; content: string }>, onIdle: () => void) {
  const callback = useRef(onIdle);
  callback.current = onIdle;
  const reminded = useRef(false);
  const session = useRef(sessionId);
  const userTurnCount = messages.filter((message) => message.role === 'user').length;
  const userTurns = useRef(userTurnCount);
  let awaitingReply = false;
  for (const message of messages) {
    if (message.role === 'user') awaitingReply = false;
    else if (message.role === 'assistant' && message.content === CHAT_INACTIVITY_MESSAGE) awaitingReply = true;
  }

  useEffect(() => {
    if (session.current !== sessionId || userTurns.current !== userTurnCount) {
      session.current = sessionId;
      userTurns.current = userTurnCount;
      reminded.current = false;
    }
    if (awaitingReply) reminded.current = true;
    if (!enabled || pending || reminded.current) return;
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
    const activity = () => { arm(); };
    const visibility = () => { clear(); arm(); };
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
  }, [enabled, pending, sessionId, messages.length, userTurnCount, awaitingReply]);
}
