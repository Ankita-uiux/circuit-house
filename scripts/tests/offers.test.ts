import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANK_QUESTION, isOfferQuestion, officialBankUrl, validateBenefits, offerProducts, offerReply, lookupOffers, type BankBenefit } from '../../artifacts/api-server/src/lib/offers';
import { EMPTY_STATE } from '../../artifacts/api-server/src/lib/conversation-state';
import type OpenAI from 'openai';

const url = 'https://www.sbicard.com/en/faq/flexipay.page';
const benefit: BankBenefit = { title: 'SBI Card Flexipay', details: 'Convert eligible purchases into instalments.', conditions: 'Subject to issuer approval, interest and fees.', sourceUrl: url, validFrom: null, validUntil: null, ongoing: true, scope: 'issuer', minSpend: 3000 };
const product = { id: 'test-phone', name: 'Test Phone 12', price: 10000, category: 'Phones' };

test('offer requests and bank follow-ups are recognised without changing ordinary shopping', () => {
  for (const text of ['Any offers?', 'EMI?', 'discount hai kya', 'student coupon', 'bank cashback', 'any deals']) assert.equal(isOfferQuestion(text), true);
  assert.equal(isOfferQuestion('HDFC credit card', BANK_QUESTION), true);
  assert.equal(isOfferQuestion('HDFC credit card'), false);
  assert.equal(isOfferQuestion('I need a laptop'), false);
});
test('source verification rejects lookalikes, external sites, credentials and insecure URLs', () => {
  assert.equal(officialBankUrl(url), true);
  for (const candidate of ['https://sbicard.com.evil.test', 'http://sbicard.com', 'https://user@sbicard.com', 'https://amazon.in', 'https://sbicard.com:444']) assert.equal(officialBankUrl(candidate), false);
});
test('reject expired, future, undated campaigns and merchant-exclusive offers', () => {
  const check = (patch: Partial<BankBenefit>) => validateBenefits([{ ...benefit, ...patch }], [url], 10000, '2026-10-16');
  assert.equal(check({}).length, 1);
  for (const patch of [{ validUntil: '2026-10-15' }, { validFrom: '2026-10-17' }, { ongoing: false }, { scope: 'merchant' as const }, { details: '10% off at Flipkart' }, { validUntil: '2026-02-30' }, { sourceUrl: 'https://sbicard.com/uncited' }, { minSpend: 12000 }]) assert.equal(check(patch).length, 0);
  assert.equal(validateBenefits([benefit], [url], null, '2026-10-16').length, 0);
});
test('product references prefer the named product and preserve ambiguous selections', () => {
  const second = { ...product, id: 'other', name: 'Another Phone' };
  const state = { ...EMPTY_STATE, last_discussed: { category: 'Phones', products: [product.id, second.id] } };
  assert.equal(offerProducts('Any offers?', null, state, [product, second]).length, 2);
  assert.deepEqual(offerProducts('Offers for Test Phone 12?', null, state, [product, second]), [product]);
  assert.deepEqual(offerProducts('Any offers?', 'Another Phone', state, [product, second]), [second]);
});
test('coupon maths matches checkout and bank failures cannot become invented offers', () => {
  const result = offerReply([product], { status: 'unavailable', checkedAt: null, benefits: [] }, false);
  assert.match(result, /save ₹500; total ₹9,500/);
  assert.match(result, /couldn’t verify/);
  assert.match(result, /not enabled/);
  const cheap = offerReply([{ ...product, price: 2999 }], { status: 'not-needed', checkedAt: null, benefits: [] }, true);
  assert.match(cheap, /below the minimum/);
  assert.ok(cheap.endsWith(BANK_QUESTION));
  assert.doesNotMatch(result, /demo|no.cost EMI/i);
});
test('lookup uses official search, redacts raw chat data, validates evidence and caches results', async () => {
  let searches = 0;
  let input = '';
  const mock = {
    responses: { create: async (request: { input: string; tool_choice: string }) => {
      searches++; input = request.input; assert.equal(request.tool_choice, 'required');
      return { status: 'completed', output_text: 'Official issuer evidence', output: [{ type: 'web_search_call', status: 'completed' }, { type: 'message', content: [{ type: 'output_text', annotations: [{ type: 'url_citation', url }] }] }] };
    } },
    chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({ benefits: [benefit] }) } }] }) } },
  } as unknown as OpenAI;
  const first = await lookupOffers(mock, 'SBI EMI, my name is Private Person and my card is 4111111111111111', product);
  assert.equal(first.status, 'used'); assert.equal(first.benefits.length, 1);
  assert.doesNotMatch(input, /Private Person|4111111111111111/);
  assert.match(input, /SBI Card/);
  await lookupOffers(mock, 'SBI EMI', product);
  assert.equal(searches, 1);
});
test('failed research returns unavailable, never an invented fallback benefit', async () => {
  const mock = { responses: { create: async () => { throw new Error('timeout'); } } } as unknown as OpenAI;
  assert.deepEqual(await lookupOffers(mock, 'Axis offers', product), { status: 'unavailable', checkedAt: null, benefits: [] });
});
