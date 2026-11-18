# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Client, type: :model do
  describe 'validations' do
    it 'requires first_name' do
      client = Client.new(last_name: 'Test', email: 'test@example.com')
      expect(client).not_to be_valid
      expect(client.errors[:first_name]).to include("can't be blank")
    end

    it 'requires last_name' do
      client = Client.new(first_name: 'Test', email: 'test@example.com')
      expect(client).not_to be_valid
      expect(client.errors[:last_name]).to include("can't be blank")
    end

    it 'does not require email (optional field)' do
      client = Client.new(first_name: 'Test', last_name: 'User')
      expect(client).to be_valid
    end

    it 'is valid with required attributes' do
      client = Client.new(
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        phone: '671-555-1234',
        date_of_birth: 30.years.ago,
        mailing_address: '123 Test St'
      )
      expect(client).to be_valid
    end
  end

  describe '#full_name' do
    it 'returns first and last name combined' do
      client = Client.new(first_name: 'John', last_name: 'Doe')
      expect(client.full_name).to eq('John Doe')
    end
  end

  describe 'associations' do
    it 'has many tax_returns' do
      association = described_class.reflect_on_association(:tax_returns)
      expect(association.macro).to eq(:has_many)
    end

    it 'has many dependents' do
      association = described_class.reflect_on_association(:dependents)
      expect(association.macro).to eq(:has_many)
    end
  end

  describe '#display_name' do
    it 'shows the business name for a business client' do
      client = Client.new(first_name: 'Maria', last_name: 'Santos', client_type: 'business', business_name: "MoSa's Joint")

      expect(client.display_name).to eq("MoSa's Joint")
    end

    it 'shows First Last for an individual' do
      client = Client.new(first_name: 'Jose', last_name: 'Cruz', client_type: 'individual')

      expect(client.display_name).to eq('Jose Cruz')
    end

    it 'falls back to the contact name when a business has no business name' do
      client = Client.new(first_name: 'Ana', last_name: 'Reyes', client_type: 'business', business_name: '  ')

      expect(client.display_name).to eq('Ana Reyes')
    end

    it 'sorts by the same label in SQL' do
      Client.create!(first_name: 'Zed', last_name: 'Aguon', client_type: 'business', business_name: 'Beta Corp')
      Client.create!(first_name: 'Amy', last_name: 'Cruz')
      Client.create!(first_name: 'Xavier', last_name: 'Diaz', client_type: 'business', business_name: 'alpha shop')

      expect(Client.order_by_display_name.map(&:display_name)).to eq([ 'alpha shop', 'Amy Cruz', 'Beta Corp' ])
    end
  end
end
