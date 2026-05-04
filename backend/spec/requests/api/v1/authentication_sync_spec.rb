# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Authenticated API user sync", type: :request do
  it "replaces placeholder emails when Clerk later provides a real email" do
    user = create(:user, email: "clerk_placeholder@placeholder.local")

    allow(ClerkAuth).to receive(:verify).and_return(
      {
        "sub" => user.clerk_id,
        "email" => "real-client@example.com",
        "first_name" => "Real",
        "last_name" => "Client"
      }
    )

    get "/api/v1/service_types", headers: { "Authorization" => "Bearer real-token" }

    expect(response).to have_http_status(:ok)
    expect(user.reload.email).to eq("real-client@example.com")
    expect(user.first_name).to eq("Real")
    expect(user.last_name).to eq("Client")
  end

  it "does not overwrite a non-placeholder email on every authenticated request" do
    user = create(:user, email: "admin-corrected@example.com")

    allow(ClerkAuth).to receive(:verify).and_return(
      {
        "sub" => user.clerk_id,
        "email" => "stale-clerk@example.com",
        "first_name" => "Real",
        "last_name" => "Client"
      }
    )

    get "/api/v1/service_types", headers: { "Authorization" => "Bearer real-token" }

    expect(response).to have_http_status(:ok)
    expect(user.reload.email).to eq("admin-corrected@example.com")
  end
end
