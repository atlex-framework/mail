import type { SentMessage } from './contracts/MailDriver.js'
import type { Mailable } from './Mailable.js'
import { MailAddress, type MailAddressLike } from './MailAddress.js'
import type { MailManager } from './MailManager.js'

/**
 * Intermediate builder returned by {@link MailManager.to}.
 */
export class PendingMail {
  private ccList: MailAddress[] = []
  private bccList: MailAddress[] = []
  private localeValue: string | null = null

  public constructor(
    private readonly mailer: MailManager,
    private readonly toList: MailAddress[],
  ) {}

  public cc(address: MailAddressLike | MailAddressLike[], name?: string): this {
    const items = Array.isArray(address) ? address : [address]
    for (const a of items) {
      this.ccList.push(typeof a === 'string' ? new MailAddress(a, name) : MailAddress.parse(a))
    }
    return this
  }

  public bcc(address: MailAddressLike | MailAddressLike[], name?: string): this {
    const items = Array.isArray(address) ? address : [address]
    for (const a of items) {
      this.bccList.push(typeof a === 'string' ? new MailAddress(a, name) : MailAddress.parse(a))
    }
    return this
  }

  public locale(locale: string): this {
    this.localeValue = locale
    return this
  }

  public async send(mailable: Mailable): Promise<SentMessage | void> {
    mailable.to(this.toList)
    if (this.ccList.length) mailable.cc(this.ccList)
    if (this.bccList.length) mailable.bcc(this.bccList)
    if (this.localeValue) mailable.locale(this.localeValue)
    return await this.mailer.send(mailable)
  }

  public async sendNow(mailable: Mailable): Promise<SentMessage> {
    mailable.to(this.toList)
    if (this.ccList.length) mailable.cc(this.ccList)
    if (this.bccList.length) mailable.bcc(this.bccList)
    if (this.localeValue) mailable.locale(this.localeValue)
    return await this.mailer.sendNow(mailable)
  }

  public async queue(mailable: Mailable): Promise<void> {
    mailable.to(this.toList)
    if (this.ccList.length) mailable.cc(this.ccList)
    if (this.bccList.length) mailable.bcc(this.bccList)
    if (this.localeValue) mailable.locale(this.localeValue)
    await this.mailer.queue(mailable)
  }

  public async later(delay: number, mailable: Mailable): Promise<void> {
    mailable.to(this.toList)
    if (this.ccList.length) mailable.cc(this.ccList)
    if (this.bccList.length) mailable.bcc(this.bccList)
    if (this.localeValue) mailable.locale(this.localeValue)
    await this.mailer.later(delay, mailable)
  }
}
