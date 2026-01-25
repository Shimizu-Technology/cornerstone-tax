Rails.application.routes.draw do
  # Health check for load balancers
  get "up" => "rails/health#show", as: :rails_health_check

  # API v1
  namespace :api do
    namespace :v1 do
      # Authentication
      post "auth/me", to: "auth#me"

      # Intake form submission (public, no auth required)
      post "intake", to: "intake#create"

      # Contact form submission (public, no auth required)
      post "contact", to: "contact#create"

      # Workflow stages (public, for form dropdowns)
      resources :workflow_stages, only: [:index]

      # Admin/Employee routes (requires authentication)
      resources :clients, only: [:index, :show, :create, :update]
      resources :tax_returns, only: [:index, :show, :update] do
        member do
          post :assign
        end
        resources :income_sources, only: [:index, :show, :create, :update, :destroy]
        
        # Documents nested under tax_returns
        resources :documents, only: [:index, :create] do
          collection do
            post :presign
          end
        end
      end

      # Documents standalone routes (for show, download, destroy)
      resources :documents, only: [:show, :destroy] do
        member do
          get :download
        end
      end

      # Users list (for assignment dropdowns)
      resources :users, only: [:index]

      # Workflow events / Activity feed
      resources :workflow_events, only: [:index]

      # Audit logs (for general activity tracking)
      resources :audit_logs, only: [:index]

      # Time tracking
      resources :time_entries, only: [:index, :show, :create, :update, :destroy]
      resources :time_categories, only: [:index]

      # Employee scheduling
      resources :schedules, only: [:index, :show, :create, :update, :destroy] do
        collection do
          get :my_schedule
          post :bulk_create
          delete :clear_week
        end
      end

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

        # System settings
        resource :settings, only: [:show, :update]
      end
    end
  end
end
