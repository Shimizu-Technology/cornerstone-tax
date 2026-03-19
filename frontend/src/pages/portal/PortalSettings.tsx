import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

export default function PortalSettings() {
  useEffect(() => { document.title = 'Settings | Cornerstone Client Portal' }, [])

  const [preference, setPreference] = useState<string>('email')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const result = await api.portalGetSettings()
        if (result.data) {
          setPreference(result.data.notification_preference)
        }
      } catch {
        setError('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSuccess(null)
    setError(null)
    try {
      const result = await api.portalUpdateSettings({ notification_preference: preference })
      if (result.data) {
        setPreference(result.data.notification_preference)
        setSuccess('Settings saved successfully!')
      } else if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your notification preferences.</p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Email Notifications</h2>
          <p className="text-sm text-gray-500 mb-5">
            Choose whether you'd like to receive email updates about your tax returns.
          </p>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all">
              <input
                type="radio"
                name="notification_preference"
                value="email"
                checked={preference === 'email'}
                onChange={() => setPreference('email')}
                className="mt-0.5 w-4 h-4 text-primary border-gray-300 focus:ring-primary"
              />
              <div>
                <p className="font-medium text-gray-900">Email notifications</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Receive email updates when there's a status change on your tax return, such as "Documents Needed" or "Ready for Pickup."
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all">
              <input
                type="radio"
                name="notification_preference"
                value="none"
                checked={preference === 'none'}
                onChange={() => setPreference('none')}
                className="mt-0.5 w-4 h-4 text-primary border-gray-300 focus:ring-primary"
              />
              <div>
                <p className="font-medium text-gray-900">No notifications</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  You won't receive any email notifications. You can still check your portal for updates anytime.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  )
}
