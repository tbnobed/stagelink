import { MailService } from '@sendgrid/mail';

const EMAIL_ENABLED = !!process.env.SENDGRID_API_KEY;

let mailService: MailService | null = null;

if (EMAIL_ENABLED) {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY!);
} else {
  console.warn('SENDGRID_API_KEY not set - email functionality disabled');
}

const FROM_EMAIL = 'alerts@obedtv.com';

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
