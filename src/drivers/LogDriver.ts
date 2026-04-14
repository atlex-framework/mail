import { randomUUID } from 'node:crypto'

import type { MailDriver, SentMessage } from '../contracts/MailDriver.js'
import type { ResolvedMailMessage } from '../MailMessage.js'

function color(code: number, text: string): string {
  return `\u001b[${code}m${text}\u001b[0m`
}

/**
 * Stdout logging driver for local development.
 */
export class LogDriver implements MailDriver {
  public async send(message: ResolvedMailMessage): Promise<SentMessage> {
    const now = new Date().toISOString()
    const separator = '-'.repeat(72)
    const to = message.to.map((a) => a.toString()).join(', ')
    const subject = message.subject ?? ''
    const preview = (message.html ?? message.text ?? '').slice(0, 500)
    const attachments = message.attachments.map((a) => a.internal.filename).join(', ')

    // Explicitly allowed by prompt for this driver.

    console.log(
      [
        color(36, `[${now}]`),
        color(90, separator),
        `${color(33, 'To:')} ${to}`,
        `${color(33, 'From:')} ${message.from.toString()}`,
        `${color(33, 'Subject:')} ${subject}`,
        `${color(33, 'HTML preview:')} ${preview}`,
        `${color(33, 'Attachments:')} ${attachments || '-'}`,
        color(90, separator),
      ].join('\n'),
    )

    return {
      messageId: randomUUID(),
      envelope: {
        from: message.from.address,
        to: message.to.map((a) => a.address),
      },
      raw: { logged: true },
    }
  }
}
