import type { AttachOptions } from './Attachment.js'
import { Attachment } from './Attachment.js'
import type { RawMessage } from './Envelope.js'
import { MailAddress, type MailAddressLike } from './MailAddress.js'
import type { TemplateRenderer } from './TemplateRenderer.js'

export interface ResolvedContent {
  html?: string
  text?: string
}

export interface ResolvedMailMessage {
  mailer: string
  from: MailAddress
  replyTo?: MailAddress
  to: MailAddress[]
  cc: MailAddress[]
  bcc: MailAddress[]
  subject?: string
  html?: string
  text?: string
  headers: Record<string, string>
  tags: string[]
  metadata: Record<string, string>
  attachments: Attachment[]
  using: ((msg: RawMessage) => void)[]
}

function normalizeMany(
  input: string | MailAddress | (string | MailAddress)[],
  name?: string,
): MailAddress[] {
  if (Array.isArray(input))
    return input.map((v) => (v instanceof MailAddress ? v : new MailAddress(v)))
  if (input instanceof MailAddress) return [input]
  return [new MailAddress(input, name)]
}

/**
 * Fluent envelope+body message builder.
 */
export class MailMessage {
  private toList: MailAddress[] = []
  private ccList: MailAddress[] = []
  private bccList: MailAddress[] = []
  private fromAddr: MailAddress | undefined
  private replyToAddr: MailAddress | undefined

  private subjectText: string | undefined
  private htmlContent: string | undefined
  private textContent: string | undefined
  private viewRef: { templatePath: string; data: Record<string, unknown> } | null = null
  private markdownRef: { templatePath: string; data: Record<string, unknown> } | null = null

  private headerMap: Record<string, string> = {}
  private tagList: string[] = []
  private metadataMap: Record<string, string> = {}
  private attachmentList: Attachment[] = []
  private usingCallbacks: ((msg: RawMessage) => void)[] = []

  public constructor(
    private readonly renderer: TemplateRenderer,
    private readonly mailer: string,
  ) {}

  /** Addressing **/
  public to(address: string | MailAddress | (string | MailAddress)[], name?: string): this {
    this.toList.push(...normalizeMany(address, name))
    return this
  }

  public cc(address: string | MailAddress | (string | MailAddress)[], name?: string): this {
    this.ccList.push(...normalizeMany(address, name))
    return this
  }

  public bcc(address: string | MailAddress | (string | MailAddress)[], name?: string): this {
    this.bccList.push(...normalizeMany(address, name))
    return this
  }

  public from(address: string | MailAddress, name?: string): this {
    this.fromAddr = address instanceof MailAddress ? address : new MailAddress(address, name)
    return this
  }

  public replyTo(address: string | MailAddress, name?: string): this {
    this.replyToAddr = address instanceof MailAddress ? address : new MailAddress(address, name)
    return this
  }

  /** Content **/
  public subject(text: string): this {
    this.subjectText = text
    return this
  }

  public html(content: string): this {
    this.htmlContent = content
    return this
  }

  public text(content: string): this {
    this.textContent = content
    return this
  }

  public view(templatePath: string, data: Record<string, unknown> = {}): this {
    this.viewRef = { templatePath, data }
    this.markdownRef = null
    return this
  }

  public markdown(templatePath: string, data: Record<string, unknown> = {}): this {
    this.markdownRef = { templatePath, data }
    this.viewRef = null
    return this
  }

  /** Attachments **/
  public attach(attachment: Attachment | string, options?: AttachOptions): this {
    if (typeof attachment === 'string') {
      this.attachmentList.push(
        Attachment.fromPath(attachment, { as: options?.as, mime: options?.mime }),
      )
      return this
    }
    // allow override for inline/disposition
    if (options?.disposition || options?.contentId) {
      const current = attachment.internal
      this.attachmentList.push(
        Attachment.fromSerializable({
          ...current,
          disposition: options.disposition ?? current.disposition,
          contentId: options.contentId ?? current.contentId,
          mimeType: options.mime ?? current.mimeType,
          filename: options.as ?? current.filename,
        }),
      )
      return this
    }
    this.attachmentList.push(attachment)
    return this
  }

  public attachMany(attachments: (Attachment | string)[]): this {
    for (const a of attachments) this.attach(a)
    return this
  }

  public attachData(data: Buffer | string, filename: string, options?: AttachOptions): this {
    this.attachmentList.push(Attachment.fromData(data, filename, { mime: options?.mime }))
    return this
  }

  public attachFromUrl(url: string, options?: AttachOptions): this {
    this.attachmentList.push(Attachment.fromUrl(url, { as: options?.as, mime: options?.mime }))
    return this
  }

  public embed(pathValue: string, contentId: string): this {
    this.attachmentList.push(Attachment.embed(pathValue, contentId))
    return this
  }

  public embedData(data: Buffer | string, contentId: string, mimeType: string): this {
    this.attachmentList.push(Attachment.embedData(data, contentId, mimeType))
    return this
  }

  /** Headers & metadata **/
  public header(key: string, value: string): this {
    this.headerMap[key] = value
    return this
  }

  public headers(headers: Record<string, string>): this {
    this.headerMap = { ...this.headerMap, ...headers }
    return this
  }

  public priority(level: 1 | 2 | 3 | 4 | 5): this {
    this.header('X-Priority', String(level))
    return this
  }

  public tag(name: string): this {
    this.tagList.push(name)
    return this
  }

  public metadata(key: string, value: string): this {
    this.metadataMap[key] = value
    return this
  }

  /** Rendering escape hatches **/
  public withSymfonyMessage(callback: (msg: RawMessage) => void): this {
    this.usingCallbacks.push(callback)
    return this
  }

  public using(callback: (msg: RawMessage) => void): this {
    return this.withSymfonyMessage(callback)
  }

  /** Internal getters **/
  public getTo(): MailAddress[] {
    return [...this.toList]
  }

  public getFrom(): MailAddress | undefined {
    return this.fromAddr
  }

  /**
   * Resolve view/markdown into html/text.
   */
  public async render(): Promise<ResolvedContent> {
    if (this.markdownRef) {
      const rendered = await this.renderer.renderMarkdown(
        this.markdownRef.templatePath,
        this.markdownRef.data,
      )
      return { html: rendered.html, text: rendered.text }
    }
    if (this.viewRef) {
      const html = await this.renderer.render(this.viewRef.templatePath, this.viewRef.data)
      return { html, text: this.textContent }
    }
    return { html: this.htmlContent, text: this.textContent }
  }

  /**
   * Serialize to nodemailer payload.
   */
  public async toNodemailerPayload(): Promise<Record<string, unknown>> {
    const { html, text } = await this.render()
    const attachments = await Promise.all(
      this.attachmentList.map(async (a) => await a.toNodemailerAttachment()),
    )
    return {
      from: this.fromAddr?.toString(),
      replyTo: this.replyToAddr?.toString(),
      to: this.toList.map((a) => a.toString()),
      cc: this.ccList.map((a) => a.toString()),
      bcc: this.bccList.map((a) => a.toString()),
      subject: this.subjectText,
      html,
      text,
      headers: this.headerMap,
      attachments,
    }
  }

  /**
   * Resolve into a driver-agnostic payload.
   *
   * @param defaults - Default addressing values.
   */
  public async toResolved(defaults: {
    from: MailAddress
    replyTo?: MailAddress
  }): Promise<ResolvedMailMessage> {
    const { html, text } = await this.render()
    return {
      mailer: this.mailer,
      from: this.fromAddr ?? defaults.from,
      replyTo: this.replyToAddr ?? defaults.replyTo,
      to: [...this.toList],
      cc: [...this.ccList],
      bcc: [...this.bccList],
      subject: this.subjectText,
      html,
      text,
      headers: { ...this.headerMap },
      tags: [...this.tagList],
      metadata: { ...this.metadataMap },
      attachments: [...this.attachmentList],
      using: [...this.usingCallbacks],
    }
  }

  /**
   * Apply envelope data from a high-level {@link Envelope}.
   */
  public applyEnvelope(envelope: {
    from?: MailAddressLike
    replyTo?: MailAddressLike
    to?: MailAddressLike[]
    cc?: MailAddressLike[]
    bcc?: MailAddressLike[]
    subject?: string
    tags?: string[]
    metadata?: Record<string, string>
    using?: ((msg: RawMessage) => void)[]
  }): this {
    if (envelope.from) this.from(MailAddress.parse(envelope.from))
    if (envelope.replyTo) this.replyTo(MailAddress.parse(envelope.replyTo))
    if (envelope.to) this.to(envelope.to.map((a) => MailAddress.parse(a)))
    if (envelope.cc) this.cc(envelope.cc.map((a) => MailAddress.parse(a)))
    if (envelope.bcc) this.bcc(envelope.bcc.map((a) => MailAddress.parse(a)))
    if (envelope.subject) this.subject(envelope.subject)
    if (envelope.tags) for (const t of envelope.tags) this.tag(t)
    if (envelope.metadata)
      for (const [k, v] of Object.entries(envelope.metadata)) this.metadata(k, v)
    if (envelope.using) for (const cb of envelope.using) this.using(cb)
    return this
  }
}
