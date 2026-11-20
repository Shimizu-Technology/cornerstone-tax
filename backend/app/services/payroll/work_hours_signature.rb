# frozen_string_literal: true

require "erb"
require "openssl"

module Payroll
  # Request signing for GET /api/v1/payroll/work_hours (Work Hours v1).
  #
  # Headers:
  #   X-Work-Hours-Timestamp: unix seconds
  #   X-Work-Hours-Signature: hex(HMAC-SHA256(PAYROLL_WORK_HOURS_SECRET, string_to_sign))
  #
  # string_to_sign = "#{METHOD}\n#{path}\n#{canonical_query}\n#{timestamp}\n#{sha256_hex(body)}"
  #   - METHOD is upper case ("GET");
  #   - path has no query string ("/api/v1/payroll/work_hours");
  #   - canonical_query: every name=value pair, percent-decoded, then each
  #     side re-encoded per RFC 3986 (unreserved A-Z a-z 0-9 - _ . ~ kept,
  #     everything else %XX upper-case), sorted by name then value, joined
  #     with "&" ("" when there is no query);
  #   - body is the raw request body ("" for GET).
  # Requests more than WINDOW_SECONDS away from the server clock are refused.
  # Contract and a reusable Ruby signer: docs/PAYROLL_WORK_HOURS_FEED.md.
  module WorkHoursSignature
    TIMESTAMP_HEADER = "X-Work-Hours-Timestamp"
    SIGNATURE_HEADER = "X-Work-Hours-Signature"
    WINDOW_SECONDS = 300

    module_function

    def canonical_query(query_string)
      query_string.to_s.split("&").reject(&:empty?).map do |pair|
        name, value = pair.split("=", 2)
        [ URI.decode_www_form_component(name.to_s), URI.decode_www_form_component(value.to_s) ]
      end.sort.map { |name, value| "#{ERB::Util.url_encode(name)}=#{ERB::Util.url_encode(value)}" }.join("&")
    end

    def string_to_sign(method:, path:, query_string:, timestamp:, body:)
      [ method.to_s.upcase, path, canonical_query(query_string), timestamp.to_s, OpenSSL::Digest::SHA256.hexdigest(body.to_s) ].join("\n")
    end

    def sign(secret:, method:, path:, query_string:, timestamp:, body: "")
      OpenSSL::HMAC.hexdigest("SHA256", secret, string_to_sign(method: method, path: path, query_string: query_string, timestamp: timestamp, body: body))
    end

    # Returns nil when the request is genuine, or a short reason it isn't.
    def verify(secret:, request:, now: Time.current)
      timestamp = request.headers[TIMESTAMP_HEADER].to_s
      signature = request.headers[SIGNATURE_HEADER].to_s.downcase
      return "missing #{TIMESTAMP_HEADER} or #{SIGNATURE_HEADER}" if timestamp.empty? || signature.empty?
      return "#{TIMESTAMP_HEADER} must be unix seconds" unless timestamp.match?(/\A\d{1,12}\z/)
      return "request timestamp is outside the #{WINDOW_SECONDS / 60}-minute window" if (now.to_i - timestamp.to_i).abs > WINDOW_SECONDS

      expected = sign(secret: secret, method: request.request_method, path: request.path, query_string: request.query_string,
                      timestamp: timestamp, body: request.raw_post)
      # Constant time: both are 64-character hex strings, compared via digests.
      ActiveSupport::SecurityUtils.secure_compare(signature, expected) ? nil : "signature does not match"
    end
  end
end
