import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

import { Content } from '../src/Content.js'
import { Envelope } from '../src/Envelope.js'
import { Mailable } from '../src/Mailable.js'

class EnvelopeMail extends Mailable {
  public constructor(public readonly user: { name: string }) {
    super()
  }

  public override envelope(): Envelope | null {
    return new Envelope({ subject: 'Hello' })
  }

  public override content(): Content | null {
    return new Content({ html: '<p>ok</p>' })
  }

  public build(): this {
    return this
  }
}

describe('Mailable', () => {
  test('build sets fields + render returns HTML', async () => {
    const base = path.join(os.tmpdir(), `atlex-mail-mailable-${Date.now()}`)
    await mkdir(path.join(base, 'emails'), { recursive: true })
    await writeFile(
      path.join(base, 'emails', 'welcome.html'),
      '<h1>Hello, {{user.name}}!</h1>',
      'utf8',
    )

    const m = new (class extends Mailable {
      public constructor(public readonly user: { name: string; id: number }) {
        super({ viewsPath: base })
      }
      public build(): this {
        return this.subject('Welcome').view('emails.welcome', { user: this.user })
      }
    })({ name: 'Karen', id: 1 })

    const html = await m.render()
    expect(html).toContain('Hello')
  })

  test('public properties auto-bound + with() merges', async () => {
    const base = path.join(os.tmpdir(), `atlex-mail-mailable-${Date.now()}-2`)
    await mkdir(path.join(base, 'emails'), { recursive: true })
    await writeFile(path.join(base, 'emails', 'x.html'), '<p>{{user.name}} {{extra}}</p>', 'utf8')

    const m = new (class extends Mailable {
      public constructor(public readonly user: { name: string; id: number }) {
        super({ viewsPath: base })
      }
      public build(): this {
        return this.view('emails.x').with('extra', 'OK')
      }
    })({ name: 'Karen', id: 1 })
    const html = await m.render()
    expect(html).toContain('Karen OK')
  })

  test('envelope and content API works', async () => {
    const m = new EnvelopeMail({ name: 'Karen' })
    const msg = await m.toMailMessage('log')
    expect(msg.subject).toBe('Hello')
    expect(msg.html).toContain('ok')
  })
})
