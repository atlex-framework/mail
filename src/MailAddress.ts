import { MailException } from './exceptions/MailException.js'

export type MailAddressLike = string | { address: string; name?: string } | MailAddress

const SIMPLE_EMAIL_RE =
  // good-enough validation (not RFC-perfect): local@domain.tld
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Email address value object.
 */
export class MailAddress {
  public readonly address: string
  public readonly name?: string

  /**
   * @param address - Email address (e.g. `user@example.com`).
   * @param name - Optional display name.
   * @throws MailException - When address is invalid.
   */
  public constructor(address: string, name?: string) {
    const normalized = address.trim()
    if (!SIMPLE_EMAIL_RE.test(normalized)) {
      throw new MailException(`Invalid email address [${address}].`)
    }
    this.address = normalized
    this.name = name?.trim().length ? name.trim() : undefined
  }

  /**
   * @param input - Address input.
   * @returns Parsed {@link MailAddress}.
   * @throws MailException - When address is invalid.
   */
  public static parse(input: MailAddressLike): MailAddress {
    if (input instanceof MailAddress) return input
    if (typeof input === 'string') return new MailAddress(input)
    return new MailAddress(input.address, input.name)
  }

  /**
   * @returns RFC2822-ish formatted string.
   */
  public toString(): string {
    if (this.name !== undefined) {
      // Keep it simple; nodemailer will handle encoding.
      return `${this.name} <${this.address}>`
    }
    return this.address
  }
}
