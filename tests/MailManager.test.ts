import { Container } from '@atlex/core'
import { describe, expect, test, vi } from 'vitest'

import type { MailDriver, SentMessage } from '../src/contracts/MailDriver.js'
import { Mailable } from '../src/Mailable.js'
import { MailManager, type MailConfig } from '../src/MailManager.js'
import type { ResolvedMailMessage } from '../src/MailMessage.js'

vi.mock('@atlex/queue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@atlex/queue')>()
  return {
    ...actual,
    dispatch: (job: unknown) => {
      return {
        onConnection: () => ({
          onQueue: () => ({
            delay: () => ({
              dispatch: async () => {
                ;(globalThis as unknown as { __lastJob?: unknown }).__lastJob = job
                return 'uuid'
              },
            }),
          }),
        }),
      }
    },
  }
})

class WelcomeMail extends Mailable {
  public constructor() {
    super()
  }
  public build(): this {
    return this.subject('Hi').html('<p>ok</p>')
  }
}

function makeConfig(): MailConfig {
  return {
    default: 'array',
    from: { address: 'from@x.com', name: 'From' },
    mailers: {
      array: { driver: 'array' },
      log: { driver: 'log' },
    },
  }
}

describe('MailManager', () => {
  test('default driver resolution + named mailer resolution', () => {
    const c = new Container()
    const mail = new MailManager(makeConfig(), c)
    expect(mail.driver()).toBeDefined()
    expect(mail.mailer('log').driver()).toBeDefined()
  })

  test('extend() registers custom driver', async () => {
    const c = new Container()
    const mail = new MailManager(makeConfig(), c)

    class CustomDriver implements MailDriver {
      public async send(_message: ResolvedMailMessage): Promise<SentMessage> {
        return { messageId: 'x', envelope: { from: 'a', to: ['b'] }, raw: null }
      }
    }

    mail.extend('custom', () => new CustomDriver())
    const cfg = makeConfig()
    cfg.mailers.custom = { driver: 'custom' }
    const mail2 = new MailManager(cfg, c)
    mail2.extend('custom', () => new CustomDriver())
    const sent = await mail2.sendNow(new WelcomeMail().to('to@x.com'), 'custom')
    expect(sent.messageId).toBe('x')
  })

  test('alwaysFrom override propagation', async () => {
    const c = new Container()
    const mail = new MailManager(makeConfig(), c).alwaysFrom('override@x.com')
    const sent = await mail.to('to@x.com').sendNow(new WelcomeMail())
    expect(sent.envelope.from).toBe('override@x.com')
  })

  test('send() with shouldQueue=false sends immediately', async () => {
    const c = new Container()
    const mail = new MailManager(makeConfig(), c)
    const sent = await mail.to('to@x.com').sendNow(new WelcomeMail())
    expect(sent.envelope.to).toContain('to@x.com')
  })

  test('send() with shouldQueue=true dispatches SendMailJob', async () => {
    class QueuedMail extends WelcomeMail {
      public static override shouldQueue = true
    }
    const c = new Container()
    const mail = new MailManager(makeConfig(), c)
    await mail.to('to@x.com').send(new QueuedMail())
    const last = (globalThis as unknown as { __lastJob?: unknown }).__lastJob
    expect(last).toBeDefined()
    expect(String((last as { constructor: { name: string } }).constructor.name)).toBe('SendMailJob')
  })

  test('later() dispatches job with delay seconds', async () => {
    class QueuedMail extends WelcomeMail {
      public static override shouldQueue = true
    }
    const c = new Container()
    const mail = new MailManager(makeConfig(), c)
    await mail.later(5, new QueuedMail().to('to@x.com'))
    const last = (globalThis as unknown as { __lastJob?: unknown }).__lastJob
    expect(last).toBeDefined()
  })

  test('events are emitted for mail:sent', async () => {
    const c = new Container()
    const events = { emitted: [] as string[] }
    const eventBus = {
      emit: (name: string) => {
        events.emitted.push(name)
        return true
      },
    }
    c.instance('events', eventBus as unknown)
    const mail = new MailManager(makeConfig(), c)
    await mail.to('to@x.com').sendNow(new WelcomeMail())
    expect(events.emitted).toContain('mail:sending')
    expect(events.emitted).toContain('mail:sent')
  })
})
