import type { Mailable } from '../Mailable.js'

/**
 * Base error for all mail-related failures.
 */
export class MailException extends Error {
  public constructor(
    message: string,
    public override readonly cause?: unknown,
    public readonly mailable?: Mailable,
  ) {
    super(message)
    this.name = 'MailException'
  }
}
