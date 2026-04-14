import type { ResolvedMailMessage } from '../MailManager.js'

export interface MailableContract {
  /**
   * Build the mailable (set subject, recipients, content, attachments).
   */
  build(): this

  /**
   * Resolve templates/markdown into a fully resolved payload ready for a driver.
   *
   * @param mailer - Mailer name (e.g. "smtp") used for driver-specific rendering options.
   */
  toMailMessage(mailer: string): Promise<ResolvedMailMessage>
}
