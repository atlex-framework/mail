import { EventEmitter } from 'node:events'
import path from 'node:path'

import type { Container } from '@atlex/core'
import { dispatch } from '@atlex/queue'

import type { MailDriver, SentMessage } from './contracts/MailDriver.js'
import { ArrayDriver } from './drivers/ArrayDriver.js'
import { LogDriver } from './drivers/LogDriver.js'
import { MailgunDriver, type MailgunConfig } from './drivers/MailgunDriver.js'
import { SesDriver, type SesConfig } from './drivers/SesDriver.js'
import { SmtpDriver, type SmtpConfig } from './drivers/SmtpDriver.js'
import { DriverNotFoundException } from './exceptions/DriverNotFoundException.js'
import { MailException } from './exceptions/MailException.js'
import { SendMailJob } from './jobs/SendMailJob.js'
import { MailAddress, type MailAddressLike } from './MailAddress.js'
import { MailMessage, type ResolvedMailMessage } from './MailMessage.js'
import { PendingMail } from './PendingMail.js'
import { TemplateRenderer } from './TemplateRenderer.js'
import { MailFake } from './testing/MailFake.js'

export type DriverConfig =
  | (SmtpConfig & { driver: 'smtp' })
  | (MailgunConfig & { driver: 'mailgun' })
  | (SesConfig & { driver: 'ses' })
  | { driver: 'log' }
  | { driver: 'array' }
  | { driver: string; [key: string]: unknown }

export interface MailConfig {
  default: string
  from: { address: string; name: string }
  viewsPath?: string
  mailers: Record<string, DriverConfig>
}

export type { SmtpConfig, MailgunConfig, SesConfig, ResolvedMailMessage }

type DriverFactory = (config: unknown) => MailDriver

/**
 * Central mail facade/registry.
 */
export class MailManager {
  private readonly driverCache = new Map<string, MailDriver>()
  private extensions = new Map<string, DriverFactory>()
  private readonly events: EventEmitter
  private readonly renderer: TemplateRenderer

  private scopedMailerName: string | null = null

  private alwaysFromAddr: MailAddress | null = null
  private alwaysToAddr: MailAddress | null = null
  private alwaysReplyToAddr: MailAddress | null = null
  private alwaysBccAddr: MailAddress | null = null

  public constructor(
    private config: MailConfig,
    private readonly container: Container,
  ) {
    // Allow app to provide an event bus; fallback to node events.
    try {
      this.events = container.make<EventEmitter>('events')
    } catch {
      this.events = new EventEmitter()
    }
    this.renderer = new TemplateRenderer(
      config.viewsPath ?? path.resolve(process.cwd(), 'resources', 'views'),
    )
  }

  public driver(name?: string): MailDriver {
    const driverName = name ?? this.getDefaultDriver()
    const cached = this.driverCache.get(driverName)
    if (cached) return cached
    const created = this.createDriver(driverName)
    this.driverCache.set(driverName, created)
    return created
  }

  public mailer(name: string): MailManager {
    const scoped = new MailManager(this.config, this.container)
    scoped.scopedMailerName = name
    // carry overrides/extensions
    scoped.extensions = this.extensions
    scoped.alwaysFromAddr = this.alwaysFromAddr
    scoped.alwaysToAddr = this.alwaysToAddr
    scoped.alwaysReplyToAddr = this.alwaysReplyToAddr
    scoped.alwaysBccAddr = this.alwaysBccAddr
    return scoped
  }

  public extend(driver: string, factory: (config: unknown) => MailDriver): this {
    this.extensions.set(driver, factory)
    return this
  }

  public getDefaultDriver(): string {
    return this.scopedMailerName ?? this.config.default
  }

  public setDefaultDriver(name: string): void {
    this.config = { ...this.config, default: name }
  }

  public forgetDriver(name?: string): this {
    const driverName = name ?? this.getDefaultDriver()
    this.driverCache.delete(driverName)
    return this
  }

  public purge(name?: string): this {
    return this.forgetDriver(name)
  }

  /** Sending **/
  public to(address: MailAddressLike | MailAddressLike[], name?: string): PendingMail {
    const list = (Array.isArray(address) ? address : [address]).map((a) =>
      typeof a === 'string' ? new MailAddress(a, name) : MailAddress.parse(a),
    )
    return new PendingMail(this, list)
  }

  public cc(address: MailAddressLike | MailAddressLike[], name?: string): PendingMail {
    return this.to([]).cc(address, name)
  }

  public bcc(address: MailAddressLike | MailAddressLike[], name?: string): PendingMail {
    return this.to([]).bcc(address, name)
  }

  public async send(mailable: import('./Mailable.js').Mailable): Promise<SentMessage | void> {
    const ctor = mailable.constructor as typeof import('./Mailable.js').Mailable
    if (ctor.shouldQueue) {
      await this.queue(mailable)
      return
    }
    return await this.sendNow(mailable)
  }

  public async sendNow(
    mailable: import('./Mailable.js').Mailable,
    mailerName?: string,
  ): Promise<SentMessage> {
    const mailer = mailerName ?? this.getDefaultDriver()
    const resolved = await mailable.toMailMessage(mailer)
    const finalMessage = this.applyGlobalOverrides(resolved)
    if (
      finalMessage.to.length === 0 &&
      finalMessage.cc.length === 0 &&
      finalMessage.bcc.length === 0
    ) {
      throw new MailException('Cannot send mailable without any recipients.', undefined, mailable)
    }

    // events
    this.events.emit('mail:sending', { mailable, message: finalMessage })

    try {
      const sent = await this.driver(mailer).send(finalMessage)
      this.events.emit('mail:sent', { mailable, sent })
      return sent
    } catch (cause) {
      const err = cause instanceof Error ? cause : new Error(String(cause))
      this.events.emit('mail:failed', { mailable, error: err })
      if (cause instanceof MailException) throw cause
      throw new MailException('Mail send failed.', cause, mailable)
    }
  }

  public async queue(mailable: import('./Mailable.js').Mailable): Promise<void> {
    const mailer = this.getDefaultDriver()
    const job = new SendMailJob(mailable, mailer)
    const q = mailable.__getQueueOptions()
    await dispatch(job)
      .onConnection(q.connection)
      .onQueue(q.queue)
      .delay(q.delay * 1000)
      .dispatch()
  }

  public async later(delay: number, mailable: import('./Mailable.js').Mailable): Promise<void> {
    const mailer = this.getDefaultDriver()
    const job = new SendMailJob(mailable, mailer)
    const q = mailable.__getQueueOptions()
    await dispatch(job)
      .onConnection(q.connection)
      .onQueue(q.queue)
      .delay(delay * 1000)
      .dispatch()
  }

  public async raw(html: string, callback: (msg: MailMessage) => void): Promise<SentMessage> {
    const mailer = this.getDefaultDriver()
    const message = new MailMessage(this.renderer, mailer)
    message.html(html)
    callback(message)
    const from =
      this.alwaysFromAddr ?? new MailAddress(this.config.from.address, this.config.from.name)
    const resolved = await message.toResolved({ from })
    return await this.driver(mailer).send(resolved)
  }

  /** Global overrides **/
  public alwaysFrom(address: string, name?: string): this {
    this.alwaysFromAddr = new MailAddress(address, name)
    return this
  }

  public alwaysTo(address: string, name?: string): this {
    this.alwaysToAddr = new MailAddress(address, name)
    return this
  }

  public alwaysReplyTo(address: string, name?: string): this {
    this.alwaysReplyToAddr = new MailAddress(address, name)
    return this
  }

  public alwaysBcc(address: string, name?: string): this {
    this.alwaysBccAddr = new MailAddress(address, name)
    return this
  }

  /**
   * Swap the container binding with a fake.
   */
  public static fake(app?: Container): MailFake {
    if (!app) {
      return new MailFake()
    }
    const fake = new MailFake()
    app.instance('mail', fake)
    return fake
  }

  private applyGlobalOverrides(message: ResolvedMailMessage): ResolvedMailMessage {
    const from =
      this.alwaysFromAddr ??
      message.from ??
      new MailAddress(this.config.from.address, this.config.from.name)
    const to = this.alwaysToAddr ? [this.alwaysToAddr] : message.to
    const replyTo = this.alwaysReplyToAddr ?? message.replyTo
    const bcc = this.alwaysBccAddr ? [...message.bcc, this.alwaysBccAddr] : message.bcc
    return { ...message, from, to, replyTo, bcc }
  }

  private createDriver(name: string): MailDriver {
    const mailerConfig = this.config.mailers[name]
    if (!mailerConfig) {
      throw new DriverNotFoundException(name)
    }
    const driver = mailerConfig.driver

    const extension = this.extensions.get(driver)
    if (extension) return extension(mailerConfig)

    switch (driver) {
      case 'smtp':
        return new SmtpDriver(mailerConfig as SmtpConfig)
      case 'mailgun':
        return new MailgunDriver(mailerConfig as MailgunConfig)
      case 'ses':
        return new SesDriver(mailerConfig as SesConfig)
      case 'log':
        return new LogDriver()
      case 'array':
        return new ArrayDriver()
      default:
        throw new DriverNotFoundException(driver)
    }
  }
}
