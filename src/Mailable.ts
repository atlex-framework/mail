import path from 'node:path'

import { type Attachment, type AttachOptions } from './Attachment.js'
import { type Content } from './Content.js'
import type { MailableContract } from './contracts/MailableContract.js'
import { type Envelope } from './Envelope.js'
import { MailAddress, type MailAddressLike } from './MailAddress.js'
import { MailMessage, type ResolvedMailMessage } from './MailMessage.js'
import { TemplateRenderer } from './TemplateRenderer.js'

type DataBag = Record<string, unknown>

function defaultViewsPath(): string {
  return path.resolve(process.cwd(), 'resources', 'views')
}

/**
 * Base class for application mailables.
 */
export abstract class Mailable implements MailableContract {
  // Queuing defaults (static helpers on the class)
  public static shouldQueue = false
  public static queue = 'default'
  public static delay = 0
  public static connection = 'default'

  protected _message: MailMessage
  protected _locale: string | null = null
  protected _theme = 'default'

  private readonly renderer: TemplateRenderer
  private readonly mailerName: string

  private queuedConnection: string | null = null
  private queuedQueue: string | null = null
  private queuedDelaySeconds: number | null = null

  private bindData: DataBag = {}

  public constructor(opts?: { viewsPath?: string; mailer?: string }) {
    this.mailerName = opts?.mailer ?? 'default'
    const renderer = new TemplateRenderer(opts?.viewsPath ?? defaultViewsPath())
    const message = new MailMessage(renderer, this.mailerName)

    // Ensure queued mailables can be serialized: keep heavy runtime helpers non-enumerable.
    Object.defineProperty(this, 'renderer', {
      value: renderer,
      enumerable: false,
      configurable: false,
    })
    Object.defineProperty(this, '_message', {
      value: message,
      writable: true,
      enumerable: false,
      configurable: false,
    })

    this.renderer = renderer
    this._message = message
  }

  /**
   * Subclass defines envelope + content here.
   */
  public abstract build(): this

  /**
   * Override to set from address dynamically.
   */
  public buildFrom(): this | null {
    return null
  }

  /**
   * Override to compute subject dynamically.
   */
  public buildSubject(): this | null {
    return null
  }

  /**
   * Override to add attachments dynamically.
   */
  public buildAttachments(): Attachment[] {
    return []
  }

  /**
   * Override to return an {@link Envelope}.
   */
  public envelope(): Envelope | null {
    return null
  }

  /**
   * Override to return {@link Content}.
   */
  public content(): Content | null {
    return null
  }

  /**
   * Override to return attachments.
   */
  public attachments(): Attachment[] {
    return []
  }

  /** Fluent envelope helpers **/
  public to(address: string | MailAddress | (string | MailAddress)[], name?: string): this {
    this._message.to(address, name)
    return this
  }
  public cc(address: string | MailAddress | (string | MailAddress)[], name?: string): this {
    this._message.cc(address, name)
    return this
  }
  public bcc(address: string | MailAddress | (string | MailAddress)[], name?: string): this {
    this._message.bcc(address, name)
    return this
  }
  public from(address: string | MailAddress, name?: string): this {
    this._message.from(address, name)
    return this
  }
  public replyTo(address: string | MailAddress, name?: string): this {
    this._message.replyTo(address, name)
    return this
  }
  public subject(text: string): this {
    this._message.subject(text)
    return this
  }

  /** Content helpers **/
  public view(templatePath: string, data: Record<string, unknown> = {}): this {
    this._message.view(templatePath, data)
    return this
  }
  public html(content: string): this {
    this._message.html(content)
    return this
  }
  public text(content: string): this {
    this._message.text(content)
    return this
  }
  public markdown(templatePath: string, data: Record<string, unknown> = {}): this {
    this._message.markdown(templatePath, data)
    return this
  }

  /** Attachment helpers **/
  public attach(attachment: Attachment | string, options?: AttachOptions): this {
    this._message.attach(attachment, options)
    return this
  }
  public attachData(data: Buffer | string, filename: string, options?: AttachOptions): this {
    this._message.attachData(data, filename, options)
    return this
  }
  public attachFromUrl(url: string, options?: AttachOptions): this {
    this._message.attachFromUrl(url, options)
    return this
  }
  public attachMany(attachments: (Attachment | string)[]): this {
    this._message.attachMany(attachments)
    return this
  }
  public embed(pathValue: string, contentId: string): this {
    this._message.embed(pathValue, contentId)
    return this
  }

  /** Headers **/
  public withHeaders(headers: Record<string, string>): this {
    this._message.headers(headers)
    return this
  }
  public priority(level: 1 | 2 | 3 | 4 | 5): this {
    this._message.priority(level)
    return this
  }

  /** Localization **/
  public locale(locale: string): this {
    this._locale = locale
    return this
  }

  public withLocale(locale: string, callback: () => void): this {
    const prev = this._locale
    this._locale = locale
    try {
      callback()
    } finally {
      this._locale = prev
    }
    return this
  }

  /** Theme **/
  public theme(name: string): this {
    this._theme = name
    return this
  }

  /** Data binding **/
  public with(key: string, value: unknown): this
  public with(data: Record<string, unknown>): this
  public with(keyOrData: string | Record<string, unknown>, value?: unknown): this {
    if (typeof keyOrData === 'string') {
      this.bindData = { ...this.bindData, [keyOrData]: value }
      return this
    }
    this.bindData = { ...this.bindData, ...keyOrData }
    return this
  }

  private autoBoundPublicData(): DataBag {
    const out: DataBag = {}
    for (const key of Object.keys(this) as (keyof this)[]) {
      const k = String(key)
      if (k.startsWith('_')) continue
      const val = (this as unknown as Record<string, unknown>)[k]
      if (typeof val === 'function') continue
      out[k] = val
    }
    return out
  }

  /**
   * Render and return HTML without sending.
   */
  public async render(): Promise<string> {
    const msg = await this.toMailMessage(this.mailerName)
    return msg.html ?? ''
  }

  /**
   * Create instance and render for preview.
   */
  public static async renderForPreview(mailer?: string): Promise<string> {
    const instance = new (this as unknown as new () => Mailable)()
    return await instance.toMailMessage(mailer ?? 'default').then((m) => m.html ?? '')
  }

  /** Queuing helpers **/
  public onQueue(queue: string): this {
    this.queuedQueue = queue
    return this
  }
  public onConnection(connection: string): this {
    this.queuedConnection = connection
    return this
  }
  public delay(seconds: number): this {
    this.queuedDelaySeconds = seconds
    return this
  }

  public afterCommit(): this {
    // Placeholder for future ORM transaction integration.
    return this
  }

  /**
   * @internal
   */
  public __getQueueOptions(): { connection: string; queue: string; delay: number } {
    const ctor = this.constructor as typeof Mailable
    return {
      connection: this.queuedConnection ?? ctor.connection,
      queue: this.queuedQueue ?? ctor.queue,
      delay: this.queuedDelaySeconds ?? ctor.delay,
    }
  }

  /**
   * Resolve into a fully-resolved driver payload.
   *
   * @throws MailException - When no recipients are set.
   */
  public async toMailMessage(_mailer: string): Promise<ResolvedMailMessage> {
    // Prefer envelope/content API when provided.
    const env = this.envelope()
    const content = this.content()
    if (env) this._message.applyEnvelope(env)
    if (content) {
      if (content.view) this._message.view(content.view, content.with)
      if (content.markdown) this._message.markdown(content.markdown, content.with)
      if (content.html) this._message.html(content.html)
      if (content.text) this._message.text(content.text)
      if (content.htmlString) this._message.html(content.htmlString)
      if (content.textString) this._message.text(content.textString)
    }
    for (const a of this.attachments()) this._message.attach(a)

    // Call classic build() path too, so users can mix APIs.
    this.build()
    this.buildFrom()
    this.buildSubject()
    for (const a of this.buildAttachments()) this._message.attach(a)

    // Merge data binding into view/markdown tokens: we do this by pushing globals.
    const data = { ...this.autoBoundPublicData(), ...this.bindData }
    this.renderer.addGlobalData(data)

    const defaultsFrom = this._message.getFrom()
    const from =
      defaultsFrom ??
      (env?.from ? MailAddress.parse(env.from as MailAddressLike) : null) ??
      new MailAddress('no-reply@example.com', 'Atlex')

    const resolved = await this._message.toResolved({ from })
    return resolved
  }
}
