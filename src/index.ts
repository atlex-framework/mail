export { MailManager } from './MailManager.js'
export { PendingMail } from './PendingMail.js'
export { Mailable } from './Mailable.js'
export { MailMessage } from './MailMessage.js'
export { MailAddress } from './MailAddress.js'
export { Attachment } from './Attachment.js'
export { Envelope } from './Envelope.js'
export { Content } from './Content.js'
export { TemplateRenderer } from './TemplateRenderer.js'
export { MailServiceProvider } from './MailServiceProvider.js'
export { MailFake } from './testing/MailFake.js'
export { SendMailJob } from './jobs/SendMailJob.js'

export * from './exceptions/MailException.js'
export * from './exceptions/DriverNotFoundException.js'
export * from './exceptions/TemplateNotFoundException.js'

export type { MailDriver, SentMessage } from './contracts/MailDriver.js'
export type { MailableContract } from './contracts/MailableContract.js'
export type {
  MailConfig,
  SmtpConfig,
  MailgunConfig,
  SesConfig,
  DriverConfig,
  ResolvedMailMessage,
} from './MailManager.js'
