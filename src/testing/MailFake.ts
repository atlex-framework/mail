import { AssertionError } from 'node:assert'

import type { Mailable } from '../Mailable.js'
import type { MailAddressLike } from '../MailAddress.js'
import { MailAddress } from '../MailAddress.js'

interface SentRecord {
  mailable: Mailable
  to: MailAddress[]
}
interface QueuedRecord {
  mailable: Mailable
  to: MailAddress[]
}

function className(ctor: typeof Mailable): string {
  return ctor.name || 'Mailable'
}

function matches(
  record: { mailable: Mailable },
  mailableClass: typeof Mailable,
  callback?: (m: Mailable) => boolean,
): boolean {
  if (!(record.mailable instanceof mailableClass)) return false
  if (callback) return callback(record.mailable)
  return true
}

/**
 * Drop-in replacement for MailManager used in tests.
 */
export class MailFake {
  private sentRecords: SentRecord[] = []
  private queuedRecords: QueuedRecord[] = []
  private interceptors: ((mailable: Mailable) => void)[] = []

  public interceptUsing(callback: (mailable: Mailable) => void): this {
    this.interceptors.push(callback)
    return this
  }

  public recordSent(mailable: Mailable, to: MailAddress[]): void {
    for (const cb of this.interceptors) cb(mailable)
    this.sentRecords.push({ mailable, to })
  }

  public recordQueued(mailable: Mailable, to: MailAddress[]): void {
    for (const cb of this.interceptors) cb(mailable)
    this.queuedRecords.push({ mailable, to })
  }

  /** Assertions **/
  public assertSent(mailableClass: typeof Mailable, callback?: (m: Mailable) => boolean): void {
    if (!this.sentRecords.some((r) => matches(r, mailableClass, callback))) {
      throw new AssertionError({
        message: `Expected [${className(mailableClass)}] to be sent, but it was not.`,
      })
    }
  }

  public assertSentTo(
    to: string | MailAddress,
    mailableClass: typeof Mailable,
    callback?: (m: Mailable) => boolean,
  ): void {
    const address = typeof to === 'string' ? to : to.address
    const ok = this.sentRecords.some(
      (r) => matches(r, mailableClass, callback) && r.to.some((a) => a.address === address),
    )
    if (!ok) {
      throw new AssertionError({
        message: `Expected [${className(mailableClass)}] to be sent to '${address}', but it was not.`,
      })
    }
  }

  public assertNotSent(mailableClass: typeof Mailable): void {
    if (this.sentRecords.some((r) => r.mailable instanceof mailableClass)) {
      throw new AssertionError({
        message: `Expected [${className(mailableClass)}] not to be sent, but it was.`,
      })
    }
  }

  public assertNothingSent(): void {
    if (this.sentRecords.length > 0) {
      throw new AssertionError({
        message: `Expected no mailables to be sent, but ${this.sentRecords.length} were sent.`,
      })
    }
  }

  /**
   * Assert the total number of sent mailables (all classes).
   *
   * @param count - Exact number expected.
   */
  public assertSentTotalCount(count: number): void {
    if (this.sentRecords.length !== count) {
      throw new AssertionError({
        message: `Expected ${count} mailable(s) to be sent in total, but ${this.sentRecords.length} were sent.`,
      })
    }
  }

  public assertSentCount(mailableClass: typeof Mailable, count: number): void {
    const actual = this.sentRecords.filter((r) => r.mailable instanceof mailableClass).length
    if (actual !== count) {
      throw new AssertionError({
        message: `Expected [${className(mailableClass)}] to be sent ${count} time(s), but was sent ${actual} time(s).`,
      })
    }
  }

  public assertSentTimes(mailableClass: typeof Mailable, times: number): void {
    this.assertSentCount(mailableClass, times)
  }

  /** Queued **/
  public assertQueued(mailableClass: typeof Mailable, callback?: (m: Mailable) => boolean): void {
    if (!this.queuedRecords.some((r) => matches(r, mailableClass, callback))) {
      throw new AssertionError({
        message: `Expected [${className(mailableClass)}] to be queued, but it was not.`,
      })
    }
  }

  public assertNotQueued(mailableClass: typeof Mailable): void {
    if (this.queuedRecords.some((r) => r.mailable instanceof mailableClass)) {
      throw new AssertionError({
        message: `Expected [${className(mailableClass)}] not to be queued, but it was.`,
      })
    }
  }

  public assertQueuedTo(to: string, mailableClass: typeof Mailable): void {
    const ok = this.queuedRecords.some(
      (r) => r.mailable instanceof mailableClass && r.to.some((a) => a.address === to),
    )
    if (!ok) {
      throw new AssertionError({
        message: `Expected [${className(mailableClass)}] to be queued to '${to}', but it was not.`,
      })
    }
  }

  public assertNothingQueued(): void {
    if (this.queuedRecords.length > 0) {
      throw new AssertionError({
        message: `Expected no mailables to be queued, but ${this.queuedRecords.length} were queued.`,
      })
    }
  }

  public assertQueuedCount(mailableClass: typeof Mailable, count: number): void {
    const actual = this.queuedRecords.filter((r) => r.mailable instanceof mailableClass).length
    if (actual !== count) {
      throw new AssertionError({
        message: `Expected [${className(mailableClass)}] to be queued ${count} time(s), but was queued ${actual} time(s).`,
      })
    }
  }

  /** Inspection **/
  public sent(mailableClass: typeof Mailable): Mailable[] {
    return this.sentRecords
      .filter((r) => r.mailable instanceof mailableClass)
      .map((r) => r.mailable)
  }

  public queued(mailableClass: typeof Mailable): Mailable[] {
    return this.queuedRecords
      .filter((r) => r.mailable instanceof mailableClass)
      .map((r) => r.mailable)
  }

  public hasSent(mailableClass: typeof Mailable): boolean {
    return this.sentRecords.some((r) => r.mailable instanceof mailableClass)
  }

  public hasQueued(mailableClass: typeof Mailable): boolean {
    return this.queuedRecords.some((r) => r.mailable instanceof mailableClass)
  }

  public reset(): void {
    this.sentRecords = []
    this.queuedRecords = []
    this.interceptors = []
  }

  /** Helpers for integration-style tests **/
  public captureTo(to: MailAddressLike | MailAddressLike[]): MailAddress[] {
    const items = Array.isArray(to) ? to : [to]
    return items.map((a) => (typeof a === 'string' ? new MailAddress(a) : MailAddress.parse(a)))
  }
}
