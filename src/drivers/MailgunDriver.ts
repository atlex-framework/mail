import { readFile } from 'node:fs/promises'

import type { MailDriver, SentMessage } from '../contracts/MailDriver.js'
import { MailException } from '../exceptions/MailException.js'
import type { ResolvedMailMessage } from '../MailMessage.js'

export interface MailgunConfig {
  apiKey: string
  domain: string
  endpoint?: 'https://api.mailgun.net' | 'https://api.eu.mailgun.net'
  webhookSigningKey?: string
}

function basicAuth(apiKey: string): string {
  const raw = `api:${apiKey}`
  return `Basic ${Buffer.from(raw).toString('base64')}`
}

/**
 * Mailgun HTTP API driver (fetch, no SDK).
 */
export class MailgunDriver implements MailDriver {
  private readonly endpoint: string

  public constructor(private readonly config: MailgunConfig) {
    this.endpoint = config.endpoint ?? 'https://api.mailgun.net'
  }

  public async verifyDomain(): Promise<boolean> {
    const url = `${this.endpoint}/v4/domains/${encodeURIComponent(this.config.domain)}`
    const res = await fetch(url, {
      headers: { Authorization: basicAuth(this.config.apiKey) },
    })
    return res.ok
  }

  public async send(message: ResolvedMailMessage): Promise<SentMessage> {
    try {
      const url = `${this.endpoint}/v3/${encodeURIComponent(this.config.domain)}/messages`
      const form = new FormData()
      form.set('from', message.from.toString())
      form.set('to', message.to.map((a) => a.toString()).join(','))
      if (message.cc.length) form.set('cc', message.cc.map((a) => a.toString()).join(','))
      if (message.bcc.length) form.set('bcc', message.bcc.map((a) => a.toString()).join(','))
      if (message.subject) form.set('subject', message.subject)
      if (message.text) form.set('text', message.text)
      if (message.html) form.set('html', message.html)

      // Tags + metadata
      for (const t of message.tags) form.append('o:tag', t)
      for (const [k, v] of Object.entries(message.metadata)) form.append(`v:${k}`, v)
      for (const [k, v] of Object.entries(message.headers)) form.append(`h:${k}`, v)

      // Attachments
      for (const a of message.attachments) {
        const nm = await a.toNodemailerAttachment()
        const filename = String(nm.filename ?? a.internal.filename)
        if (typeof nm.path === 'string') {
          const buf = await readFile(nm.path)
          form.append('attachment', new Blob([buf]), filename)
        } else if (nm.content instanceof Buffer) {
          form.append('attachment', new Blob([nm.content]), filename)
        } else {
          // ignore unknown attachment types for this driver
        }
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: basicAuth(this.config.apiKey),
        },
        body: form,
      })

      const raw = await res.text()
      if (!res.ok) {
        throw new MailException(`Mailgun send failed (HTTP ${res.status}).`, raw)
      }

      // Mailgun returns JSON with id/message
      let parsed: unknown = raw
      try {
        parsed = JSON.parse(raw) as unknown
      } catch {
        // ignore
      }
      const messageId = (() => {
        if (typeof parsed !== 'object' || parsed === null) return ''
        const rec = parsed as Record<string, unknown>
        const id = rec.id
        return typeof id === 'string' ? id : ''
      })()
      return {
        messageId,
        envelope: { from: message.from.address, to: message.to.map((a) => a.address) },
        raw: parsed,
      }
    } catch (cause) {
      if (cause instanceof MailException) throw cause
      throw new MailException('Mailgun send failed.', cause)
    }
  }
}
