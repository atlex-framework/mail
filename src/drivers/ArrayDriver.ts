import { randomUUID } from 'node:crypto'

import type { MailDriver, SentMessage } from '../contracts/MailDriver.js'
import type { ResolvedMailMessage } from '../MailMessage.js'

/**
 * In-memory capture driver (tests).
 */
export class ArrayDriver implements MailDriver {
  private readonly sent: SentMessage[] = []

  public async send(message: ResolvedMailMessage): Promise<SentMessage> {
    const sent: SentMessage = {
      messageId: randomUUID(),
      envelope: {
        from: message.from.address,
        to: message.to.map((a) => a.address),
      },
      raw: { message },
    }
    this.sent.push(sent)
    return sent
  }

  public getSent(): SentMessage[] {
    return [...this.sent]
  }

  public getLastSent(): SentMessage | undefined {
    return this.sent[this.sent.length - 1]
  }

  public findSentTo(address: string): SentMessage[] {
    return this.sent.filter((m) => m.envelope.to.includes(address))
  }

  public clear(): void {
    this.sent.length = 0
  }
}
