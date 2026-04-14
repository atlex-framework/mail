import type { ResolvedMailMessage } from '../MailManager.js'

export interface SentMessage {
  messageId: string
  envelope: {
    from: string
    to: string[]
  }
  raw: unknown
}

export interface MailDriver {
  /**
   * Send a fully resolved mail message using a concrete driver transport.
   *
   * @param message - The resolved mail message to send.
   * @returns The provider response mapped to a {@link SentMessage}.
   * @throws MailException - When the driver fails to send.
   */
  send(message: ResolvedMailMessage): Promise<SentMessage>
}
