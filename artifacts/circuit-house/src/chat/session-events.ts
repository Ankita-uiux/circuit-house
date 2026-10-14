import { apiUrl } from '@/shared';

export const TEST_CARDS = [
  '01 Everything at once', '02 Change your mind', '03 Off-topic',
  '04 Confused', '05 Wrong information', '06 Vague',
  '07 Ask for a human', '08 Hinglish and typos', '09 Silence',
] as const;

const FACILITATOR_KEY = 'circuit-house-facilitator';

/** Facilitator mode: open the store with ?facilitator=1 (and ?facilitator=0 to turn it off). */
export function readFacilitatorMode() {
  try {
    const flag = new URLSearchParams(window.location.search).get('facilitator');
    if (flag === '1') sessionStorage.setItem(FACILITATOR_KEY, '1');
    if (flag === '0') sessionStorage.removeItem(FACILITATOR_KEY);
    return sessionStorage.getItem(FACILITATOR_KEY) === '1';
  } catch {
    return new URLSearchParams(window.location.search).get('facilitator') === '1';
  }
}

export type SessionEvent =
  | { type: 'card'; card: string }
  | { type: 'participant'; label: string }
  | { type: 'inactivity' };

export async function postSessionEvent(sessionId: string, event: SessionEvent) {
  const response = await fetch(apiUrl(`/shop/chat-sessions/${encodeURIComponent(sessionId)}/events`), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error(`Event not saved (${response.status})`);
}
