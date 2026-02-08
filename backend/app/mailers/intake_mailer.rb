# frozen_string_literal: true

require "cgi"

# CST-37: Send email notification to admin when a new intake form is submitted
class IntakeMailer < ApplicationMailer
  def intake_submitted_email(client:, tax_return:)
    @client = client
    @tax_return = tax_return

    from_email = ENV.fetch("MAILER_FROM_EMAIL", "noreply@example.com")
    to_email = Setting.get("contact_email")

    return if to_email.blank?

    Rails.logger.info "📧 Sending intake notification email to: #{to_email}"

    Resend::Emails.send({
      from: from_email,
      to: to_email,
      subject: "New Client Intake: #{@client.full_name}",
      html: intake_submitted_html
    })
  end

  private

  def intake_submitted_html
    dependents_html = if @client.dependents.any?
      <<~HTML
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
            <strong style="color: #888888; font-size: 14px;">Dependents:</strong>
            <p style="color: #2d2a26; font-size: 16px; margin: 5px 0 0 0;">
              #{@client.dependents.map(&:name).join(", ")}
            </p>
          </td>
        </tr>
      HTML
    else
      ""
    end

    <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Client Intake Submission</title>
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
                    <h2 style="color: #2d2a26; margin: 0 0 20px 0; font-size: 22px;">New Client Intake Submitted 📋</h2>
                    
                    <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      A new client has submitted an intake form and is ready for review.
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                          <strong style="color: #888888; font-size: 14px;">Client Name:</strong>
                          <p style="color: #2d2a26; font-size: 16px; margin: 5px 0 0 0;">#{CGI.escapeHTML(@client.full_name)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                          <strong style="color: #888888; font-size: 14px;">Email:</strong>
                          <p style="color: #2d2a26; font-size: 16px; margin: 5px 0 0 0;">
                            <a href="mailto:#{CGI.escapeHTML(@client.email)}" style="color: #8b7355; text-decoration: none;">#{CGI.escapeHTML(@client.email)}</a>
                          </p>
                        </td>
                      </tr>
                      #{phone_row}
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                          <strong style="color: #888888; font-size: 14px;">Filing Status:</strong>
                          <p style="color: #2d2a26; font-size: 16px; margin: 5px 0 0 0;">#{CGI.escapeHTML(@client.filing_status&.humanize || "Not specified")}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                          <strong style="color: #888888; font-size: 14px;">Tax Year:</strong>
                          <p style="color: #2d2a26; font-size: 16px; margin: 5px 0 0 0;">#{@tax_return.tax_year}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                          <strong style="color: #888888; font-size: 14px;">New Client:</strong>
                          <p style="color: #2d2a26; font-size: 16px; margin: 5px 0 0 0;">#{@client.is_new_client ? "Yes" : "Returning client"}</p>
                        </td>
                      </tr>
                      #{dependents_html}
                    </table>

                    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background-color: #8b7355; border-radius: 8px;">
                          <a href="#{ENV.fetch("FRONTEND_URL", "http://localhost:5173")}/admin/clients/#{@client.id}" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600;">
                            View Client Profile
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
                      This is an automated notification from your client intake system.
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
    return "" if @client.phone.blank?

    <<~HTML
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
          <strong style="color: #888888; font-size: 14px;">Phone:</strong>
          <p style="color: #2d2a26; font-size: 16px; margin: 5px 0 0 0;">
            <a href="tel:#{@client.phone}" style="color: #8b7355; text-decoration: none;">#{CGI.escapeHTML(@client.phone)}</a>
          </p>
        </td>
      </tr>
    HTML
  end
end
