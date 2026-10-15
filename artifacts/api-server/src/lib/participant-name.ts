/**
 * Reads the participant's reply to "what should I call you?".
 * Pulls out just the first name ("hi i am aryan" -> "Aryan") and notices when
 * the reply is a shopping request instead, so it can be answered after the name.
 */

const GREETING_WORD = "(?:(?:h+i+|h+e+y+|h+e+l+l*o+w*) (?:there|everyone|all|buddy)|h+i+|h+e+y+a*|h+e+l+o+w*|h+e+l+l+o+w*|hola|yo+|namaste|sup|wa+s+u+p+|hey there|hi there|good (?:morning|afternoon|evening))";
const GREETING = new RegExp(`^(?:${GREETING_WORD}\\b[\\s,!.]*)+`, "i");
const ONLY_GREETING = new RegExp(`^(?:${GREETING_WORD}\\b[\\s,!.?]*)+$`, "i");

/** "hello", "hii", "helloww", "hey there!" — a greeting with nothing else. */
export function isGreetingOnly(input: string) {
  return ONLY_GREETING.test(input.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "").trim());
}

const NAME_PATTERNS = [
  /\b(?:my\s+name\s+is|my\s+name's|my\s+name\s*:?|name\s+is|name's|i\s+am|i'm|im|i\s+m|call\s+me|you\s+can\s+call\s+me|it'?s\s+me|its\s+me|it\s+is\s+me|this\s+is|myself|mera\s+naam|mai\s+hoon|main\s+hoon|me)\s+([a-z][a-z'.-]*)/i,
  /^([a-z][a-z'.-]*)\s+(?:here|this\s+side|hai|hu|hoon|here!)\b/i,
];

const SHOPPING = /(?:\d|₹|\brs\.?\b|\binr\b|\b(?:lakh|lakhs|lac|budget|under|below|within|around|phone|phones|mobile|iphone|android|laptop|laptops|macbook|notebook|tablet|ipad|earbuds|earphones|headphones|headset|airpods|buds|tv|television|watch|smartwatch|camera|speaker|charger|cable|mouse|keyboard|console|gaming|buy|need|want|looking|suggest|recommend|best|cheap|cheaper|price|compare|order|return|delivery|exchange)\b)/i;

/** Words that can follow "I am" / "it's" but are not names. */
const NOT_A_NAME = new Set([
  'a', 'an', 'the', 'not', 'just', 'looking', 'searching', 'shopping', 'here', 'fine', 'good', 'ok', 'okay', 'well',
  'new', 'student', 'buying', 'trying', 'interested', 'going', 'confused', 'back', 'sure', 'yes', 'no', 'nope',
  'hi', 'hii', 'hey', 'hello', 'what', 'why', 'how', 'who', 'help', 'please', 'thanks', 'thank', 'idk', 'nothing',
  'anonymous', 'nobody', 'bot', 'human', 'from', 'in', 'on', 'at', 'very', 'so', 'also', 'really', 'gonna', 'want',
  'need', 'there', 'everyone', 'bhai', 'bro', 'sir', 'madam', 'maam', 'yaar', 'and', 'or', 'but', 'with', 'for', 'to', 'of', 'is', 'am',
]);

export type NameReply = { name: string | null; request: string | null };

function cleanName(raw: string | undefined): string | null {
  if (!raw) return null;
  const word = raw.replace(/[^A-Za-z'-]/g, '').replace(/^['-]+|['-]+$/g, '');
  if (word.length < 2 || word.length > 30 || NOT_A_NAME.has(word.toLowerCase()) || isGreetingOnly(word)) return null;
  // Short all-capital names (initials like "NB") stay as typed.
  if (word.length <= 4 && word === word.toUpperCase()) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Text left after the name clause, kept only if it is a shopping request. */
function trailingRequest(text: string, end: number): string | null {
  const rest = text.slice(end).replace(/^[\s,.;:!-]+/, '').replace(/^(?:and|&|aur|n)\s+/i, '').trim();
  if (!rest) return null;
  // Skip a surname right after the first name: "bhola ram, need a phone".
  const withoutSurname = rest.replace(/^[a-z]+[\s,.;:!-]+(?=\S)/i, (match) => (SHOPPING.test(match) ? match : ''));
  const candidate = SHOPPING.test(withoutSurname) ? withoutSurname : rest;
  return SHOPPING.test(candidate) ? candidate.replace(/^[\s,.;:!-]+/, '').trim() : null;
}

export function parseNameReply(input: string): NameReply {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return { name: null, request: null };
  const withoutGreeting = text.replace(GREETING, '').trim();

  for (const pattern of NAME_PATTERNS) {
    const match = pattern.exec(withoutGreeting);
    if (!match) continue;
    const name = cleanName(match[1]);
    if (!name) continue;
    return { name, request: trailingRequest(withoutGreeting, match.index + match[0].length) };
  }

  if (SHOPPING.test(withoutGreeting)) return { name: null, request: text };

  // A bare reply of one to three words: "aryan", "Shreya K", "bhola ram".
  const words = withoutGreeting.replace(/[!.?,]+$/g, '').split(' ').filter(Boolean);
  if (words.length >= 1 && words.length <= 3 && words.every((word) => /^[a-z][a-z'.-]*$/i.test(word))) {
    return { name: cleanName(words[0]), request: null };
  }
  return { name: null, request: null };
}
