import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

import { marked } from 'marked'

import { TemplateNotFoundException } from './exceptions/TemplateNotFoundException.js'

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getByDotNotation(data: Record<string, unknown>, key: string): unknown {
  const parts = key
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean)
  let cur: unknown = data
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function stripHtmlToText(html: string): string {
  return (
    html
      // remove tags
      .replace(/<[^>]*>/g, '')
      // decode a few common entities we create
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

interface ForeachSpec {
  itemsKey: string
  itemVar: string
  body: string
}

function renderConditionals(source: string, data: Record<string, unknown>): string {
  return source.replace(/@if\(([^)]+)\)([\s\S]*?)@endif/g, (_m, condRaw: string, body: string) => {
    const key = String(condRaw).trim()
    const val = getByDotNotation(data, key)
    return Boolean(val) ? body : ''
  })
}

function extractForeachBlocks(source: string): { start: number; end: number; spec: ForeachSpec }[] {
  const blocks: { start: number; end: number; spec: ForeachSpec }[] = []
  const re =
    /@foreach\(\s*([A-Za-z0-9_.]+)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\s*\)([\s\S]*?)@endforeach/g
  for (;;) {
    const match = re.exec(source)
    if (!match) break
    const full = match[0]
    const itemsKey = match[1]
    const itemVar = match[2]
    const body = match[3]
    if (
      full === undefined ||
      itemsKey === undefined ||
      itemVar === undefined ||
      body === undefined
    ) {
      break
    }
    blocks.push({
      start: match.index,
      end: match.index + full.length,
      spec: { itemsKey, itemVar, body },
    })
  }
  return blocks
}

function renderLoops(source: string, data: Record<string, unknown>): string {
  const blocks = extractForeachBlocks(source)
  if (blocks.length === 0) return source

  let out = ''
  let cursor = 0
  for (const block of blocks) {
    out += source.slice(cursor, block.start)
    cursor = block.end

    const items = getByDotNotation(data, block.spec.itemsKey)
    if (!Array.isArray(items)) {
      continue
    }

    for (const item of items) {
      const scoped = { ...data, [block.spec.itemVar]: item }
      out += applyTokens(block.spec.body, scoped)
    }
  }
  out += source.slice(cursor)
  return out
}

function applyTokens(source: string, data: Record<string, unknown>): string {
  // strip blade-style comments
  let out = source.replace(/\{\{--[\s\S]*?--\}\}/g, '')

  // basic conditionals and loops first (so their bodies can contain tokens)
  out = renderConditionals(out, data)
  out = renderLoops(out, data)

  // unescaped blocks
  out = out.replace(
    /\{!!\s*([A-Za-z0-9_.]+)(?:\|([^!]+?))?\s*!!\}/g,
    (_m, key: string, fallback?: string) => {
      const val = getByDotNotation(data, key)
      const resolved = val ?? (fallback !== undefined ? String(fallback) : '')
      return resolved === null || resolved === undefined ? '' : String(resolved)
    },
  )

  // escaped blocks
  out = out.replace(
    /\{\{\s*([A-Za-z0-9_.]+)(?:\|([^}]+?))?\s*\}\}/g,
    (_m, key: string, fallback?: string) => {
      const val = getByDotNotation(data, key)
      const resolved = val ?? (fallback !== undefined ? String(fallback) : '')
      return resolved === null || resolved === undefined ? '' : htmlEscape(String(resolved))
    },
  )

  return out
}

function wrapMarkdownHtml(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body>
    ${bodyHtml}
  </body>
</html>
`
}

/**
 * Responsible for loading and rendering HTML/Markdown email templates.
 */
export class TemplateRenderer {
  private globalData: Record<string, unknown> = {}
  private layoutPath: string | null = null

  /**
   * @param viewsPath - Base path for views (e.g. `resources/views`).
   */
  public constructor(private readonly viewsPath: string) {}

  /**
   * Merge data into every render call.
   */
  public addGlobalData(data: Record<string, unknown>): void {
    this.globalData = { ...this.globalData, ...data }
  }

  /**
   * Wrap all templates in a master layout; `{{slot}}` is replaced with template content.
   */
  public setLayout(layoutPath: string): void {
    this.layoutPath = layoutPath
  }

  /**
   * Render an HTML template by dot-path (e.g. `emails.welcome`).
   *
   * @throws TemplateNotFoundException - When template file does not exist.
   */
  public async render(templatePath: string, data: Record<string, unknown>): Promise<string> {
    const abs = this.resolveTemplatePath(templatePath, 'html')
    await this.assertExists(abs, templatePath)
    const source = await readFile(abs, 'utf8')
    const merged = { ...this.globalData, ...data }
    const content = applyTokens(source, merged)
    return await this.applyLayout(content, merged)
  }

  /**
   * Render a Markdown template.
   *
   * @throws TemplateNotFoundException - When template file does not exist.
   */
  public async renderMarkdown(
    templatePath: string,
    data: Record<string, unknown>,
  ): Promise<{ html: string; text: string }> {
    const abs = this.resolveTemplatePath(templatePath, 'md')
    await this.assertExists(abs, templatePath)
    const source = await readFile(abs, 'utf8')
    const merged = { ...this.globalData, ...data }
    const tokened = applyTokens(source, merged)
    const htmlBody = await marked.parse(tokened)
    const wrapped = wrapMarkdownHtml(htmlBody)
    const html = await this.applyLayout(wrapped, merged)
    const text = stripHtmlToText(html)
    return { html, text }
  }

  private resolveTemplatePath(templatePath: string, ext: 'html' | 'md'): string {
    const rel = templatePath.split('.').join(path.sep) + `.${ext}`
    return path.resolve(this.viewsPath, rel)
  }

  private async assertExists(abs: string, original: string): Promise<void> {
    try {
      await access(abs)
    } catch {
      throw new TemplateNotFoundException(original)
    }
  }

  private async applyLayout(content: string, data: Record<string, unknown>): Promise<string> {
    if (!this.layoutPath) return content
    const abs = this.resolveTemplatePath(this.layoutPath, 'html')
    await this.assertExists(abs, this.layoutPath)
    const layoutSource = await readFile(abs, 'utf8')
    const merged = { ...this.globalData, ...data, slot: content }
    return applyTokens(layoutSource, merged)
  }
}
