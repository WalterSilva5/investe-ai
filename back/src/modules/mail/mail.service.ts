import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor() {
    const host = process.env.SMTP_HOST;
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
            : undefined,
        })
      : null;
  }

  get enabled(): boolean {
    return this.transporter !== null;
  }

  async send(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ sent: boolean; reason?: string }> {
    if (!this.transporter) {
      return { sent: false, reason: 'smtp-not-configured' };
    }
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@wsi-invest-ai.local',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      return { sent: true };
    } catch (error) {
      this.logger.warn(`Falha ao enviar e-mail: ${(error as Error).message}`);
      return { sent: false, reason: (error as Error).message };
    }
  }
}
