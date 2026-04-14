import { MailAddress, type MailAddressLike } from './MailAddress.js'

export type RawMessage = Record<string, unknown>

/**
 * Structured envelope metadata for a mailable (subject, recipients, tags).
 */
export class Envelope {
  public readonly from?: MailAddress
  public readonly replyTo?: MailAddress
  public readonly to: MailAddress[]
  public readonly cc: MailAddress[]
  public readonly bcc: MailAddress[]
  public readonly subject?: string
  public readonly tags: string[]
  public readonly metadata: Record<string, string>
  public readonly using: ((msg: RawMessage) => void)[]

  /**
   * @param opts - Envelope options.
   */
  public constructor(opts: {
    from?: string | MailAddress
    replyTo?: string | MailAddress
    to?: MailAddressLike[]
    cc?: MailAddressLike[]
    bcc?: MailAddressLike[]
    subject?: string
    tags?: string[]
    metadata?: Record<string, string>
    using?: ((msg: RawMessage) => void)[]
  }) {
    this.from = opts.from ? MailAddress.parse(opts.from) : undefined
    this.replyTo = opts.replyTo ? MailAddress.parse(opts.replyTo) : undefined
    this.to = (opts.to ?? []).map((a) => MailAddress.parse(a))
    this.cc = (opts.cc ?? []).map((a) => MailAddress.parse(a))
    this.bcc = (opts.bcc ?? []).map((a) => MailAddress.parse(a))
    this.subject = opts.subject
    this.tags = opts.tags ?? []
    this.metadata = opts.metadata ?? {}
    this.using = opts.using ?? []
  }
}
