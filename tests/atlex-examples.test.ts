import { describe, expect, it } from 'vitest'

import { MailAddress } from '../src/MailAddress.js'

describe('@atlex/mail examples', () => {
  it('MailAddress parses email', () => {
    const a = MailAddress.parse('a@b.co')
    expect(a.address).toBe('a@b.co')
  })

  it('MailAddress with name', () => {
    const a = new MailAddress('a@b.co', 'A')
    expect(a.name).toBe('A')
  })

  it('MailAddress toString', () => {
    const a = new MailAddress('a@b.co', 'A')
    expect(String(a)).toContain('a@b.co')
  })

  it('MailAddress parse trims', () => {
    const a = MailAddress.parse('  x@y.z  ')
    expect(a.address).toBe('x@y.z')
  })

  it('MailAddress toString includes angle brackets when named', () => {
    const a = new MailAddress('a@b.co', 'Bob')
    expect(a.toString()).toContain('<a@b.co>')
  })
})
