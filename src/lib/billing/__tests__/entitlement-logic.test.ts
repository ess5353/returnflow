import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEntitlement, type BillingRow } from '../entitlement-logic.ts';

const NOW = new Date('2026-09-07T12:00:00.000Z');
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 86400_000).toISOString();

const row = (o: Partial<BillingRow>): BillingRow => ({
  plan: 'trial',
  status: 'active',
  trial_ends_at: null,
  current_period_end: null,
  ikas_status: null,
  ...o,
});

test('1. new merchant, trial day 1 → allowed', () => {
  const e = evaluateEntitlement(row({ plan: 'trial', trial_ends_at: daysFromNow(13) }), NOW);
  assert.equal(e.isActive, true);
  assert.equal(e.isExpired, false);
});

test('2. merchant, trial day 13 (1 day left) → allowed', () => {
  const e = evaluateEntitlement(row({ plan: 'trial', trial_ends_at: daysFromNow(1) }), NOW);
  assert.equal(e.isActive, true);
});

test('3. trial expired yesterday → blocked', () => {
  const e = evaluateEntitlement(row({ plan: 'trial', trial_ends_at: daysFromNow(-1) }), NOW);
  assert.equal(e.isActive, false);
  assert.equal(e.isExpired, true);
  assert.equal(e.blockedReason, 'trial_expired');
});

test('trial expired seconds ago (no grace) → blocked', () => {
  const e = evaluateEntitlement(
    row({ plan: 'trial', trial_ends_at: new Date(NOW.getTime() - 1000).toISOString() }),
    NOW,
  );
  assert.equal(e.isActive, false);
});

test('11. paid active (pro, period in future) → allowed', () => {
  const e = evaluateEntitlement(
    row({ plan: 'pro', status: 'active', current_period_end: daysFromNow(200) }),
    NOW,
  );
  assert.equal(e.isActive, true);
  assert.equal(e.plan, 'pro');
});

test('pro will_expire but still within period → allowed', () => {
  const e = evaluateEntitlement(
    row({ plan: 'pro', status: 'will_expire', current_period_end: daysFromNow(30) }),
    NOW,
  );
  assert.equal(e.isActive, true);
});

test('pro period ended, within 3-day grace → still allowed', () => {
  const e = evaluateEntitlement(
    row({ plan: 'pro', status: 'active', current_period_end: daysFromNow(-2) }),
    NOW,
  );
  assert.equal(e.isActive, true);
});

test('pro period ended > 3-day grace → blocked', () => {
  const e = evaluateEntitlement(
    row({ plan: 'pro', status: 'active', current_period_end: daysFromNow(-4) }),
    NOW,
  );
  assert.equal(e.isActive, false);
  assert.equal(e.blockedReason, 'subscription_expired');
});

test('explicit status=expired (pro) → blocked as subscription_expired', () => {
  const e = evaluateEntitlement(
    row({ plan: 'pro', status: 'expired', current_period_end: daysFromNow(30) }),
    NOW,
  );
  assert.equal(e.isActive, false);
  assert.equal(e.blockedReason, 'subscription_expired');
});

test('cancelled trial (status=expired) → blocked as trial_expired', () => {
  const e = evaluateEntitlement(row({ plan: 'trial', status: 'expired', trial_ends_at: daysFromNow(5) }), NOW);
  assert.equal(e.isActive, false);
  assert.equal(e.blockedReason, 'trial_expired');
});

test('enterprise with no period end → allowed (manually managed)', () => {
  const e = evaluateEntitlement(row({ plan: 'enterprise', status: 'active', current_period_end: null }), NOW);
  assert.equal(e.isActive, true);
});

test('12. re-subscribed after expiry (pro active, future period) → access restored', () => {
  const e = evaluateEntitlement(
    row({ plan: 'pro', status: 'active', current_period_end: daysFromNow(365) }),
    NOW,
  );
  assert.equal(e.isActive, true);
});

test('no billing row at all → blocked (fail closed)', () => {
  const e = evaluateEntitlement(null, NOW);
  assert.equal(e.isActive, false);
  assert.equal(e.blockedReason, 'not_installed');
});

test('trial row with null trial_ends_at is NOT treated as expired here (repair happens upstream)', () => {
  // evaluateEntitlement is pure; the DB layer repairs the missing date first.
  const e = evaluateEntitlement(row({ plan: 'trial', trial_ends_at: null }), NOW);
  assert.equal(e.isActive, true);
});
