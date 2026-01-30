# frozen_string_literal: true

# Rate limiting configuration using Rack::Attack
# Protects public endpoints from abuse

class Rack::Attack
  # Use Rails cache for throttle storage
  Rack::Attack.cache.store = Rails.cache

  # --- Throttle Rules ---

  # CST-10: Limit intake form submissions to 5 per hour per IP
  throttle("intake/ip", limit: 5, period: 1.hour) do |req|
    if req.path == "/api/v1/intake" && req.post?
      req.ip
    end
  end

  # CST-10: Limit contact form submissions to 10 per hour per IP
  throttle("contact/ip", limit: 10, period: 1.hour) do |req|
    if req.path == "/api/v1/contact" && req.post?
      req.ip
    end
  end

  # --- Custom Response ---

  self.throttled_responder = lambda do |request|
    match_data = request.env["rack.attack.match_data"]
    now = match_data[:epoch_time]

    headers = {
      "Content-Type" => "application/json",
      "Retry-After" => (match_data[:period] - (now % match_data[:period])).to_s
    }

    body = {
      error: "Rate limit exceeded. Please try again later.",
      retry_after: headers["Retry-After"].to_i
    }.to_json

    [429, headers, [body]]
  end
end
