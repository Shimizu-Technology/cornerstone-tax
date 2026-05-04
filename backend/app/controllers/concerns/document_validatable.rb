# frozen_string_literal: true

module DocumentValidatable
  extend ActiveSupport::Concern

  ALLOWED_CONTENT_TYPES = %w[
    application/pdf
    image/jpeg
    image/png
    text/plain
    text/csv
    application/csv
    application/msword
    application/vnd.openxmlformats-officedocument.wordprocessingml.document
    application/vnd.ms-excel
    application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    application/vnd.ms-powerpoint
    application/vnd.openxmlformats-officedocument.presentationml.presentation
  ].freeze
  MAX_FILE_SIZE = 50.megabytes
  CONTENT_TYPE_EXTENSIONS = {
    "application/pdf" => %w[.pdf],
    "image/jpeg" => %w[.jpg .jpeg],
    "image/png" => %w[.png],
    "text/plain" => %w[.txt],
    "text/csv" => %w[.csv],
    "application/csv" => %w[.csv],
    "application/msword" => %w[.doc],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => %w[.docx],
    "application/vnd.ms-excel" => %w[.xls],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => %w[.xlsx],
    "application/vnd.ms-powerpoint" => %w[.ppt],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation" => %w[.pptx]
  }.freeze

  private

  def content_type_matches_extension?(content_type, filename)
    ext = File.extname(filename).downcase
    allowed_exts = CONTENT_TYPE_EXTENSIONS[content_type]
    allowed_exts.present? && allowed_exts.include?(ext)
  end

  def uploaded_object_available?(s3_key, expected_size)
    return false unless S3Service.configured?

    S3Service.object_exists?(s3_key: s3_key, expected_size: expected_size)
  end
end
