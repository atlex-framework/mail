import type { Application } from '@atlex/core'
import { ServiceProvider } from '@atlex/core'

import { MailManager, type MailConfig } from './MailManager.js'

function defaultMailConfig(): MailConfig {
  const fromAddress = process.env.MAIL_FROM_ADDRESS ?? 'no-reply@example.com'
  const fromName = process.env.MAIL_FROM_NAME ?? 'Atlex'
  const mailer = process.env.MAIL_MAILER ?? 'log'

  return {
    default: mailer,
    from: { address: fromAddress, name: fromName },
    viewsPath: process.env.MAIL_VIEWS_PATH,
    mailers: {
      log: { driver: 'log' },
      array: { driver: 'array' },
    },
  }
}

/**
 * Service provider for @atlex/mail.
 */
export class MailServiceProvider extends ServiceProvider {
  public register(app: Application): void {
    app.singleton('mail', () => new MailManager(defaultMailConfig(), app.container))
  }

  public boot(_app: Application): void {
    // CLI command registration is handled by the `atlex` CLI package.
  }
}
