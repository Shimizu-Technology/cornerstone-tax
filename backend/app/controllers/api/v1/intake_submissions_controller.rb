# frozen_string_literal: true

module Api
  module V1
    # Staff review of public intakes whose email matched a client already on
    # file. The public form never edits that client; staff compare the two
    # here and either merge selected fields or keep the records apart.
    class IntakeSubmissionsController < BaseController
      before_action :authenticate_user!
      before_action :require_staff!
      before_action :set_submission, only: [ :show, :merge, :keep_separate ]

      # GET /api/v1/intake_submissions?status=needs_review
      def index
        submissions = IntakeSubmission.includes(:client, :matched_client, :tax_return)
                                      .where(status: params[:status].presence || "needs_review")
                                      .order(submitted_at: :desc)
                                      .limit(100)

        render json: { intake_submissions: submissions.map { |submission| submission_summary(submission) } }
      end

      # GET /api/v1/intake_submissions/:id
      def show
        render json: { intake_submission: submission_detail(@submission) }
      end

      # POST /api/v1/intake_submissions/:id/merge
      def merge
        client = IntakeMergeService.call(
          submission: @submission,
          user: current_user,
          fields: params[:fields],
          include_dependents: params[:include_dependents]
        )

        render json: { intake_submission: submission_summary(@submission.reload), client_id: client.id }
      rescue IntakeMergeService::Error => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/intake_submissions/:id/keep_separate
      def keep_separate
        reviewed = @submission.with_lock do
          next false unless @submission.status == "needs_review"

          @submission.update!(status: "reviewed", reviewed_by: current_user, reviewed_at: Time.current)
        end

        if reviewed
          render json: { intake_submission: submission_summary(@submission) }
        else
          render json: { error: "This intake is no longer waiting for review" }, status: :unprocessable_entity
        end
      end

      private

      def set_submission
        @submission = IntakeSubmission.includes(:client, :matched_client, :tax_return).find(params[:id])
      end

      def submission_summary(submission)
        {
          id: submission.id,
          status: submission.status,
          submitted_at: submission.submitted_at,
          reviewed_at: submission.reviewed_at,
          tax_year: submission.tax_return&.tax_year,
          client: client_ref(submission.client),
          matched_client: client_ref(submission.matched_client)
        }
      end

      def submission_detail(submission)
        intake_client = submission.client
        existing_client = submission.matched_client
        intake_return = submission.tax_return

        submission_summary(submission).merge(
          fields: IntakeMergeService::FIELD_LABELS.map do |field, label|
            attribute = IntakeMergeService.attribute_for(field)
            submitted = intake_client.public_send(attribute)
            existing = existing_client&.public_send(attribute)
            masked = IntakeMergeService::BANK_FIELDS.key?(field)

            {
              key: field,
              label: label,
              submitted: masked ? mask(submitted) : submitted,
              existing: masked ? mask(existing) : existing,
              differs: submitted != existing
            }
          end,
          submitted_dependents: intake_client.dependents.map { |dep| dependent_ref(dep) },
          existing_dependents: (existing_client&.dependents || []).map { |dep| dependent_ref(dep) },
          tax_return: intake_return && {
            id: intake_return.id,
            tax_year: intake_return.tax_year,
            documents_count: intake_return.documents.count,
            income_sources_count: intake_return.income_sources.count
          }
        )
      end

      def client_ref(client)
        return nil unless client

        { id: client.id, full_name: client.full_name, email: client.email, archived: client.archived? }
      end

      def dependent_ref(dep)
        { name: dep.name, date_of_birth: dep.date_of_birth, relationship: dep.relationship }
      end

      def mask(value)
        return nil if value.blank?

        "••••#{value.to_s.last(4)}"
      end
    end
  end
end
