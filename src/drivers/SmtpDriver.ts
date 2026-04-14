import nodemailer, { type Transporter } from 'nodemailer'

import type { MailDriver, SentMessage } from '../contracts/MailDriver.js'
import { MailException } from '../exceptions/MailException.js'
import type { ResolvedMailMessage } from '../MailMessage.js'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  encryption?: 'tls' | 'ssl' | 'starttls'
  timeout?: number
  dsn?: { notify: string[]; return: 'HDRS' | 'FULL' }
  proxy?: string
}

/**
 * SMTP driver backed by nodemailer.
 */
export class SmtpDriver implements MailDriver {
  private readonly transporter: Transporter

  public constructor(private readonly config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.username,
        pass: this.config.password,
      },
      connectionTimeout: this.config.timeout,
    })
  }

  /**
   * Verify transport connectivity.
   */
  public async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      return true
    } catch {
      return false
    }
  }

  public async send(message: ResolvedMailMessage): Promise<SentMessage> {
    try {
      const attachments = await Promise.all(
        message.attachments.map(async (a) => await a.toNodemailerAttachment()),
      )
      const info = await this.transporter.sendMail({
        from: message.from.toString(),
        replyTo: message.replyTo?.toString(),
        to: message.to.map((a) => a.toString()),
        cc: message.cc.map((a) => a.toString()),
        bcc: message.bcc.map((a) => a.toString()),
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
        attachments,
      })
      return {
        messageId: String(info.messageId ?? ''),
        envelope: {
          from: message.from.address,
          to: message.to.map((a) => a.address),
        },
        raw: info,
      }
    } catch (cause) {
      throw new MailException('SMTP send failed.', cause)
    }
  }

  /**
   * Alternate constructor for SES transport via nodemailer.
   */
  public static ses(_sesClient: unknown, _options?: unknown): SmtpDriver {
    throw new MailException('SmtpDriver.ses is not implemented in this build.')
  }
}
