# Mail

> Send beautiful emails with a simple, fluent API. Support for multiple drivers including SMTP, Mailgun, Amazon SES, and more.

[![npm version](https://img.shields.io/npm/v/@atlex/mail?style=flat-square&color=7c3aed)](https://www.npmjs.com/package/@atlex/mail)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/npm/l/@atlex/mail?style=flat-square)](./LICENSE)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=flat-square&logo=buy-me-a-coffee)](https://buymeacoffee.com/khamazaspyan)

## Installation

Install the package via npm, yarn, or pnpm:

```bash
npm install @atlex/mail
```

```bash
yarn add @atlex/mail
```

```bash
pnpm add @atlex/mail
```

## Quick Start

### Configuration

First, configure your mail driver in your application's config file:

```typescript
// config/mail.ts
export const mailConfig = {
  default: 'smtp',
  from: {
    name: 'Acme',
    address: 'hello@acme.com',
  },
  viewsPath: './resources/views/emails',
  mailers: {
    smtp: {
      host: 'smtp.mailtrap.io',
      port: 2525,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    },
    mailgun: {
      secret: process.env.MAILGUN_SECRET,
      domain: process.env.MAILGUN_DOMAIN,
    },
    ses: {
      key: process.env.AWS_ACCESS_KEY_ID,
      secret: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_DEFAULT_REGION,
    },
  },
}
```

### Sending a Simple Email

```typescript
import { Mail } from '@atlex/mail'

// Send a simple email
await Mail.to('user@example.com')
  .subject('Welcome')
  .html('<h1>Welcome to our platform!</h1>')
  .send()
```

### Using Mailable Classes

Create reusable email classes to encapsulate email logic:

```typescript
import { Mailable } from '@atlex/mail'

export class WelcomeMail extends Mailable {
  constructor(private user: User) {
    super()
  }

  build() {
    return this.subject('Welcome to Our Platform')
      .view('emails/welcome', { user: this.user })
      .from('noreply@acme.com')
  }
}

// Send the email
await Mail.send(new WelcomeMail(user))
```

## Features

- **Multiple Drivers**: SMTP, Mailgun, Amazon SES, Log (for testing), Array (in-memory)
- **Fluent API**: Simple and intuitive email building interface
- **Mailable Classes**: Reusable, testable, and object-oriented email objects
- **Queue Support**: Asynchronous email delivery with job queue integration
- **File Attachments**: Easily attach files from disk or memory
- **HTML & Text**: Support for both HTML and plain text email content
- **View Rendering**: Compose emails using template files
- **Global Settings**: Set default from, reply-to, BCC, and CC addresses
- **Localization**: Send emails in different languages
- **Template Renderer**: Built-in template rendering engine with data passing

## Core Concepts

### MailManager

The `MailManager` is the main entry point for sending emails. It manages driver registration, configuration, and email dispatch.

```typescript
import { MailManager } from '@atlex/mail'

// Get the default mailer instance
const mailer = MailManager.mailer()

// Switch to a different driver
const mailgunMailer = MailManager.driver('mailgun')

// Configure global defaults
MailManager.alwaysFrom({
  address: 'noreply@acme.com',
  name: 'Acme Support',
})

MailManager.alwaysReplyTo('support@acme.com')
MailManager.alwaysBcc('admin@acme.com')
MailManager.alwaysTo('cc@acme.com')

// Set locale for all emails
MailManager.locale('fr')

// Extend with custom drivers
MailManager.extend('custom', new CustomMailDriver())
```

### Mailable Classes

Create reusable, testable email objects by extending the `Mailable` class:

```typescript
import { Mailable } from '@atlex/mail'

export class OrderConfirmationMail extends Mailable {
  // Control queue behavior at the class level
  static queue = true
  static delay = 0 // seconds
  static connection = 'default'

  constructor(
    private order: Order,
    private customer: Customer,
  ) {
    super()
  }

  build() {
    return this.subject(`Order #${this.order.id} Confirmed`)
      .view('emails/order-confirmation', {
        order: this.order,
        customer: this.customer,
        confirmUrl: this.getConfirmationUrl(),
      })
      .to(this.customer.email)
      .replyTo('support@acme.com')
      .attach(`invoices/${this.order.id}.pdf`)
      .with({
        orderNumber: this.order.id,
        total: this.order.total,
      })
  }

  private getConfirmationUrl(): string {
    return `https://app.example.com/orders/${this.order.id}/confirm`
  }
}

// Send the mailable
await Mail.send(new OrderConfirmationMail(order, customer))

// Queue multiple emails
await Mail.send([
  new OrderConfirmationMail(order1, customer1),
  new OrderConfirmationMail(order2, customer2),
])
```

### Building Emails

The `MailMessage` class provides a fluent API for constructing emails:

```typescript
import { Mail } from '@atlex/mail'

const email = await Mail.to('user@example.com')
  .cc('manager@acme.com')
  .bcc('archive@acme.com')
  .subject('Important Update')
  .from('noreply@acme.com')
  .replyTo('support@acme.com')
  .html('<h1>Hello!</h1><p>This is a test.</p>')
  .text('Hello! This is a test.')
  .attach('path/to/file.pdf')
  .attachData(Buffer.from('data'), {
    filename: 'document.pdf',
    contentType: 'application/pdf',
  })
  .send()
```

### Using Views and Templates

Render HTML and text from template files:

```typescript
export class NotificationMail extends Mailable {
  constructor(private notification: Notification) {
    super()
  }

  build() {
    return this.subject('You have a new notification').view('emails/notification', {
      title: this.notification.title,
      message: this.notification.message,
      actionUrl: this.notification.actionUrl,
    })
  }
}

// Template file: resources/views/emails/notification.ejs
// <h1><%= title %></h1>
// <p><%= message %></p>
// <a href="<%= actionUrl %>">View Details</a>
```

### HTML and Plain Text Emails

Send both plain text and HTML versions to ensure compatibility:

```typescript
import { Mailable } from '@atlex/mail'

export class MultiFormatMail extends Mailable {
  build() {
    return this.subject('Welcome')
      .html('<h1>Welcome to Acme!</h1><p>We are excited to have you.</p>')
      .text('Welcome to Acme!\nWe are excited to have you.')
  }
}

// Or render both from templates
export class ReceiptMail extends Mailable {
  constructor(private receipt: Receipt) {
    super()
  }

  build() {
    const data = { receipt: this.receipt }
    return this.subject('Your Receipt')
      .view('emails/receipt', data)
      .text('emails/receipt-text', data)
  }
}
```

### File Attachments

Attach files from disk or include data as attachments:

```typescript
// Attach a file from disk
await Mail.to('user@example.com')
  .subject('Invoice')
  .html('<p>Please see your invoice attached.</p>')
  .attach('invoices/2024-001.pdf')
  .send()

// Attach from memory with custom metadata
await Mail.to('user@example.com')
  .subject('Report')
  .html('<p>Monthly report attached.</p>')
  .attachData(reportBuffer, {
    filename: 'report.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  .send()

// Multiple attachments
await Mail.to('user@example.com')
  .subject('Documents')
  .html('<p>Documents enclosed.</p>')
  .attach('contract.pdf')
  .attach('addendum.pdf')
  .attachData(signatureData, { filename: 'signature.png' })
  .send()
```

### Raw Email

Send raw RFC 822 formatted email for advanced use cases:

```typescript
const rawEmail = `From: sender@example.com
To: recipient@example.com
Subject: Test Email
Content-Type: text/plain; charset=utf-8

This is a raw email message.`

await Mail.raw(rawEmail, 'recipient@example.com')
```

### Localization

Send emails in different languages using the localization system:

```typescript
export class LocalizedMail extends Mailable {
  constructor(private locale: string) {
    super()
  }

  build() {
    return this.locale(this.locale)
      .subject('email.welcome.subject')
      .view('emails/welcome')
      .to('user@example.com')
  }
}

// Send in Spanish
await Mail.send(new LocalizedMail('es'))

// Send in French
await Mail.send(new LocalizedMail('fr'))
```

## Available Drivers

### SMTP Driver

Send emails via SMTP protocol:

```typescript
{
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-app-password',
    },
  }
}
```

### Mailgun Driver

Send via Mailgun's email API:

```typescript
{
  mailgun: {
    secret: 'key-xxxxxxxxx',
    domain: 'mg.example.com',
  }
}
```

### Amazon SES Driver

Send via AWS Simple Email Service:

```typescript
{
  ses: {
    key: 'AKIA...',
    secret: 'wJ+...',
    region: 'us-east-1',
  }
}
```

### Log Driver

Log emails instead of sending (useful for development and testing):

```typescript
{
  log: {
    channel: 'single',
  }
}
```

### Array Driver

Store emails in memory for testing purposes:

```typescript
{
  array: {
  }
}

// Retrieve sent emails in tests
const driver = MailManager.driver('array')
const messages = driver.getMessages()
```

## API Reference

### MailManager

```typescript
// Get the default mailer or a specific one
static mailer(name?: string): Mailer

// Get a driver instance
static driver(name: string): Mailer

// Register a custom driver
static extend(name: string, driver: MailDriver): void

// Set global from address
static alwaysFrom(from: Address | { name: string; address: string }): void

// Set global reply-to address
static alwaysReplyTo(address: string | Address): void

// Add global BCC recipient
static alwaysBcc(address: string | Address): void

// Add global CC recipient
static alwaysTo(address: string | Address): void

// Set locale for all emails
static locale(locale: string): void

// Send a mailable or array of mailables
static send(mailable: Mailable | Mailable[]): Promise<void>

// Send raw RFC 822 email
static raw(message: string, to: string): Promise<void>
```

### Mailable

```typescript
// Build and return the email message
build(): MailMessage

// Add recipient
to(address: string | Address | Address[]): this

// Set sender
from(address: string | Address): this

// Set reply-to address
replyTo(address: string | Address): this

// Add CC recipient
cc(address: string | Address | Address[]): this

// Add BCC recipient
bcc(address: string | Address | Address[]): this

// Set email subject
subject(subject: string): this

// Set HTML content
html(content: string): this

// Set plain text content
text(content: string): this

// Set view template
view(template: string, data?: Record<string, any>): this

// Attach file from disk
attach(path: string, options?: AttachmentOptions): this

// Attach data as file
attachData(data: Buffer | string, options: AttachmentOptions): this

// Pass additional data to view
with(data: Record<string, any>): this

// Static properties for queue configuration
static queue: boolean
static delay: number
static connection: string
```

### MailMessage

The built message object:

```typescript
interface MailMessage {
  envelope: {
    from: Address
    to: Address[]
    cc: Address[]
    bcc: Address[]
    replyTo: Address[]
  }
  content: {
    subject: string
    html: string
    text: string
  }
  attachments: Attachment[]
}
```

### Attachment

```typescript
interface Attachment {
  path?: string // File path
  data?: Buffer | string // Raw data
  filename: string // Display filename
  contentType: string // MIME type
}
```

## Testing

### Using the Array Driver

Use the array driver in tests to capture sent emails:

```typescript
import { Mail } from '@atlex/mail'
import { test, expect } from 'vitest'

test('sends welcome email', async () => {
  MailManager.driver('array').reset()

  await Mail.send(new WelcomeMail(user))

  const messages = MailManager.driver('array').getMessages()
  expect(messages).toHaveLength(1)
  expect(messages[0].envelope.to).toContainEqual({
    address: 'user@example.com',
  })
  expect(messages[0].content.subject).toBe('Welcome to Our Platform')
})
```

### Mocking Mail

Mock the Mail class for testing:

```typescript
import { Mock, vi } from 'vitest'

test('handles email failures gracefully', async () => {
  const sendSpy = vi.spyOn(Mail, 'send').mockRejectedValue(new Error('SMTP connection failed'))

  try {
    await Mail.send(new NotificationMail())
  } catch (error) {
    expect(error.message).toBe('SMTP connection failed')
  }

  expect(sendSpy).toHaveBeenCalled()
  sendSpy.mockRestore()
})
```

## Configuration Reference

```typescript
interface MailConfig {
  // Default mailer to use when no driver is specified
  default: string

  // Default from address for all emails
  from: {
    name: string
    address: string
  }

  // Path to email view templates
  viewsPath: string

  // Mailer driver configurations
  mailers: {
    smtp?: SmtpConfig
    mailgun?: MailgunConfig
    ses?: SesConfig
    log?: LogConfig
    array?: ArrayConfig
  }
}
```

## Exception Handling

The package provides specific exceptions for robust error handling:

```typescript
import { MailException, DriverNotFoundException, TemplateNotFoundException } from '@atlex/mail'

try {
  await Mail.send(email)
} catch (error) {
  if (error instanceof DriverNotFoundException) {
    console.error('Mail driver not found:', error.message)
  } else if (error instanceof TemplateNotFoundException) {
    console.error('Email template not found:', error.message)
  } else if (error instanceof MailException) {
    console.error('Mail error:', error.message)
  }
}
```

## Best Practices

1. **Use Mailable Classes**: Organize email logic into reusable Mailable classes instead of building emails inline.

2. **Queue Long Operations**: Queue emails that require heavy processing to avoid blocking HTTP requests.

   ```typescript
   export class HeavyProcessingMail extends Mailable {
     static queue = true
     static delay = 60
   }
   ```

3. **Separate Templates**: Keep email templates in dedicated view files for better maintainability and team collaboration.

4. **Test Thoroughly**: Use the array driver in tests to verify email sending behavior.

5. **Handle Exceptions**: Always catch and handle mail exceptions appropriately in production.

6. **Environment Variables**: Store API keys, secrets, and credentials in environment variables, never in code.

7. **Global Defaults**: Configure `alwaysFrom` and `alwaysReplyTo` globally to reduce duplication across Mailables.

8. **Localize Content**: Use localization for multi-language email support.

9. **Validate Recipients**: Validate email addresses before sending to prevent bounces.

10. **Monitor Delivery**: Log email sends and track delivery/bounce metrics for production email pipelines.

## Documentation

For more information and advanced usage, visit the [Atlex documentation](https://atlex.dev/guide/mail).

## License

## MIT © [Karen Hamazaspyan](https://github.com/khamazaspyan)

Part of [Atlex](https://atlex.dev) — A modern framework for Node.js.
