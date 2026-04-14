import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

import { TemplateNotFoundException } from '../src/exceptions/TemplateNotFoundException.js'
import { TemplateRenderer } from '../src/TemplateRenderer.js'

describe('TemplateRenderer', () => {
  test('replaces {{variable}} and escapes html', async () => {
    const base = path.join(os.tmpdir(), `atlex-mail-${Date.now()}-1`)
    await mkdir(path.join(base, 'emails'), { recursive: true })
    await writeFile(path.join(base, 'emails', 'welcome.html'), '<p>{{name}}</p>', 'utf8')

    const r = new TemplateRenderer(base)
    const out = await r.render('emails.welcome', { name: `<&"'` })
    expect(out).toBe('<p>&lt;&amp;&quot;&#039;</p>')
  })

  test('{!! unescaped !!} is not escaped', async () => {
    const base = path.join(os.tmpdir(), `atlex-mail-${Date.now()}-2`)
    await mkdir(path.join(base, 'emails'), { recursive: true })
    await writeFile(path.join(base, 'emails', 'x.html'), '<div>{!!html!!}</div>', 'utf8')

    const r = new TemplateRenderer(base)
    const out = await r.render('emails.x', { html: '<b>ok</b>' })
    expect(out).toBe('<div><b>ok</b></div>')
  })

  test('dot-notation + default values', async () => {
    const base = path.join(os.tmpdir(), `atlex-mail-${Date.now()}-3`)
    await mkdir(path.join(base, 'emails'), { recursive: true })
    await writeFile(path.join(base, 'emails', 'x.html'), '<p>{{user.name|Anon}}</p>', 'utf8')

    const r = new TemplateRenderer(base)
    expect(await r.render('emails.x', { user: { name: 'Karen' } })).toBe('<p>Karen</p>')
    expect(await r.render('emails.x', { user: {} })).toBe('<p>Anon</p>')
  })

  test('@if / @endif', async () => {
    const base = path.join(os.tmpdir(), `atlex-mail-${Date.now()}-4`)
    await mkdir(path.join(base, 'emails'), { recursive: true })
    await writeFile(path.join(base, 'emails', 'x.html'), '@if(show)<p>YES</p>@endif', 'utf8')

    const r = new TemplateRenderer(base)
    expect(await r.render('emails.x', { show: true })).toBe('<p>YES</p>')
    expect(await r.render('emails.x', { show: false })).toBe('')
  })

  test('@foreach / @endforeach', async () => {
    const base = path.join(os.tmpdir(), `atlex-mail-${Date.now()}-5`)
    await mkdir(path.join(base, 'emails'), { recursive: true })
    await writeFile(
      path.join(base, 'emails', 'x.html'),
      '@foreach(items as item)<p>{{item}}</p>@endforeach',
      'utf8',
    )

    const r = new TemplateRenderer(base)
    expect(await r.render('emails.x', { items: ['a', 'b'] })).toBe('<p>a</p><p>b</p>')
  })

  test('{{-- comment --}} stripped', async () => {
    const base = path.join(os.tmpdir(), `atlex-mail-${Date.now()}-6`)
    await mkdir(path.join(base, 'emails'), { recursive: true })
    await writeFile(path.join(base, 'emails', 'x.html'), 'a{{--x--}}b', 'utf8')

    const r = new TemplateRenderer(base)
    expect(await r.render('emails.x', {})).toBe('ab')
  })

  test('missing template throws', async () => {
    const base = path.join(os.tmpdir(), `atlex-mail-${Date.now()}-7`)
    await mkdir(base, { recursive: true })
    const r = new TemplateRenderer(base)
    await expect(r.render('emails.missing', {})).rejects.toBeInstanceOf(TemplateNotFoundException)
  })
})
