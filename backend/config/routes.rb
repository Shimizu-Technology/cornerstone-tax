Rails.application.routes.draw do
  # Health check for load balancers
  get "up" => "rails/health#show", as: :rails_health_check

  # API v1
  namespace :api do
    namespace :v1 do
      # Authentication
      get "auth/me", to: "auth#me"
      post "auth/me", to: "auth#me"

      # Intake form submission (public, no auth required)
      post "intake", to: "intake#create"

      # Contact form submission (public, no auth required)
      post "contact", to: "contact#create"

      # Workflow stages (public, for form dropdowns)
      resources :workflow_stages, only: [:index]

      # Admin/Employee routes (requires authentication)
      resources :clients, only: [:index, :show, :create, :update] do
        member do
          post :archive
          post :unarchive
        end
        resources :contacts, controller: "client_contacts", only: [:index, :create, :update, :destroy]
        resources :operation_assignments, controller: "client_operation_assignments", only: [:index, :create]
        resources :operation_cycles, controller: "operation_cycles", only: [:index] do
          collection do
            post :generate
          end
        end
      end
      resources :client_operation_assignments, only: [:update]
      resources :operation_templates, only: [:index, :create, :update, :destroy] do
        resources :tasks, controller: "operation_template_tasks", only: [:index, :create] do
          collection do
            post :reorder
          end
        end
      end
      resources :operation_template_tasks, only: [:update, :destroy]
      resources :operation_cycles, only: [:show]
      resources :operation_tasks, only: [:index, :update] do
        collection do
          get :my_tasks
        end
        member do
          post :complete
          post :reopen
        end
      end

      resources :daily_tasks, only: [:index, :show, :create, :update, :destroy] do
        collection do
          get :my_tasks
          post :reorder
          post :bulk_create
          post :copy_to_date
        end
        member do
          post :complete
          post :reopen
        end
      end
      resources :tax_returns, only: [:index, :show, :update] do
        member do
          post :assign
        end
        resources :income_sources, only: [:index, :show, :create, :update, :destroy]
        
        # Documents nested under tax_returns (CST-14: all access scoped through tax_return)
        resources :documents, only: [:index, :show, :create, :destroy] do
          collection do
            post :presign
          end
          member do
            get :download
          end
        end
      end

      # Users list (for assignment dropdowns)
      resources :users, only: [:index]

      # Workflow events / Activity feed
      resources :workflow_events, only: [:index]

      # Audit logs (for general activity tracking)
      resources :audit_logs, only: [:index]

      # Time tracking
      resources :time_entries, only: [:index, :show, :create, :update, :destroy] do
        collection do
          post :clock_in
          post :clock_out
          post :start_break
          post :end_break
          get :current_status
          get :pending_approvals
          get :whos_working
        end
        member do
          post :approve
          post :deny
          post :approve_overtime
          post :deny_overtime
        end
      end
      resources :time_categories, only: [:index]
      resources :time_period_locks, only: [:index]

      # Employee scheduling
      resources :schedules, only: [:index, :show, :create, :update, :destroy] do
        collection do
          get :my_schedule
          post :bulk_create
          delete :clear_week
        end
      end

      # Schedule time presets (active only, for schedule form)
      resources :schedule_time_presets, only: [:index]

      # Service types (active only, for dropdowns)
      resources :service_types, only: [:index]

      # Client Portal (requires client role)
      namespace :portal do
        get :dashboard, to: "dashboard#show"
        resource :settings, only: [:show, :update]
        resources :tax_returns, only: [:index, :show] do
          resources :documents, only: [:index, :create] do
            collection do
              post :presign
            end
            member do
              get :download
            end
          end
        end
      end

      # Payroll checklist facade endpoints
      get "payroll_checklists/board", to: "payroll_checklists#board"
      resources :payroll_checklists, only: [] do
        collection do
          post "periods", to: "payroll_checklist_periods#create"
        end
      end
      resources :payroll_checklist_periods, path: "payroll_checklists/periods", only: [:show] do
        member do
          post :complete
          post :reopen
        end
      end
      resources :payroll_checklist_items, path: "payroll_checklists/items", only: [:update] do
        member do
          patch :toggle
        end
      end

      # Payroll ingest (shared-secret auth, service-to-service)
      post "payroll/ingest", to: "payroll_ingest#create"

      # Admin-only routes
      namespace :admin do
        resources :workflow_stages do
          member do
            post :move
          end
          collection do
            post :reorder
          end
        end

        # User management (invite, list, update role, delete)
        resources :users, only: [:index, :show, :create, :update, :destroy]

        # Time category management
        resources :time_categories, only: [:index, :show, :create, :update, :destroy]
        resources :time_period_locks, only: [:create, :destroy]

        # Schedule time presets management
        resources :schedule_time_presets, only: [:index, :show, :create, :update, :destroy] do
          collection do
            post :reorder
          end
        end

        # Service types and tasks management
        resources :service_types, only: [:index, :show, :create, :update, :destroy] do
          collection do
            post :reorder
          end
          resources :tasks, controller: 'service_tasks', only: [:index, :show, :create, :update, :destroy] do
            collection do
              post :reorder
            end
          end
        end

        # Payroll import batches (read-only admin visibility)
        resources :payroll_import_batches, only: [:index, :show]

        # System settings
        resource :settings, only: [:show, :update]
      end
    end
  end
end
