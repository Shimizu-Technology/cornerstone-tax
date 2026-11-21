# frozen_string_literal: true

# API shape for one time entry work line.
module WorkLineSerializer
  module_function

  def call(line)
    {
      id: line.id,
      position: line.position,
      client: line.client ? client_payload(line.client) : nil,
      client_label: line.client_label,
      description: line.description,
      service_type: line.service_type ? {
        id: line.service_type.id,
        name: line.service_type.name,
        color: line.service_type.color
      } : nil,
      service_task: line.service_task ? { id: line.service_task.id, name: line.service_task.name } : nil,
      category_label: line.category_label,
      period_type: line.period_type,
      period_start: line.period_start&.iso8601,
      period_label: line.period_label,
      hours: line.hours.to_f,
      minutes: line.minutes
    }
  end

  def client_payload(client)
    payload = { id: client.id, name: client.display_name, client_type: client.client_type }
    payload[:system_kind] = client.system_kind if client.respond_to?(:system_kind)
    payload
  end
end
