import { Job } from '@atlex/queue'

import type { Mailable } from '../Mailable.js'

/**
 * Dispatchable job for queued mailables.
 */
export class SendMailJob extends Job {
  public static override queue = 'default'
  public static override tries = 3
  public static override backoff = [10, 60, 300]

  public constructor(
    private readonly mailable: Mailable,
    private readonly mailerName: string,
  ) {
    super()
  }

  public async handle(): Promise<void> {
    const app = this._app()
    if (app === null) {
      throw new Error('SendMailJob cannot resolve MailManager: job runtime app is missing.')
    }
    const mailer = app.make<import('../MailManager.js').MailManager>('mail')
    await mailer.sendNow(this.mailable, this.mailerName)
  }

  public override failed(_error: Error): void {
    // MailManager already emits mail:failed on sendNow failures.
  }
}
