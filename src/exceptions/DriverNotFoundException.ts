import { MailException } from './MailException.js'

/**
 * Thrown when a mailer/driver is requested but not configured.
 */
export class DriverNotFoundException extends MailException {
  public constructor(driver: string) {
    super(`Mail driver [${driver}] is not configured.`)
    this.name = 'DriverNotFoundException'
  }
}
