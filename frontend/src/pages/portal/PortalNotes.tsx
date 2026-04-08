import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { ClientNote } from '../../lib/api'

const CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-700' },
  { value: 'document', label: 'Document', color: 'bg-blue-100 text-blue-700' },
  { value: 'question', label: 'Question', color: 'bg-amber-100 text-amber-700' },
] as const

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function CategoryBadge({ category }: { category: ClientNote['category'] }) {
  const cat = CATEGORIES.find(c => c.value === category) ?? CATEGORIES[0]
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.color}`}>
      {cat.label}
    </span>
  )
}

export default function PortalNotes() {
  useEffect(() => { document.title = 'My Notes | Cornerstone Client Portal' }, [])

  const [notes, setNotes] = useState<ClientNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<'general' | 'document' | 'question'>('general')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  useEffect(() => {
    loadNotes()
  }, [])

  async function loadNotes() {
    setLoading(true)
    try {
      const res = await api.portalGetNotes()
      if (res.data) setNotes(res.data.notes)
      else setError(res.error ?? 'Failed to load notes')
    } catch {
      setError('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    try {
      const res = await api.portalCreateNote({ content: content.trim(), category })
      if (res.data) {
        setNotes(prev => [res.data!.note, ...prev])
        setContent('')
        setCategory('general')
      } else {
        setError(res.error ?? 'Failed to save note')
      }
    } catch {
      setError('Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.portalDeleteNote(id)
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch {
      setError('Failed to delete note')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-secondary-dark p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">My Notes</h1>
        <p className="text-gray-500 mt-2">
          Log what you're working on, questions you have, or documents you've gathered. Your accountant can see these notes.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Add Note Form */}
      <div className="bg-white rounded-2xl border border-secondary-dark p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Add a Note</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. I've uploaded my W-2 from Employer A. Still waiting on 1099 from my side job."
              className="w-full rounded-xl border border-secondary-dark px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <div className="text-xs text-gray-400 text-right mt-1">{content.length}/2000</div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Type:</span>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                    category === cat.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-secondary-dark text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={saving || !content.trim()}
              className="ml-auto px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {saving ? 'Saving...' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>

      {/* Notes List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 px-1">Your Notes</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : notes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-secondary-dark p-8 text-center text-gray-400">
            <p className="text-sm">No notes yet. Add your first note above.</p>
          </div>
        ) : (
          notes.map(note => (
            <div
              key={note.id}
              className="bg-white rounded-xl border border-secondary-dark p-4 sm:p-5 flex gap-4 group"
            >
              {/* Bullet indicator */}
              <div className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CategoryBadge category={note.category} />
                    <span className="text-xs text-gray-400">{formatDate(note.created_at)}</span>
                  </div>

                  {deleteId === note.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">Delete?</span>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeleteId(null)}
                        className="text-xs text-gray-400 hover:underline"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteId(note.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0 text-xs"
                      title="Delete note"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap break-words">{note.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
