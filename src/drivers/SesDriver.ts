import {
  SESClient,
  SendRawEmailCommand,
  GetSendQuotaCommand,
  type SESClientConfig,
} from '@aws-sdk/client-ses'
import nodemailer from 'nodemailer'

import type { MailDriver, SentMessage } from '../contracts/MailDriver.js'
import { MailException } from '../exceptions/MailException.js'
import type { ResolvedMailMessage } from '../MailMessage.js'

export interface SesConfig {
  key: string
  secret: string
  region: string
  options?: SESClientConfig
  configurationSetName?: string
}

/**
 * AWS SES driver using raw MIME to support attachments/inline images.
 */
export class SesDriver implements MailDriver {
  private readonly client: SESClient

  public constructor(private readonly config: SesConfig) {
    this.client = new SESClient({
      region: config.region,
      credentials: { accessKeyId: config.key, secretAccessKey: config.secret },
      ...(config.options ?? {}),
    })
  }

  public async getSendQuota(): Promise<{ max24HourSend: number; sentLast24Hours: number }> {
    const res = await this.client.send(new GetSendQuotaCommand({}))
    return {
      max24HourSend: Number(res.Max24HourSend ?? 0),
      sentLast24Hours: Number(res.SentLast24Hours ?? 0),
    }
  }

  public async send(message: ResolvedMailMessage): Promise<SentMessage> {
    try {
      // Use nodemailer stream transport to build full MIME.
      const transport = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
        newline: 'unix',
      })

      const attachments = await Promise.all(
        message.attachments.map(async (a) => await a.toNodemailerAttachment()),
      )
      const info = await transport.sendMail({
        from: message.from.toString(),
        replyTo: message.replyTo?.toString(),
        to: message.to.map((a) => a.toString()),
        cc: message.cc.map((a) => a.toString()),
        bcc: message.bcc.map((a) => a.toString()),
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: {
          ...message.headers,
          ...(this.config.configurationSetName
            ? { 'X-SES-CONFIGURATION-SET': this.config.configurationSetName }
            : {}),
        },
        attachments,
      })

      const raw =
        typeof info.message === 'string'
          ? Buffer.from(info.message)
          : info.message instanceof Buffer
            ? info.message
            : Buffer.from(String(info.message ?? ''))

      const cmd = new SendRawEmailCommand({
        RawMessage: { Data: raw },
      })
      const res = await this.client.send(cmd)

      return {
        messageId: String(res.MessageId ?? ''),
        envelope: { from: message.from.address, to: message.to.map((a) => a.address) },
        raw: res,
      }
    } catch (cause) {
      throw new MailException('SES send failed.', cause)
    }
  }
}
