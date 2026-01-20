# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_01_20_051147) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "audit_logs", force: :cascade do |t|
    t.string "action", null: false
    t.bigint "auditable_id", null: false
    t.string "auditable_type", null: false
    t.json "changes_made"
    t.datetime "created_at", null: false
    t.string "metadata"
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["action"], name: "index_audit_logs_on_action"
    t.index ["auditable_type", "auditable_id"], name: "index_audit_logs_on_auditable_type_and_auditable_id"
    t.index ["created_at"], name: "index_audit_logs_on_created_at"
    t.index ["user_id"], name: "index_audit_logs_on_user_id"
  end

  create_table "clients", force: :cascade do |t|
    t.string "bank_account_number_encrypted"
    t.string "bank_account_type"
    t.string "bank_routing_number_encrypted"
    t.text "changes_from_prior_year"
    t.datetime "created_at", null: false
    t.date "date_of_birth"
    t.boolean "denied_eic_actc", default: false
    t.integer "denied_eic_actc_year"
    t.string "email"
    t.string "filing_status"
    t.string "first_name", null: false
    t.boolean "has_crypto_transactions", default: false
    t.boolean "has_prior_year_return", default: false
    t.boolean "is_new_client", default: true
    t.string "last_name", null: false
    t.text "mailing_address"
    t.string "phone"
    t.date "spouse_dob"
    t.string "spouse_name"
    t.datetime "updated_at", null: false
    t.boolean "wants_direct_deposit", default: false
    t.index ["email"], name: "index_clients_on_email"
    t.index ["last_name", "first_name"], name: "index_clients_on_last_name_and_first_name"
  end

  create_table "dependents", force: :cascade do |t|
    t.boolean "can_be_claimed_by_other"
    t.bigint "client_id", null: false
    t.datetime "created_at", null: false
    t.date "date_of_birth"
    t.boolean "is_disabled"
    t.boolean "is_student"
    t.integer "months_lived_with_client"
    t.string "name"
    t.string "relationship"
    t.datetime "updated_at", null: false
    t.index ["client_id"], name: "index_dependents_on_client_id"
  end

  create_table "documents", force: :cascade do |t|
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "document_type"
    t.integer "file_size"
    t.string "filename", null: false
    t.string "s3_key", null: false
    t.bigint "tax_return_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "uploaded_by_id"
    t.index ["tax_return_id"], name: "index_documents_on_tax_return_id"
    t.index ["uploaded_by_id"], name: "index_documents_on_uploaded_by_id"
  end

  create_table "income_sources", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "notes"
    t.string "payer_name"
    t.string "source_type"
    t.bigint "tax_return_id", null: false
    t.datetime "updated_at", null: false
    t.index ["tax_return_id"], name: "index_income_sources_on_tax_return_id"
  end

  create_table "notifications", force: :cascade do |t|
    t.bigint "client_id", null: false
    t.text "content"
    t.datetime "created_at", null: false
    t.text "error_message"
    t.string "notification_type"
    t.string "recipient"
    t.datetime "sent_at"
    t.string "status", default: "pending"
    t.bigint "tax_return_id"
    t.string "template"
    t.datetime "updated_at", null: false
    t.index ["client_id"], name: "index_notifications_on_client_id"
    t.index ["status"], name: "index_notifications_on_status"
    t.index ["tax_return_id"], name: "index_notifications_on_tax_return_id"
  end

  create_table "tax_returns", force: :cascade do |t|
    t.bigint "assigned_to_id"
    t.bigint "client_id", null: false
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.text "notes"
    t.bigint "reviewed_by_id"
    t.integer "tax_year", null: false
    t.datetime "updated_at", null: false
    t.bigint "workflow_stage_id"
    t.index ["assigned_to_id"], name: "index_tax_returns_on_assigned_to_id"
    t.index ["client_id", "tax_year"], name: "index_tax_returns_on_client_id_and_tax_year", unique: true
    t.index ["client_id"], name: "index_tax_returns_on_client_id"
    t.index ["reviewed_by_id"], name: "index_tax_returns_on_reviewed_by_id"
    t.index ["workflow_stage_id"], name: "index_tax_returns_on_workflow_stage_id"
  end

  create_table "time_categories", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.boolean "is_active", default: true
    t.string "name", null: false
    t.datetime "updated_at", null: false
  end

  create_table "time_entries", force: :cascade do |t|
    t.bigint "client_id"
    t.datetime "created_at", null: false
    t.text "description"
    t.decimal "hours", precision: 4, scale: 2, null: false
    t.bigint "tax_return_id"
    t.bigint "time_category_id"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.date "work_date", null: false
    t.index ["client_id"], name: "index_time_entries_on_client_id"
    t.index ["tax_return_id"], name: "index_time_entries_on_tax_return_id"
    t.index ["time_category_id"], name: "index_time_entries_on_time_category_id"
    t.index ["user_id"], name: "index_time_entries_on_user_id"
    t.index ["work_date"], name: "index_time_entries_on_work_date"
  end

  create_table "transmittals", force: :cascade do |t|
    t.bigint "client_id", null: false
    t.datetime "created_at", null: false
    t.bigint "created_by_id", null: false
    t.date "date"
    t.jsonb "items", default: []
    t.text "notes"
    t.string "status", default: "draft"
    t.bigint "tax_return_id"
    t.string "transmittal_number"
    t.datetime "updated_at", null: false
    t.index ["client_id"], name: "index_transmittals_on_client_id"
    t.index ["created_by_id"], name: "index_transmittals_on_created_by_id"
    t.index ["tax_return_id"], name: "index_transmittals_on_tax_return_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "clerk_id", null: false
    t.bigint "client_id"
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "first_name"
    t.string "last_name"
    t.string "phone"
    t.string "role", default: "client"
    t.datetime "updated_at", null: false
    t.index ["clerk_id"], name: "index_users_on_clerk_id", unique: true
    t.index ["client_id"], name: "index_users_on_client_id"
    t.index ["email"], name: "index_users_on_email"
    t.index ["role"], name: "index_users_on_role"
  end

  create_table "workflow_events", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.string "event_type"
    t.string "new_value"
    t.string "old_value"
    t.bigint "tax_return_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["tax_return_id"], name: "index_workflow_events_on_tax_return_id"
    t.index ["user_id"], name: "index_workflow_events_on_user_id"
  end

  create_table "workflow_stages", force: :cascade do |t|
    t.string "color"
    t.datetime "created_at", null: false
    t.text "description"
    t.boolean "is_active", default: true
    t.string "name", null: false
    t.boolean "notify_client", default: false
    t.integer "position", null: false
    t.string "slug", null: false
    t.datetime "updated_at", null: false
    t.index ["position"], name: "index_workflow_stages_on_position"
    t.index ["slug"], name: "index_workflow_stages_on_slug", unique: true
  end

  add_foreign_key "audit_logs", "users"
  add_foreign_key "dependents", "clients"
  add_foreign_key "documents", "tax_returns"
  add_foreign_key "documents", "users", column: "uploaded_by_id"
  add_foreign_key "income_sources", "tax_returns"
  add_foreign_key "notifications", "clients"
  add_foreign_key "notifications", "tax_returns"
  add_foreign_key "tax_returns", "clients"
  add_foreign_key "tax_returns", "users", column: "assigned_to_id"
  add_foreign_key "tax_returns", "users", column: "reviewed_by_id"
  add_foreign_key "tax_returns", "workflow_stages"
  add_foreign_key "time_entries", "clients"
  add_foreign_key "time_entries", "tax_returns"
  add_foreign_key "time_entries", "time_categories"
  add_foreign_key "time_entries", "users"
  add_foreign_key "transmittals", "clients"
  add_foreign_key "transmittals", "tax_returns"
  add_foreign_key "transmittals", "users", column: "created_by_id"
  add_foreign_key "users", "clients"
  add_foreign_key "workflow_events", "tax_returns"
  add_foreign_key "workflow_events", "users"
end
