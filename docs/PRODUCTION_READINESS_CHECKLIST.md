# Production Readiness Checklist

A comprehensive checklist for launching client web applications to production.

---

## Table of Contents
1. [Domain & DNS](#1-domain--dns)
2. [Hosting & Deployment](#2-hosting--deployment)
3. [SSL/HTTPS](#3-sslhttps)
4. [Environment Variables](#4-environment-variables)
5. [Email Setup](#5-email-setup)
6. [Authentication](#6-authentication)
7. [Database](#7-database)
8. [File Storage](#8-file-storage)
9. [SEO](#9-seo)
10. [Analytics](#10-analytics)
11. [Error Monitoring](#11-error-monitoring)
12. [Performance](#12-performance)
13. [Security](#13-security)
14. [Legal & Compliance](#14-legal--compliance)
15. [Pre-Launch Testing](#15-pre-launch-testing)

---

## 1. Domain & DNS

### Tasks:
- [ ] Domain registered (Namecheap, Google Domains, Netlify, etc.)
- [ ] DNS configured to point to hosting provider
- [ ] WWW redirect configured (www → apex or apex → www)
- [ ] Email DNS records if using custom domain email:
  - [ ] MX records
  - [ ] SPF record
  - [ ] DKIM record
  - [ ] DMARC record

### Common DNS Records:
| Type | Name | Value | Purpose |
|------|------|-------|---------|
| A/CNAME | @ | hosting IP/URL | Main site |
| CNAME | www | hosting URL | WWW subdomain |
| TXT | @ | v=spf1... | Email authentication |
| TXT | _dmarc | v=DMARC1... | Email policy |
| MX | @ | mail server | Email routing |

---

## 2. Hosting & Deployment

### Frontend (Static/SPA):
- [ ] Netlify, Vercel, or Cloudflare Pages configured
- [ ] Build command set correctly
- [ ] Publish directory set correctly
- [ ] Environment variables added
- [ ] Custom domain connected
- [ ] Auto-deploy from main branch enabled

### Backend (API):
- [ ] Render, Railway, Fly.io, or Heroku configured
- [ ] Build command set
- [ ] Start command set
- [ ] Environment variables added
- [ ] Custom domain/subdomain if needed (api.example.com)
- [ ] Health check endpoint configured

### Deployment Checklist:
```
Frontend (Netlify):
  Build command: npm run build
  Publish directory: dist (Vite) or build (CRA)
  
Backend (Render):
  Build command: bundle install
  Start command: bundle exec rails s -b 0.0.0.0 -p $PORT
```

---

## 3. SSL/HTTPS

- [ ] SSL certificate provisioned (usually automatic with Netlify/Vercel)
- [ ] Force HTTPS enabled
- [ ] Mixed content warnings resolved (no http:// resources)
- [ ] HSTS header enabled (optional but recommended)

---

## 4. Environment Variables

### Frontend (.env):
```bash
# API
VITE_API_URL=https://api.example.com

# Auth (Clerk)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx

# Analytics (PostHog)
VITE_PUBLIC_POSTHOG_KEY=phc_xxxxx
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### Backend (.env):
```bash
# Database
DATABASE_URL=postgres://user:pass@host:5432/dbname

# Auth (Clerk)
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxx

# Email (Resend)
RESEND_API_KEY=re_xxxxx
MAILER_FROM_EMAIL=noreply@example.com

# Storage (S3)
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_REGION=us-east-1
AWS_BUCKET=bucket-name

# App
FRONTEND_URL=https://example.com
RAILS_ENV=production
SECRET_KEY_BASE=xxxxx
```

### Security Notes:
- [ ] Never commit .env files
- [ ] Use different keys for dev/staging/production
- [ ] Rotate keys periodically
- [ ] Use secrets manager for sensitive data (optional)

---

## 5. Email Setup

### Transactional Email (Resend/SendGrid/Postmark):
- [ ] Account created
- [ ] Domain verified
- [ ] DNS records added (SPF, DKIM, DMARC)
- [ ] API key generated
- [ ] From email configured
- [ ] Email templates tested

### DNS Records for Email (Resend example):
```
TXT  @           v=spf1 include:amazonses.com ~all
TXT  resend._domainkey  p=MIGfMA0GCS...
TXT  _dmarc      v=DMARC1; p=none;
MX   send        feedback-smtp.us-east-1.amazonses.com
```

### Testing:
- [ ] Send test email
- [ ] Check spam score (mail-tester.com)
- [ ] Verify emails land in inbox, not spam

---

## 6. Authentication

### Clerk Setup:
- [ ] Production instance created
- [ ] Application configured
- [ ] Sign-in/sign-up URLs set
- [ ] Redirect URLs configured
- [ ] Custom domain (optional): accounts.example.com
- [ ] Social providers configured (Google, etc.)
- [ ] Email templates customized

### Webhook (if needed):
- [ ] Webhook endpoint created in app
- [ ] Webhook configured in Clerk dashboard
- [ ] Webhook secret added to environment

---

## 7. Database

### Production Database (Neon/Supabase/RDS):
- [ ] Database provisioned
- [ ] Connection string secured
- [ ] Migrations run
- [ ] Seed data loaded (if applicable)
- [ ] Backups enabled
- [ ] Connection pooling configured

### Pre-Launch:
```bash
# Run migrations
rails db:migrate RAILS_ENV=production

# Verify connection
rails db:version RAILS_ENV=production
```

---

## 8. File Storage

### S3/Cloudflare R2:
- [ ] Bucket created
- [ ] CORS configured for uploads
- [ ] IAM user/credentials created
- [ ] Bucket policy set (private with pre-signed URLs)
- [ ] Environment variables added

### CORS Configuration (S3):
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://example.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

---

## 9. SEO

See [SEO_SETUP_GUIDE.md](./SEO_SETUP_GUIDE.md) for detailed instructions.

### Quick Checklist:
- [ ] Meta tags (title, description)
- [ ] Open Graph tags
- [ ] robots.txt created
- [ ] sitemap.xml created
- [ ] Structured data (JSON-LD)
- [ ] Google Search Console verified
- [ ] Sitemap submitted
- [ ] Google Business Profile (local businesses)

---

## 10. Analytics

### PostHog:
- [ ] Project created
- [ ] posthog-js installed
- [ ] Provider configured
- [ ] Page view tracking for SPA
- [ ] Environment variables set

### What to Track:
- Page views
- Key user actions (signups, form submissions)
- Feature usage
- Errors

---

## 11. Error Monitoring

### Options:
- **Sentry** - Full error tracking
- **PostHog** - Basic error capture
- **LogRocket** - Session replay + errors

### Minimum Setup:
- [ ] Unhandled exceptions logged
- [ ] API errors tracked
- [ ] Alert notifications configured (email/Slack)

---

## 12. Performance

### Frontend:
- [ ] Images optimized (WebP, compressed)
- [ ] Lazy loading for images
- [ ] Code splitting for routes
- [ ] Bundle size analyzed
- [ ] Lighthouse score > 90

### Backend:
- [ ] Database queries optimized (N+1 fixed)
- [ ] Caching configured (if needed)
- [ ] Rate limiting enabled
- [ ] Compression enabled (gzip/brotli)

### Testing:
- [ ] PageSpeed Insights score checked
- [ ] Mobile performance verified
- [ ] Load testing (if high traffic expected)

---

## 13. Security

### Headers (usually automatic with hosting):
- [ ] X-Frame-Options
- [ ] X-Content-Type-Options
- [ ] Referrer-Policy
- [ ] Content-Security-Policy (if strict security needed)

### API Security:
- [ ] CORS configured (only allow production domain)
- [ ] Rate limiting enabled
- [ ] Input validation
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention

### Authentication:
- [ ] Sessions expire appropriately
- [ ] Password requirements enforced
- [ ] Sensitive routes protected
- [ ] Admin routes require admin role

---

## 14. Legal & Compliance

### Required Pages:
- [ ] Privacy Policy
- [ ] Terms of Service
- [ ] Cookie Policy (if using cookies)

### Compliance:
- [ ] GDPR (if EU users) - consent, data deletion
- [ ] CCPA (if CA users) - disclosure, opt-out
- [ ] ADA/WCAG (accessibility)

### Cookie Consent:
- [ ] Banner if using tracking cookies
- [ ] Opt-out mechanism

---

## 15. Pre-Launch Testing

### Functional Testing:
- [ ] All user flows work end-to-end
- [ ] Forms submit correctly
- [ ] Emails send and are received
- [ ] Auth (login, logout, signup) works
- [ ] Protected routes redirect correctly
- [ ] Mobile responsive

### Browser Testing:
- [ ] Chrome
- [ ] Safari
- [ ] Firefox
- [ ] Mobile Safari (iOS)
- [ ] Chrome (Android)

### Edge Cases:
- [ ] Empty states
- [ ] Error states
- [ ] Long content
- [ ] Slow network

### Final Checks:
- [ ] Console has no errors
- [ ] No broken links (check with tool)
- [ ] Favicon shows correctly
- [ ] Social share preview works

---

## Launch Day

### Go-Live Steps:
1. [ ] Final code merge to main
2. [ ] Production environment variables verified
3. [ ] Database migrations run
4. [ ] DNS pointed to production
5. [ ] SSL certificate active
6. [ ] Smoke test all critical paths
7. [ ] Monitor error logs for first hour
8. [ ] Announce to client

### Post-Launch (First Week):
- [ ] Monitor error rates
- [ ] Check analytics data flowing
- [ ] Address any reported issues
- [ ] Verify search indexing started

---

## Quick Reference: Service Providers

| Service | Options |
|---------|---------|
| Domain | Namecheap, Google Domains, Cloudflare, Netlify |
| Frontend Hosting | Netlify, Vercel, Cloudflare Pages |
| Backend Hosting | Render, Railway, Fly.io, Heroku |
| Database | Neon, Supabase, PlanetScale, RDS |
| Auth | Clerk, Auth0, Supabase Auth |
| Email | Resend, SendGrid, Postmark, AWS SES |
| Storage | AWS S3, Cloudflare R2, Supabase Storage |
| Analytics | PostHog, Plausible, Google Analytics |
| Errors | Sentry, LogRocket, Bugsnag |

---

*Last updated: January 2026*
