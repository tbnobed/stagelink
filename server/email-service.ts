import { MailService } from '@sendgrid/mail';

const EMAIL_ENABLED = !!process.env.SENDGRID_API_KEY;

let mailService: MailService | null = null;

if (EMAIL_ENABLED) {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY!);
} else {
  console.warn('SENDGRID_API_KEY not set - email functionality disabled');
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'alerts@obedtv.com';

interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!EMAIL_ENABLED || !mailService) {
    console.warn(`Email sending disabled - would have sent email to ${params.to} with subject: ${params.subject}`);
    return false;
  }
  
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
export async function sendUserInvite({
  to,
  inviterName,
  tempPassword,
  platformUrl
}: {
  to: string;
  inviterName: string;
  tempPassword: string;
  platformUrl: string;
}): Promise<boolean> {
  const subject = `You've been invited to join StageLinq by ${inviterName}`;
  
  const text = `
Hello!

${inviterName} has invited you to join the StageLinq Virtual Audience Platform.

Your account has been created with the following details:
Email: ${to}
Temporary Password: ${tempPassword}

Please log in and change your password immediately for security.

Login here: ${platformUrl}/auth

About StageLinq:
StageLinq is a professional live streaming platform that enables real-time video publishing and audience interaction. You can create streaming sessions, manage viewer links, and engage with live audiences.

Best regards,
StageLinq Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #00ff9f; margin: 0;">StageLinq</h1>
        <p style="color: #666; margin: 5px 0;">Virtual Audience Platform</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #333; margin-top: 0;">Welcome to StageLinq!</h2>
        <p style="color: #666; line-height: 1.6;">
          <strong>${inviterName}</strong> has invited you to join the StageLinq Virtual Audience Platform.
        </p>
      </div>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
        <h3 style="color: #856404; margin-top: 0;">Your Account Details</h3>
        <p style="color: #856404; margin: 5px 0;"><strong>Email:</strong> ${to}</p>
        <p style="color: #856404; margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #fff; padding: 2px 4px; border-radius: 3px;">${tempPassword}</code></p>
        <p style="color: #856404; margin: 5px 0; font-size: 14px;"><em>Please change this password after your first login for security.</em></p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${platformUrl}/auth" style="background-color: #00ff9f; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Log In to StageLinq
        </a>
      </div>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h3 style="color: #333; margin-top: 0;">About StageLinq</h3>
        <p style="color: #666; line-height: 1.6; margin-bottom: 10px;">
          StageLinq is a professional live streaming platform that enables:
        </p>
        <ul style="color: #666; line-height: 1.6; margin: 0; padding-left: 20px;">
          <li>Real-time video publishing with WHIP/WHEP protocols</li>
          <li>Studio return feed monitoring</li>
          <li>Live chat integration</li>
          <li>QR code generation for easy session sharing</li>
          <li>Professional email invitations</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 14px; margin: 0;">
          This email was sent by the StageLinq Virtual Audience Platform
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

export async function sendRegistrationInvite({
  to,
  inviterName,
  registrationUrl,
  role
}: {
  to: string;
  inviterName: string;
  registrationUrl: string;
  role: string;
}): Promise<boolean> {
  const subject = `You've been invited to join StageLinq by ${inviterName}`;
  
  const roleText = role === 'admin' ? 'Administrator' : role === 'engineer' ? 'Engineer' : 'User';
  
  const text = `
Hello!

${inviterName} has invited you to join the StageLinq Virtual Audience Platform as a ${roleText}.

Please complete your registration by clicking the link below:
${registrationUrl}

You'll be able to set your own username and password during registration.

About StageLinq:
StageLinq is a professional live streaming platform that enables real-time video publishing and audience interaction. You can create streaming sessions, manage viewer links, and engage with live audiences.

This invitation link will expire in 7 days.

Best regards,
StageLinq Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #00ff9f; margin: 0;">StageLinq</h1>
        <p style="color: #666; margin: 5px 0;">Virtual Audience Platform</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #333; margin-top: 0;">You're Invited to Join StageLinq!</h2>
        <p style="color: #666; line-height: 1.6;">
          <strong>${inviterName}</strong> has invited you to join the StageLinq Virtual Audience Platform as a <strong>${roleText}</strong>.
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${registrationUrl}" style="background-color: #00ff9f; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
          Complete Registration
        </a>
      </div>

      <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3; margin-bottom: 20px;">
        <h3 style="color: #1565c0; margin-top: 0;">What's Next?</h3>
        <p style="color: #1565c0; margin: 5px 0;">
          • Click the registration link above<br>
          • Choose your own username and password<br>
          • Start using StageLinq immediately
        </p>
      </div>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h3 style="color: #333; margin-top: 0;">About StageLinq</h3>
        <p style="color: #666; line-height: 1.6; margin-bottom: 10px;">
          StageLinq is a professional live streaming platform that enables:
        </p>
        <ul style="color: #666; line-height: 1.6; margin: 0; padding-left: 20px;">
          <li>Real-time video publishing with WHIP/WHEP protocols</li>
          <li>Studio return feed monitoring</li>
          <li>Live chat integration</li>
          <li>QR code generation for easy session sharing</li>
          <li>Professional email invitations</li>
        </ul>
      </div>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin-top: 20px;">
        <p style="color: #856404; margin: 0; font-size: 14px;">
          <strong>Note:</strong> This invitation link expires in 7 days. Please complete your registration soon.
        </p>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 14px; margin: 0;">
          This email was sent by the StageLinq Virtual Audience Platform
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

export async function sendPasswordReset({
  to,
  resetToken,
  platformUrl
}: {
  to: string;
  resetToken: string;
  platformUrl: string;
}): Promise<boolean> {
  const resetUrl = `${platformUrl}/reset-password?token=${resetToken}`;
  const subject = 'Reset your StageLinq password';
  
  const text = `
Hello!

You requested a password reset for your StageLinq account.

Click here to reset your password: ${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request this reset, please ignore this email.

Best regards,
StageLinq Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #00ff9f; margin: 0;">StageLinq</h1>
        <p style="color: #666; margin: 5px 0;">Virtual Audience Platform</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #666; line-height: 1.6;">
          You requested a password reset for your StageLinq account.
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #007bff; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Reset Your Password
        </a>
      </div>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
        <p style="color: #856404; margin: 0; font-size: 14px;">
          <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
        </p>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 14px; margin: 0;">
          This email was sent by the StageLinq Virtual Audience Platform
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

export async function sendProductionInvite({
  to,
  guestName,
  productionName,
  scheduledAt,
  description,
  joinLink,
}: {
  to: string;
  guestName: string;
  productionName: string;
  scheduledAt?: Date | null;
  description?: string | null;
  joinLink: string;
}): Promise<boolean> {
  const scheduledText = scheduledAt
    ? scheduledAt.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : null;

  const subject = `You're invited to join ${productionName} — TBN Virtual Audience`;

  const text = [
    `Hello ${guestName},`,
    '',
    `You have been invited to participate in a live broadcast on TBN Virtual Audience.`,
    '',
    `Production: ${productionName}`,
    ...(scheduledText ? [`Date & Time: ${scheduledText}`] : []),
    ...(description ? ['', description, ''] : ['']),
    'How to Join:',
    '1. Open the link below on a laptop or desktop computer with a webcam and microphone.',
    '2. Allow camera and microphone access when your browser prompts you.',
    '3. Read and accept the participation agreement before going live.',
    '4. If the show is at capacity you will be placed in a waiting room — you will be admitted automatically when a spot opens.',
    '',
    `Join Now: ${joinLink}`,
    '',
    'This link is personal to you. Please do not share it with others.',
    '',
    'God bless,',
    'TBN Virtual Audience Team',
    'Trinity Broadcasting Network',
  ].join('\n');

  const steps = [
    'Open the link below on a <strong style="color:#e5e7eb;">laptop or desktop computer</strong> with a webcam and microphone.',
    'Allow <strong style="color:#e5e7eb;">camera and microphone access</strong> when your browser prompts you.',
    'Read and accept the <strong style="color:#e5e7eb;">participation agreement</strong> before going live.',
    'If the show is at capacity you will be placed in a <strong style="color:#e5e7eb;">waiting room</strong> — you will be admitted automatically when a spot opens.',
  ];

  const stepsHtml = steps.map((step, i) => `
    <tr>
      <td width="36" style="vertical-align:top;padding:0 0 12px 0;">
        <div style="width:28px;height:28px;border-radius:50%;background-color:#7c3aed;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#ffffff;">${i + 1}</div>
      </td>
      <td style="vertical-align:top;padding:4px 0 12px 8px;">
        <span style="font-size:14px;color:#d1d5db;line-height:1.5;">${step}</span>
      </td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>You're Invited — TBN Virtual Audience</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0a0a0a;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#1a0a2e 0%,#0d1a3a 100%);border-radius:12px 12px 0 0;padding:36px 40px;text-align:center;border-bottom:3px solid #7c3aed;">
  <div style="font-size:13px;font-weight:700;letter-spacing:3px;color:#a78bfa;text-transform:uppercase;margin-bottom:8px;">Trinity Broadcasting Network</div>
  <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">TBN Virtual Audience</div>
</td></tr>
<tr><td style="background-color:#111827;padding:36px 40px;">
  <p style="font-size:16px;color:#d1d5db;margin:0 0 8px 0;">Hello <strong style="color:#ffffff;">${guestName}</strong>,</p>
  <p style="font-size:16px;color:#d1d5db;margin:0 0 28px 0;">You have been invited to participate in a live broadcast on TBN Virtual Audience.</p>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#1f2937;border-radius:8px;border:1px solid #374151;margin-bottom:28px;">
    <tr><td style="padding:20px 24px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#7c3aed;text-transform:uppercase;margin-bottom:6px;">Production</div>
      <div style="font-size:22px;font-weight:700;color:#ffffff;margin-bottom:${(scheduledText || description) ? '16px' : '0'};">${productionName}</div>
      ${scheduledText ? `<div style="margin-bottom:${description ? '12px' : '0'};"><span style="font-size:11px;font-weight:700;letter-spacing:2px;color:#6b7280;text-transform:uppercase;">Date &amp; Time</span><br><span style="font-size:15px;color:#e5e7eb;font-weight:600;">${scheduledText}</span></div>` : ''}
      ${description ? `<p style="font-size:14px;color:#9ca3af;margin:0;line-height:1.6;">${description}</p>` : ''}
    </td></tr>
  </table>
  <div style="margin-bottom:28px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#6b7280;text-transform:uppercase;margin-bottom:14px;">How to Join</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${stepsHtml}</table>
  </div>
  <div style="text-align:center;margin-bottom:28px;">
    <a href="${joinLink}" style="display:inline-block;background-color:#7c3aed;color:#ffffff;font-size:17px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:8px;letter-spacing:0.3px;">Join Now →</a>
  </div>
  <p style="font-size:12px;color:#6b7280;text-align:center;margin:0;">This link is personal to you. Please do not share it with others.</p>
</td></tr>
<tr><td style="background-color:#0d0d0d;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border-top:1px solid #1f2937;">
  <p style="font-size:12px;color:#4b5563;margin:0 0 4px 0;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Trinity Broadcasting Network</p>
  <p style="font-size:11px;color:#374151;margin:0;">TBN Virtual Audience Platform</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return sendEmail({ to, subject, text, html });
}
