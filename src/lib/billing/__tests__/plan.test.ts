import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPlan, type AvailableSub } from '../plan-select.ts';

const sub = (o: Partial<AvailableSub>): AvailableSub => ({
  id: 'id',
  key: 'k',
  name: 'n',
  currencyCode: 'TRY',
  prices: [{ period: 'YEARLY', price: 3500 }],
  trialConfig: { days: 14 },
  ...o,
});

// The real published plan for the ReturnFlow app: ikas derived the key from the
// Turkish name "İade & Değişim", producing "i" + U+0307 (combining dot above).
const realKey = 'i̇ade&Değişim';

test('empty list → null', () => {
  assert.equal(pickPlan([], 'anything'), null);
});

test('single plan → that plan, even when the pinned env key is wrong', () => {
  const only = sub({ key: realKey, name: 'İade & Değişim' });
  // env has the plain-ascii "i" variant (the historic misconfiguration)
  assert.equal(pickPlan([only], 'iade&Değişim'), only);
});

test('pinned key wins when it exactly matches', () => {
  const a = sub({ key: realKey });
  const b = sub({ key: 'other', currencyCode: 'USD' });
  assert.equal(pickPlan([b, a], realKey), a);
});

test('no pin → prefer yearly TRY', () => {
  const usdYearly = sub({ key: 'usd', currencyCode: 'USD' });
  const tryMonthly = sub({ key: 'trym', prices: [{ period: 'MONTHLY', price: 300 }] });
  const tryYearly = sub({ key: 'tryy' });
  assert.equal(pickPlan([usdYearly, tryMonthly, tryYearly], null)?.key, 'tryy');
});

test('no pin, no TRY yearly → any yearly', () => {
  const eurYearly = sub({ key: 'eur', currencyCode: 'EUR' });
  const tryMonthly = sub({ key: 'm', prices: [{ period: 'MONTHLY', price: 1 }] });
  assert.equal(pickPlan([tryMonthly, eurYearly], null)?.key, 'eur');
});

test('combining-mark key is preserved verbatim', () => {
  const only = sub({ key: realKey });
  assert.equal(pickPlan([only], null)?.key, realKey);
  assert.equal(Buffer.from(pickPlan([only], null)!.key, 'utf8').toString('hex'), '69cc87616465264465c49f69c59f696d');
});
