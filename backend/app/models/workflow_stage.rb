# frozen_string_literal: true

class WorkflowStage < ApplicationRecord
  has_many :tax_returns, dependent: :nullify

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true
  validates :position, presence: true, numericality: { only_integer: true }

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position) }

  before_validation :generate_slug, if: -> { slug.blank? && name.present? }

  private

  def generate_slug
    self.slug = name.parameterize.underscore
  end
end
