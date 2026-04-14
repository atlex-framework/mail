import { describe, expect, test } from 'vitest'

import { Mailable } from '../src/Mailable.js'
import { MailFake } from '../src/testing/MailFake.js'

class WelcomeMail extends Mailable {
  public user: { id: number } = { id: 0 }

  public build(): this {
    return this.subject('Hi').html('<p>ok</p>')
  }
}

describe('MailFake', () => {
  test('assertSent passes when sent', () => {
    const fake = new MailFake()
    const m = new WelcomeMail()
    m.user = { id: 1 }
    fake.recordSent(m, fake.captureTo('user@x.com'))
    expect(() => {
      fake.assertSent(WelcomeMail)
    }).not.toThrow()
  })

  test('assertSent fails with descriptive message', () => {
    const fake = new MailFake()
    expect(() => {
      fake.assertSent(WelcomeMail)
    }).toThrowError(/Expected \[WelcomeMail\] to be sent/)
  })

  test('assertSentTo targets correct address', () => {
    const fake = new MailFake()
    const m = new WelcomeMail()
    m.user = { id: 1 }
    fake.recordSent(m, fake.captureTo(['a@x.com', 'b@x.com']))
    expect(() => {
      fake.assertSentTo('b@x.com', WelcomeMail)
    }).not.toThrow()
  })

  test('assertNothingSent fails when something was sent', () => {
    const fake = new MailFake()
    const m = new WelcomeMail()
    m.user = { id: 1 }
    fake.recordSent(m, fake.captureTo('user@x.com'))
    expect(() => {
      fake.assertNothingSent()
    }).toThrowError(/Expected no mailables to be sent/)
  })

  test('assertSentCount exact count check', () => {
    const fake = new MailFake()
    const m1 = new WelcomeMail()
    m1.user = { id: 1 }
    const m2 = new WelcomeMail()
    m2.user = { id: 2 }
    fake.recordSent(m1, fake.captureTo('user@x.com'))
    fake.recordSent(m2, fake.captureTo('user@x.com'))
    expect(() => {
      fake.assertSentCount(WelcomeMail, 2)
    }).not.toThrow()
    expect(() => {
      fake.assertSentCount(WelcomeMail, 1)
    }).toThrowError(/Expected \[WelcomeMail\] to be sent 1 time/)
  })

  test('assertQueued + callback filter', () => {
    const fake = new MailFake()
    const m = new WelcomeMail()
    m.user = { id: 1 }
    fake.recordQueued(m, fake.captureTo('user@x.com'))
    expect(() => {
      fake.assertQueued(WelcomeMail, (m) => (m as WelcomeMail).user.id === 1)
    }).not.toThrow()
    expect(() => {
      fake.assertQueued(WelcomeMail, (m) => (m as WelcomeMail).user.id === 2)
    }).toThrow()
  })

  test('hasSent / hasQueued + reset', () => {
    const fake = new MailFake()
    const m1 = new WelcomeMail()
    m1.user = { id: 1 }
    const m2 = new WelcomeMail()
    m2.user = { id: 1 }
    fake.recordSent(m1, fake.captureTo('user@x.com'))
    fake.recordQueued(m2, fake.captureTo('user@x.com'))
    expect(fake.hasSent(WelcomeMail)).toBe(true)
    expect(fake.hasQueued(WelcomeMail)).toBe(true)
    fake.reset()
    expect(fake.hasSent(WelcomeMail)).toBe(false)
    expect(fake.hasQueued(WelcomeMail)).toBe(false)
  })
})
