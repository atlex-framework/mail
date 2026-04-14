import { readFile } from 'node:fs/promises'

import { MailException } from './exceptions/MailException.js'

export type AttachmentInternal = Readonly<{
  type: 'path' | 'data' | 'url'
  source: string | Buffer
  filename: string
  mimeType?: string
  disposition: 'attachment' | 'inline'
  contentId?: string
}>

export interface AttachOptions {
  as?: string
  mime?: string
  disposition?: 'attachment' | 'inline'
  contentId?: string
}

/**
 * Attachment value object.
 */
export class Attachment {
  public readonly internal: AttachmentInternal

  private constructor(internal: AttachmentInternal) {
    this.internal = internal
  }

  /**
   * Attach a file from local disk.
   *
   * @param path - Absolute/relative path on disk.
   * @param options - Attachment options.
   */
  public static fromPath(path: string, options?: { as?: string; mime?: string }): Attachment {
    const filename = options?.as ?? path.split('/').pop() ?? 'attachment'
    return new Attachment({
      type: 'path',
      source: path,
      filename,
      mimeType: options?.mime,
      disposition: 'attachment',
    })
  }

  /**
   * Attach raw data.
   *
   * @param data - Attachment bytes or string content.
   * @param filename - File name presented to recipients.
   * @param options - Attachment options.
   */
  public static fromData(
    data: Buffer | string,
    filename: string,
    options?: { mime?: string },
  ): Attachment {
    return new Attachment({
      type: 'data',
      source: typeof data === 'string' ? Buffer.from(data) : data,
      filename,
      mimeType: options?.mime,
      disposition: 'attachment',
    })
  }

  /**
   * Attach data from a remote URL (fetched on send).
   *
   * @param url - Remote URL.
   * @param options - Attachment options.
   */
  public static fromUrl(url: string, options?: { as?: string; mime?: string }): Attachment {
    const filename = options?.as ?? url.split('/').pop() ?? 'attachment'
    return new Attachment({
      type: 'url',
      source: url,
      filename,
      mimeType: options?.mime,
      disposition: 'attachment',
    })
  }

  /**
   * Convert to nodemailer-compatible attachment object.
   *
   * @returns Nodemailer attachment payload.
   * @throws MailException - When a URL cannot be fetched.
   */
  public async toNodemailerAttachment(): Promise<Record<string, unknown>> {
    const base: Record<string, unknown> = {
      filename: this.internal.filename,
      contentType: this.internal.mimeType,
      contentDisposition: this.internal.disposition,
      cid: this.internal.contentId,
    }

    if (this.internal.type === 'path') {
      return { ...base, path: this.internal.source }
    }
    if (this.internal.type === 'data') {
      return { ...base, content: this.internal.source }
    }

    const url = String(this.internal.source)
    const res = await fetch(url)
    if (!res.ok) {
      throw new MailException(`Failed to fetch attachment from URL [${url}] (HTTP ${res.status}).`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    return { ...base, content: buf }
  }

  /**
   * Resolve attachment into a JSON-serializable shape suitable for queue payloads.
   *
   * Ensures no Buffer data is embedded for queue persistence.
   *
   * @throws MailException - If attachment cannot be serialized safely.
   */
  public toSerializable(): AttachmentInternal {
    if (this.internal.type === 'data') {
      throw new MailException(
        'Cannot serialize data attachments for queued mail. Use fromPath() or fromUrl() attachments for queued mailables.',
      )
    }
    return this.internal
  }

  /**
   * Rehydrate a serialized attachment.
   */
  public static fromSerializable(serialized: AttachmentInternal): Attachment {
    return new Attachment(serialized)
  }

  /**
   * Embed a local file inline with CID.
   *
   * @param path - File path.
   * @param contentId - CID value.
   * @param mimeType - Optional MIME type.
   */
  public static embed(path: string, contentId: string, mimeType?: string): Attachment {
    const filename = path.split('/').pop() ?? 'inline'
    return new Attachment({
      type: 'path',
      source: path,
      filename,
      mimeType,
      disposition: 'inline',
      contentId,
    })
  }

  /**
   * Embed raw data inline with CID.
   *
   * @param data - Raw content.
   * @param contentId - CID.
   * @param mimeType - MIME type.
   */
  public static embedData(data: Buffer | string, contentId: string, mimeType: string): Attachment {
    return new Attachment({
      type: 'data',
      source: typeof data === 'string' ? Buffer.from(data) : data,
      filename: contentId,
      mimeType,
      disposition: 'inline',
      contentId,
    })
  }

  /**
   * Helper for tests: load a local file as data attachment.
   */
  public static async fromPathAsData(
    path: string,
    filename?: string,
    mimeType?: string,
  ): Promise<Attachment> {
    const buf = await readFile(path)
    return new Attachment({
      type: 'data',
      source: buf,
      filename: filename ?? path.split('/').pop() ?? 'attachment',
      mimeType,
      disposition: 'attachment',
    })
  }
}
