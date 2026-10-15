import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNameReply } from '../../artifacts/api-server/src/lib/participant-name';

const cases: Array<[string, string | null, string | null]> = [
  ['hi i am aryan', 'Aryan', null],
  ['call me mrigank', 'Mrigank', null],
  ['hey, my name is aditya', 'Aditya', null],
  ["heyy it's me shreya", 'Shreya', null],
  ['my name is bhola ram', 'Bhola', null],
  ['Aryan', 'Aryan', null],
  ['shreya k', 'Shreya', null],
  ['iphone under 50k', null, 'iphone under 50k'],
  ['best laptops under 70k', null, 'best laptops under 70k'],
  ["hi i'm aryan, need a phone under 20k", 'Aryan', 'need a phone under 20k'],
  ['mera naam rohit hai', 'Rohit', null],
  ['I am looking for a laptop', null, 'I am looking for a laptop'],
  ['what is this?', null, null],
  ['call me NB', 'NB', null],
  ['hello', null, null],
  ['helloww', null, null],
  ['hii there', null, null],
  ['helloww i am aryan', 'Aryan', null],
  ["hey, I'm Priya", 'Priya', null],
];

for (const [input, name, request] of cases) {
  test(`name reply: ${input}`, () => {
    const parsed = parseNameReply(input);
    assert.equal(parsed.name, name);
    assert.equal(parsed.request, request);
  });
}

import { isGreetingOnly } from '../../artifacts/api-server/src/lib/participant-name';
test('greeting-only replies', () => {
  for (const g of ['hello', 'helloww', 'Hii!', 'hey there 👋', 'heyyy']) assert.equal(isGreetingOnly(g), true, g);
  for (const g of ['hello I am Aryan', 'aryan', 'hi need a phone']) assert.equal(isGreetingOnly(g), false, g);
});
