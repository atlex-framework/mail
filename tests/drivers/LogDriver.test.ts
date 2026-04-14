import { describe, expect, test, vi } from 'vitest'

import { LogDriver } from '../../src/drivers/LogDriver.js'
import { MailAddress } from '../../src/MailAddress.js'

describe('LogDriver', () => {
  test('prints to stdout and returns synthetic messageId', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const d = new LogDriver()
    const sent = await d.send({
      mailer: 'log',
      from: new MailAddress('from@x.com'),
      to: [new MailAddress('to@x.com')],
      cc: [],
      bcc: [],
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: {},
      tags: [],
      metadata: {},
      attachments: [],
      using: [],
    })
    expect(spy).toHaveBeenCalled()
    expect(sent.messageId.length).toBeGreaterThan(0)
    spy.mockRestore()
  })
})
