import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = 'alerts@obedtv.com';

interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: FROM_EMAIL,
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
    });
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function sendStreamingInvite({
  to,
  inviterName,
  streamingLink,
  linkExpiry,
  message
}: {
  to: string;
  inviterName: string;
  streamingLink: string;
  linkExpiry?: Date;
  message?: string;
}): Promise<boolean> {
  const expiryText = linkExpiry ? 
    `This link expires on ${linkExpiry.toLocaleDateString()} at ${linkExpiry.toLocaleTimeString()}.` : 
    'This link does not expire.';
  
  const customMessage = message ? `\n\nPersonal message: ${message}` : '';

  const subject = `${inviterName} has invited you to join a StageLinq streaming session`;
  
  const text = `
Hello!

${inviterName} has invited you to join a live streaming session on the StageLinq Virtual Audience Platform.

Click here to join: ${streamingLink}

${expiryText}${customMessage}

Best regards,
StageLinq Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #00ff9f; margin: 0;">StageLinq</h1>
        <p style="color: #666; margin: 5px 0;">Virtual Audience Platform</p>
      </div>
      
      <h2 style="color: #333;">You're Invited to Stream!</h2>
      
      <p style="color: #555; font-size: 16px;">
        <strong>${inviterName}</strong> has invited you to join a live streaming session on the StageLinq Virtual Audience Platform.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${streamingLink}" 
           style="background-color: #00ff9f; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          Join Streaming Session
        </a>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0; color: #666; font-size: 14px;">
          <strong>Link:</strong> ${streamingLink}<br>
          <strong>Expiry:</strong> ${expiryText}
        </p>
      </div>
      
      ${customMessage ? `
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #333; font-style: italic;">
            <strong>Personal message:</strong> ${message}
          </p>
        </div>
      ` : ''}
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px; text-align: center;">
        This invitation was sent via StageLinq Virtual Audience Platform<br>
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    text: text.trim(),
    html
  });
}

export async function sendViewerInvite({
  to,
  inviterName,
  viewerLink,
  linkExpiry,
  message
}: {
  to: string;
  inviterName: string;
  viewerLink: string;
  linkExpiry?: Date;
  message?: string;
}): Promise<boolean> {
  const expiryText = linkExpiry ? 
    `This link expires on ${linkExpiry.toLocaleDateString()} at ${linkExpiry.toLocaleTimeString()}.` : 
    'This link does not expire.';
  
  const customMessage = message ? `\n\nPersonal message: ${message}` : '';

  const subject = `${inviterName} has invited you to watch a StageLinq stream`;
  
  const text = `
Hello!

${inviterName} has invited you to watch a live stream on the StageLinq Virtual Audience Platform.

Click here to watch: ${viewerLink}

${expiryText}${customMessage}

Best regards,
StageLinq Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #00ff9f; margin: 0;">StageLinq</h1>
        <p style="color: #666; margin: 5px 0;">Virtual Audience Platform</p>
      </div>
      
      <h2 style="color: #333;">You're Invited to Watch!</h2>
      
      <p style="color: #555; font-size: 16px;">
        <strong>${inviterName}</strong> has invited you to watch a live stream on the StageLinq Virtual Audience Platform.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${viewerLink}" 
           style="background-color: #00ff9f; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          Watch Stream
        </a>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0; color: #666; font-size: 14px;">
          <strong>Link:</strong> ${viewerLink}<br>
          <strong>Expiry:</strong> ${expiryText}
        </p>
      </div>
      
      ${customMessage ? `
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #333; font-style: italic;">
            <strong>Personal message:</strong> ${message}
          </p>
        </div>
      ` : ''}
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px; text-align: center;">
        This invitation was sent via StageLinq Virtual Audience Platform<br>
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    text: text.trim(),
    html
  });
}