import { Logger } from '@nestjs/common';
import { connect, migrate } from '@stayvinci/db';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { BrevoMailer, ConsoleMailer, EmailJsMailer, SmtpMailer } from './notifications/mailer.js';
import { AfricasTalkingSms, ConsoleSms, DisabledSms, MemorySms } from './notifications/sms.js';

const log = new Logger('Startup');
const config = loadConfig();
const database = await connect(config.databaseUrl);

if (config.migrateOnStart) {
  const result = await migrate(database.runner);
  if (result.applied.length) log.log(`Applied migrations: ${result.applied.join(', ')}`);
}

const sms =
  config.smsProvider === 'africastalking'
    ? new AfricasTalkingSms()
    : config.smsProvider === 'memory'
      ? new MemorySms()
      : config.smsProvider === 'console'
        ? new ConsoleSms()
        : new DisabledSms();

const app = await createApp({
  config,
  database,
  mailer:
    config.mailTransport === 'console'
      ? new ConsoleMailer()
      : config.mailTransport === 'brevo'
        ? new BrevoMailer(config)
        : config.mailTransport === 'emailjs'
          ? new EmailJsMailer(config)
          : new SmtpMailer(config),
  sms,
});
await app.listen(config.port);
log.log(
  `Listening on http://localhost:${config.port}${config.docs.enabled ? ' · docs at /docs' : ''}`,
);

const shutdown = async () => {
  await app.close();
  await database.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
