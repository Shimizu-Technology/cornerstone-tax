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

      # Workflow stages (public, for form dropdowns)
      resources :workflow_stages, only: [:index]

      # Admin/Employee routes (requires authentication)
      resources :clients, only: [:index, :show, :create, :update]
      resources :tax_returns, only: [:index, :show, :update] do
        member do
          post :assign
        end
        resources :income_sources, only: [:index, :show, :create, :update, :destroy]
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
      end
    end
  end
end
