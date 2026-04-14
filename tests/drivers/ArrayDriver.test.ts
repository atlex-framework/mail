import { describe, expect, test } from 'vitest'

import { ArrayDriver } from '../../src/drivers/ArrayDriver.js'
import { MailAddress } from '../../src/MailAddress.js'

describe('ArrayDriver', () => {
  test('getSent returns sent messages and findSentTo filters', async () => {
    const d = new ArrayDriver()
    await d.send({
      mailer: 'array',
      from: new MailAddress('from@x.com'),
      to: [new MailAddress('a@x.com'), new MailAddress('b@x.com')],
      cc: [],
      bcc: [],
      subject: 'Hi',
      html: '<p>ok</p>',
      text: 'ok',
      headers: {},
      tags: [],
      metadata: {},
      attachments: [],
      using: [],
    })

    expect(d.getSent()).toHaveLength(1)
    expect(d.findSentTo('b@x.com')).toHaveLength(1)
    d.clear()
    expect(d.getSent()).toHaveLength(0)
  })
})
