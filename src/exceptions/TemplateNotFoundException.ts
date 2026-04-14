import { MailException } from './MailException.js'

/**
 * Thrown when a referenced email template cannot be found on disk.
 */
export class TemplateNotFoundException extends MailException {
  public constructor(path: string) {
    super(`Email template [${path}] could not be found.`)
    this.name = 'TemplateNotFoundException'
  }
}
