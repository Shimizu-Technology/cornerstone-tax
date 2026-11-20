# frozen_string_literal: true

# A public intake whose email matches an existing client is stored on its own
# client record and linked here as a possible match, so staff can review and
# merge it instead of the form overwriting the existing client.
class AddMatchReviewToIntakeSubmissions < ActiveRecord::Migration[8.1]
  def change
    add_reference :intake_submissions, :matched_client, foreign_key: { to_table: :clients }, null: true
    add_reference :intake_submissions, :reviewed_by, foreign_key: { to_table: :users }, null: true
    add_column :intake_submissions, :reviewed_at, :datetime
  end
end
