# Email Invite System Setup Guide

The Virtual Audience Platform v2.1 includes a professional email invitation system powered by SendGrid.

## Features

✅ **Professional Short Links**: Clean URLs like `yourapp.com/s/ABC123`
✅ **Email Validation**: Built-in format validation and error handling  
✅ **Branded Templates**: Clean, professional email templates
✅ **Seamless Integration**: Works from Home and Generator pages

## Setup Instructions

### 1. Create SendGrid Account
1. Visit [sendgrid.com](https://sendgrid.com) and create an account
2. Complete email verification process
3. Navigate to Settings → API Keys

### 2. Generate API Key
1. Click "Create API Key"
2. Choose "Restricted Access" 
3. Grant permissions for "Mail Send"
4. Copy the generated API key (save it securely)

### 3. Verify Sender Email
1. Go to Settings → Sender Authentication  
2. Add and verify your sender email address
3. This email will be used as the "From" address for invites

### 4. Configure Environment
Add these variables to your `.env` file:
```bash
# Email Configuration
SENDGRID_API_KEY=SG.your-actual-api-key-here
SENDGRID_FROM_EMAIL=alerts@yourdomain.com
```

### 5. Docker Deployment
The Docker configuration automatically includes email support:
```bash
# Deploy with email functionality
./deploy.sh
```

## Usage

### From Generator Page:
1. Generate any guest or viewer link
2. Click the green "Email Invite" button
3. Enter recipient email address
4. Email is sent with professional short link

### From Home Page:
- Quick access to email invites for existing links
- Professional appearance maintains credibility

## Email Template

Recipients receive clean, professional emails containing:
- Personalized greeting
- Link purpose (Guest Session or Viewer Access)
- Clean short URL (yourapp.com/s/ABC123)
- Professional StageLinq branding

## Troubleshooting

**Email not sending?**
- Verify SendGrid API key is correct
- Ensure sender email is verified in SendGrid
- Check server logs for error messages

**Short links not working?**
- Ensure application is accessible at configured domain
- Verify database connection is working
- Check that links haven't expired

## Security Notes

- API keys are stored securely as environment variables
- Email addresses are validated before sending
- Short links respect the same expiration rules as regular links
- No email addresses are stored in the database

## Cost Considerations

SendGrid offers:
- **Free Tier**: 100 emails/day
- **Paid Plans**: Start at $14.95/month for higher volumes
- **Pay-as-you-go**: Available for occasional use

Perfect for most Virtual Audience Platform deployments.