/**
 * Structured body for a mailable (markdown/HTML/text and view data).
 */
export class Content {
  public readonly view?: string
  public readonly html?: string
  public readonly text?: string
  public readonly markdown?: string
  public readonly htmlString?: string
  public readonly textString?: string
  public readonly with: Record<string, unknown>

  /**
   * @param opts - Content options.
   */
  public constructor(opts: {
    view?: string
    html?: string
    text?: string
    markdown?: string
    htmlString?: string
    textString?: string
    with?: Record<string, unknown>
  }) {
    this.view = opts.view
    this.html = opts.html
    this.text = opts.text
    this.markdown = opts.markdown
    this.htmlString = opts.htmlString
    this.textString = opts.textString
    this.with = opts.with ?? {}
  }
}
