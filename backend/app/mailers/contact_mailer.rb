# frozen_string_literal: true

require "cgi"

class ContactMailer < ApplicationMailer
  def contact_form_email(name:, email:, phone:, subject:, message:)
    @name = CGI.escapeHTML(name.to_s)
    @email = CGI.escapeHTML(email.to_s)
    @phone = CGI.escapeHTML(phone.to_s)
    @subject_line = CGI.escapeHTML(subject.to_s)
    @message = CGI.escapeHTML(message.to_s)

    from_email = ENV.fetch("MAILER_FROM_EMAIL", "noreply@example.com")
    to_email = Setting.get("contact_email")

    # Sanitize reply_to and subject to prevent CRLF header injection
    safe_reply_to = email.to_s.delete("\r\n")
    safe_subject = subject.to_s.delete("\r\n")

    Rails.logger.info "📧 Sending contact form email to: #{to_email}"

    Resend::Emails.send({
      from: from_email,
      to: to_email,
      reply_to: safe_reply_to,
      subject: "Contact Form: #{safe_subject}",
      html: contact_form_html
    })
  end

  private

  def contact_form_html
    <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Contact Form Submission</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f3ef;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <tr>
            <td>
              <!-- Header -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #2d2a26; border-radius: 12px 12px 0 0; padding: 30px;">
                <tr>
                  <td align="center">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">CORNERSTONE</h1>
                    <p style="color: #d4c4b0; margin: 5px 0 0 0; font-size: 12px; letter-spacing: 1px;">ACCOUNTING & BUSINESS MANAGEMENT</p>
                  </td>
                </tr>
              </table>

              <!-- Content -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; padding: 40px 30px;">
                <tr>
                  <td>
                    <h2 style="color: #2d2a26; margin: 0 0 20px 0; font-size: 22px;">New Contact Form Submission 📬</h2>
                    
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                          <strong style="color: #888888; font-size: 14px;">From:</strong>
                          <p style="color: #2d2a26; font-size: 16px; margin: 5px 0 0 0;">#{@name}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                          <strong style="color: #888888; font-size: 14px;">Email:</strong>
                          <p style="color: #2d2a26; font-size: 16px; margin: 5px 0 0 0;">
                            <a href="mailto:#{@email}" style="color: #8b7355; text-decoration: none;">#{@email}</a>
                          </p>
                        </td>
                      </tr>
                      #{phone_row}
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                          <strong style="color: #888888; font-size: 14px;">Subject:</strong>
                          <p style="color: #2d2a26; font-size: 16px; margin: 5px 0 0 0;">#{@subject_line}</p>
                        </td>
                      </tr>
                    </table>

                    <div style="background-color: #f5f3ef; border-radius: 8px; padding: 20px;">
                      <strong style="color: #888888; font-size: 14px; display: block; margin-bottom: 10px;">Message:</strong>
                      <p style="color: #2d2a26; font-size: 16px; line-height: 1.6; margin: 0; white-space: pre-wrap;">#{@message}</p>
                    </div>

                    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background-color: #8b7355; border-radius: 8px;">
                          <a href="mailto:#{@email}?subject=Re: #{@subject_line}" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600;">
                            Reply to #{@name}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ef; border-radius: 0 0 12px 12px; padding: 20px 30px;">
                <tr>
                  <td align="center">
                    <p style="color: #888888; font-size: 12px; margin: 0;">
                      This email was sent from the contact form on your website.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    HTML
  end

  def phone_row
    return "" if @phone.blank?

    <<~HTML
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
          <strong style="color: #888888; font-size: 14px;">Phone:</strong>
          <p style="color: #2d2a26; font-size: 16px; margin: 5px 0 0 0;">
            <a href="tel:#{@phone}" style="color: #8b7355; text-decoration: none;">#{@phone}</a>
          </p>
        </td>
      </tr>
    HTML
  end
end
