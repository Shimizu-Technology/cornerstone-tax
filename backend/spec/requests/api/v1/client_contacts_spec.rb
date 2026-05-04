# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::ClientContacts", type: :request do
  let(:staff_user) { create(:user, :employee) }
  let(:client) { Client.create!(first_name: "Pat", last_name: "Client", email: "pat@example.com") }
  let(:other_client) { Client.create!(first_name: "Other", last_name: "Client", email: "other@example.com") }
  let(:client_user) { create(:user, email: "portal@example.com", role: "client", client: client) }

  def auth_headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end

  describe "GET /api/v1/clients/:client_id/contacts" do
    it "blocks client users from reading another client's contacts" do
      other_client.client_contacts.create!(
        first_name: "Sensitive",
        last_name: "Contact",
        email: "sensitive@example.com"
      )

      get "/api/v1/clients/#{other_client.id}/contacts", headers: auth_headers_for(client_user)

      expect(response).to have_http_status(:forbidden)
      expect(JSON.parse(response.body).fetch("error")).to eq("Staff access required")
    end

    it "allows staff users to read client contacts" do
      client.client_contacts.create!(
        first_name: "Primary",
        last_name: "Contact",
        email: "primary@example.com"
      )

      get "/api/v1/clients/#{client.id}/contacts", headers: auth_headers_for(staff_user)

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).fetch("contacts").length).to eq(1)
    end
  end

  describe "POST /api/v1/clients/:client_id/contacts" do
    it "blocks client users from creating contacts" do
      post "/api/v1/clients/#{client.id}/contacts",
           params: { contact: { first_name: "New", last_name: "Contact" } },
           headers: auth_headers_for(client_user)

      expect(response).to have_http_status(:forbidden)
      expect(client.client_contacts.count).to eq(0)
    end
  end
end
