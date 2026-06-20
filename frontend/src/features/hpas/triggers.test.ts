import { describe, expect, it } from 'vitest'
import { humanizeTrigger } from './triggers'

describe('humanizeTrigger', () => {
  it('collapses a weekday cron window with a range day-of-week', () => {
    expect(
      humanizeTrigger(
        'cron (start=0 1 * * 1-5 end=55 4 * * 1-5 desiredReplicas=5 timezone=Europe/Istanbul)',
      ),
    ).toBe('Mon–Fri 01:00 → 04:55 · 5 replicas · Europe/Istanbul')
  })

  it('collapses a weekend cron window with a day list', () => {
    expect(
      humanizeTrigger(
        'cron (start=55 1 * * 0,6 end=55 7 * * 0,6 desiredReplicas=5 timezone=Europe/Istanbul)',
      ),
    ).toBe('Sun, Sat 01:55 → 07:55 · 5 replicas · Europe/Istanbul')
  })

  it('treats * day-of-week as Daily and omits a missing timezone', () => {
    expect(humanizeTrigger('cron (start=0 9 * * * end=0 18 * * * desiredReplicas=10)')).toBe(
      'Daily 09:00 → 18:00 · 10 replicas',
    )
  })

  it('shows both day sets when start and end differ', () => {
    expect(
      humanizeTrigger('cron (start=0 22 * * 5 end=0 6 * * 1 desiredReplicas=2)'),
    ).toBe('Fri 22:00 → Mon 06:00 · 2 replicas')
  })

  it('uses singular replica for one', () => {
    expect(humanizeTrigger('cron (start=0 8 * * 1 end=0 9 * * 1 desiredReplicas=1)')).toBe(
      'Mon 08:00 → 09:00 · 1 replica',
    )
  })

  it('falls back to the raw string for step expressions outside the safe subset', () => {
    const raw = 'cron (start=*/5 * * * * end=0 9 * * * desiredReplicas=3)'
    expect(humanizeTrigger(raw)).toBe(raw)
  })

  it('falls back to the raw string when day-of-week uses 7 for Sunday', () => {
    const raw = 'cron (start=0 1 * * 7 end=0 2 * * 7 desiredReplicas=1)'
    expect(humanizeTrigger(raw)).toBe(raw)
  })

  it('falls back to the raw string for a wrap-around day range (5-1)', () => {
    const raw = 'cron (start=0 1 * * 5-1 end=0 2 * * 5-1 desiredReplicas=1)'
    expect(humanizeTrigger(raw)).toBe(raw)
  })

  it('brands prometheus and spaces out camelCase metadata keys', () => {
    expect(
      humanizeTrigger('prometheus (metricName=rate_in threshold=5 activationThreshold=2)'),
    ).toBe('Prometheus · metric name rate_in · threshold 5 · activation threshold 2')
  })

  it('shortens a queue URL to its last segment', () => {
    expect(
      humanizeTrigger('aws-sqs-queue (queueURL=https://sqs.eu-central-1/123/orders queueLength=5)'),
    ).toBe('AWS SQS · queue url orders · queue length 5')
  })

  it('passes through text with no parenthesized metadata', () => {
    expect(humanizeTrigger('prometheus')).toBe('prometheus')
  })

  it('returns empty input unchanged', () => {
    expect(humanizeTrigger('')).toBe('')
  })
})
