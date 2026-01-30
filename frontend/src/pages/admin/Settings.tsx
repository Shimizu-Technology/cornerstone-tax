import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

// Define types locally to avoid Vite import caching issues
interface AdminWorkflowStageLocal {
  id: number
  name: string
  slug: string
  position: number
  color: string | null
  notify_client: boolean
  is_active: boolean
  tax_returns_count: number
  created_at: string
  updated_at: string
}

interface AdminTimeCategoryLocal {
  id: number
  name: string
  description: string | null
  is_active: boolean
  time_entries_count: number
  created_at: string
  updated_at: string
}

interface ScheduleTimePresetLocal {
  id: number
  label: string
  start_time: string
  end_time: string
  formatted_start_time: string
  formatted_end_time: string
  position: number
  active: boolean
}

export default function Settings() {
  useEffect(() => { document.title = 'Settings | Cornerstone Admin' }, [])

  // Active tab
  const [activeTab, setActiveTab] = useState<'workflow' | 'time' | 'schedule' | 'system'>('workflow')
  
  // System Settings state
  const [_systemSettings, setSystemSettings] = useState<Record<string, string>>({})
  const [loadingSystemSettings, setLoadingSystemSettings] = useState(true)
  const [contactEmail, setContactEmail] = useState('')
  const [savingSystemSettings, setSavingSystemSettings] = useState(false)
  const [systemSettingsSuccess, setSystemSettingsSuccess] = useState('')
  const [systemSettingsError, setSystemSettingsError] = useState('')
  
  // Workflow Stages state
  const [stages, setStages] = useState<AdminWorkflowStageLocal[]>([])
  const [loadingStages, setLoadingStages] = useState(true)
  const [editingStage, setEditingStage] = useState<AdminWorkflowStageLocal | null>(null)
  const [isAddingNewStage, setIsAddingNewStage] = useState(false)
  const [stageFormData, setStageFormData] = useState({
    name: '',
    slug: '',
    color: 'blue',
    notify_client: false,
  })
  const [savingStage, setSavingStage] = useState(false)
  const [stageError, setStageError] = useState('')
  
  // Time Categories state
  const [categories, setCategories] = useState<AdminTimeCategoryLocal[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [editingCategory, setEditingCategory] = useState<AdminTimeCategoryLocal | null>(null)
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false)
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
  })
  const [savingCategory, setSavingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState('')

  // Schedule Time Presets state
  const [presets, setPresets] = useState<ScheduleTimePresetLocal[]>([])
  const [loadingPresets, setLoadingPresets] = useState(true)
  const [editingPreset, setEditingPreset] = useState<ScheduleTimePresetLocal | null>(null)
  const [isAddingNewPreset, setIsAddingNewPreset] = useState(false)
  const [presetFormData, setPresetFormData] = useState({
    label: '',
    start_time: '08:00',
    end_time: '17:00',
  })
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetError, setPresetError] = useState('')

  const colorOptions = [
    { value: 'blue', label: 'Blue', hex: '#3B82F6' },
    { value: 'yellow', label: 'Yellow', hex: '#F59E0B' },
    { value: 'orange', label: 'Orange', hex: '#F97316' },
    { value: 'purple', label: 'Purple', hex: '#8B5CF6' },
    { value: 'pink', label: 'Pink', hex: '#EC4899' },
    { value: 'indigo', label: 'Indigo', hex: '#6366F1' },
    { value: 'teal', label: 'Teal', hex: '#14B8A6' },
    { value: 'green', label: 'Green', hex: '#22C55E' },
  ]

  useEffect(() => {
    fetchStages()
    fetchCategories()
    fetchPresets()
    fetchSystemSettings()
  }, [])

  const fetchSystemSettings = async () => {
    setLoadingSystemSettings(true)
    const response = await api.getSystemSettings()
    if (response.data) {
      setSystemSettings(response.data)
      setContactEmail(response.data.contact_email || 'dmshimizucpa@gmail.com')
    }
    setLoadingSystemSettings(false)
  }

  const handleSaveSystemSettings = async () => {
    setSavingSystemSettings(true)
    setSystemSettingsSuccess('')
    setSystemSettingsError('')
    
    const response = await api.updateSystemSettings({
      contact_email: contactEmail,
    })
    
    if (response.error) {
      setSystemSettingsError(response.error)
    } else if (response.data) {
      setSystemSettings(response.data)
      setSystemSettingsSuccess('Settings saved successfully!')
      setTimeout(() => setSystemSettingsSuccess(''), 3000)
    }
    
    setSavingSystemSettings(false)
  }

  const fetchStages = async () => {
    setLoadingStages(true)
    const response = await api.getAdminWorkflowStages()
    if (response.data) {
      setStages(response.data.workflow_stages)
    }
    setLoadingStages(false)
  }
  
  const fetchCategories = async () => {
    setLoadingCategories(true)
    const response = await api.getAdminTimeCategories()
    if (response.data) {
      setCategories(response.data.time_categories as unknown as AdminTimeCategoryLocal[])
    }
    setLoadingCategories(false)
  }

  const fetchPresets = async () => {
    setLoadingPresets(true)
    const response = await api.getAdminScheduleTimePresets()
    if (response.data) {
      setPresets(response.data.presets as unknown as ScheduleTimePresetLocal[])
    }
    setLoadingPresets(false)
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  }

  // Workflow Stage handlers
  const handleStageNameChange = (name: string) => {
    setStageFormData(prev => ({
      ...prev,
      name,
      slug: editingStage ? prev.slug : generateSlug(name),
    }))
  }

  const handleSaveStage = async () => {
    if (!stageFormData.name.trim()) {
      setStageError('Name is required')
      return
    }

    setSavingStage(true)
    setStageError('')

    try {
      if (editingStage) {
        const response = await api.updateWorkflowStage(editingStage.id, stageFormData)
        if (response.data) {
          setStages(prev => prev.map(s => s.id === editingStage.id ? response.data!.workflow_stage : s))
          setEditingStage(null)
        } else if (response.error) {
          setStageError(response.error)
        }
      } else {
        const response = await api.createWorkflowStage(stageFormData)
        if (response.data) {
          setStages(prev => [...prev, response.data!.workflow_stage])
          setIsAddingNewStage(false)
          setStageFormData({ name: '', slug: '', color: 'blue', notify_client: false })
        } else if (response.error) {
          setStageError(response.error)
        }
      }
    } finally {
      setSavingStage(false)
    }
  }

  const handleDeleteStage = async (stage: AdminWorkflowStageLocal) => {
    if (stage.tax_returns_count > 0) {
      alert(`Cannot delete "${stage.name}" because it has ${stage.tax_returns_count} tax return(s) associated with it.`)
      return
    }

    if (!confirm(`Are you sure you want to deactivate "${stage.name}"?`)) {
      return
    }

    const response = await api.deleteWorkflowStage(stage.id)
    if (response.data) {
      setStages(prev => prev.filter(s => s.id !== stage.id))
    }
  }

  const handleReactivateStage = async (stage: AdminWorkflowStageLocal) => {
    const response = await api.updateWorkflowStage(stage.id, { is_active: true })
    if (response.data) {
      setStages(prev => prev.map(s => s.id === stage.id ? response.data!.workflow_stage : s))
    }
  }

  const startEditStage = (stage: AdminWorkflowStageLocal) => {
    setEditingStage(stage)
    setStageFormData({
      name: stage.name,
      slug: stage.slug,
      color: stage.color || 'blue',
      notify_client: stage.notify_client,
    })
    setIsAddingNewStage(false)
  }

  const cancelEditStage = () => {
    setEditingStage(null)
    setIsAddingNewStage(false)
    setStageFormData({ name: '', slug: '', color: 'blue', notify_client: false })
    setStageError('')
  }
  
  // Time Category handlers
  const handleSaveCategory = async () => {
    if (!categoryFormData.name.trim()) {
      setCategoryError('Name is required')
      return
    }

    setSavingCategory(true)
    setCategoryError('')

    try {
      if (editingCategory) {
        const response = await api.updateTimeCategory(editingCategory.id, categoryFormData)
        if (response.data) {
          setCategories(prev => prev.map(c => c.id === editingCategory.id ? response.data!.time_category as unknown as AdminTimeCategoryLocal : c))
          setEditingCategory(null)
        } else if (response.error) {
          setCategoryError(response.error)
        }
      } else {
        const response = await api.createTimeCategory(categoryFormData)
        if (response.data) {
          setCategories(prev => [...prev, response.data!.time_category as unknown as AdminTimeCategoryLocal])
          setIsAddingNewCategory(false)
          setCategoryFormData({ name: '', description: '' })
        } else if (response.error) {
          setCategoryError(response.error)
        }
      }
    } finally {
      setSavingCategory(false)
    }
  }

  const handleDeleteCategory = async (category: AdminTimeCategoryLocal) => {
    if (category.time_entries_count > 0) {
      if (!confirm(`"${category.name}" has ${category.time_entries_count} time entries. Deleting will deactivate it but keep the entries. Continue?`)) {
        return
      }
    } else {
      if (!confirm(`Are you sure you want to deactivate "${category.name}"?`)) {
        return
      }
    }

    const response = await api.deleteTimeCategory(category.id)
    if (!response.error) {
      setCategories(prev => prev.map(c => c.id === category.id ? { ...c, is_active: false } : c))
    }
  }

  const handleReactivateCategory = async (category: AdminTimeCategoryLocal) => {
    const response = await api.updateTimeCategory(category.id, { is_active: true })
    if (response.data) {
      setCategories(prev => prev.map(c => c.id === category.id ? response.data!.time_category as unknown as AdminTimeCategoryLocal : c))
    }
  }

  const startEditCategory = (category: AdminTimeCategoryLocal) => {
    setEditingCategory(category)
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
    })
    setIsAddingNewCategory(false)
  }

  const cancelEditCategory = () => {
    setEditingCategory(null)
    setIsAddingNewCategory(false)
    setCategoryFormData({ name: '', description: '' })
    setCategoryError('')
  }

  // Schedule Time Preset handlers
  const handleSavePreset = async () => {
    if (!presetFormData.label.trim()) {
      setPresetError('Label is required')
      return
    }

    setSavingPreset(true)
    setPresetError('')

    try {
      if (editingPreset) {
        const response = await api.updateScheduleTimePreset(editingPreset.id, presetFormData)
        if (response.data) {
          setPresets(prev => prev.map(p => p.id === editingPreset.id ? response.data!.preset as unknown as ScheduleTimePresetLocal : p))
          setEditingPreset(null)
        } else if (response.error) {
          setPresetError(response.error)
        }
      } else {
        const response = await api.createScheduleTimePreset(presetFormData)
        if (response.data) {
          setPresets(prev => [...prev, response.data!.preset as unknown as ScheduleTimePresetLocal])
          setIsAddingNewPreset(false)
          setPresetFormData({ label: '', start_time: '08:00', end_time: '17:00' })
        } else if (response.error) {
          setPresetError(response.error)
        }
      }
    } finally {
      setSavingPreset(false)
    }
  }

  const handleDeletePreset = async (preset: ScheduleTimePresetLocal) => {
    if (!confirm(`Are you sure you want to delete "${preset.label}"?`)) {
      return
    }

    const response = await api.deleteScheduleTimePreset(preset.id)
    if (!response.error) {
      setPresets(prev => prev.filter(p => p.id !== preset.id))
    }
  }

  const startEditPreset = (preset: ScheduleTimePresetLocal) => {
    setEditingPreset(preset)
    setPresetFormData({
      label: preset.label,
      start_time: preset.start_time,
      end_time: preset.end_time,
    })
    setIsAddingNewPreset(false)
  }

  const cancelEditPreset = () => {
    setEditingPreset(null)
    setIsAddingNewPreset(false)
    setPresetFormData({ label: '', start_time: '08:00', end_time: '17:00' })
    setPresetError('')
  }

  const getColorHex = (color: string | null) => {
    const colorOption = colorOptions.find(c => c.value === color) || colorOptions[0]
    return colorOption.hex
  }

  const activeStages = stages.filter(s => s.is_active).sort((a, b) => a.position - b.position)
  const inactiveStages = stages.filter(s => !s.is_active)
  const activeCategories = categories.filter(c => c.is_active)
  const inactiveCategories = categories.filter(c => !c.is_active)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark">Settings</h1>
        <p className="text-text-muted mt-1">Manage workflow stages, time categories, and system settings</p>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-neutral-warm">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'workflow'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-primary-dark'
            }`}
          >
            Workflow Stages
          </button>
          <button
            onClick={() => setActiveTab('time')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'time'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-primary-dark'
            }`}
          >
            Time Categories
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'schedule'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-primary-dark'
            }`}
          >
            Schedule Presets
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'system'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-primary-dark'
            }`}
          >
            System
          </button>
        </nav>
      </div>

      {/* Workflow Stages Tab */}
      {activeTab === 'workflow' && (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-warm overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-warm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-primary-dark">Workflow Stages</h2>
            <p className="text-sm text-text-muted mt-0.5">Configure the stages tax returns move through</p>
          </div>
          {!isAddingNewStage && !editingStage && (
            <button
              onClick={() => setIsAddingNewStage(true)}
              className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-dark transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Stage
            </button>
          )}
        </div>

        {loadingStages ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : (
          <div className="divide-y divide-neutral-warm">
            {/* Add New Form */}
            {isAddingNewStage && (
              <div className="p-6 bg-neutral-warm/30">
                <h3 className="font-semibold text-primary-dark mb-4">Add New Stage</h3>
                <StageForm
                  formData={stageFormData}
                  colorOptions={colorOptions}
                  onNameChange={handleStageNameChange}
                  onFormChange={(key, value) => setStageFormData(prev => ({ ...prev, [key]: value }))}
                  onSave={handleSaveStage}
                  onCancel={cancelEditStage}
                  saving={savingStage}
                  error={stageError}
                />
              </div>
            )}

            {/* Active Stages */}
            {activeStages.map((stage, index) => (
              <div key={stage.id} className="p-5 sm:p-6 hover:bg-neutral-warm/20 transition-colors">
                {editingStage?.id === stage.id ? (
                  <StageForm
                    formData={stageFormData}
                    colorOptions={colorOptions}
                    onNameChange={handleStageNameChange}
                    onFormChange={(key, value) => setStageFormData(prev => ({ ...prev, [key]: value }))}
                    onSave={handleSaveStage}
                    onCancel={cancelEditStage}
                    saving={savingStage}
                    error={stageError}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-neutral-warm flex items-center justify-center flex-shrink-0">
                        <span className="text-text-muted font-semibold text-sm">{index + 1}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-primary-dark">{stage.name}</span>
                          <span 
                            className="text-xs px-2.5 py-1 rounded-lg text-white font-medium shadow-sm"
                            style={{ backgroundColor: getColorHex(stage.color) }}
                          >
                            {stage.color || 'default'}
                          </span>
                          {stage.notify_client && (
                            <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 font-medium">
                              Notifies Client
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-text-muted mt-1">
                          {stage.tax_returns_count} return{stage.tax_returns_count !== 1 ? 's' : ''} • <code className="text-xs bg-neutral-warm px-1.5 py-0.5 rounded">{stage.slug}</code>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEditStage(stage)}
                        className="text-sm text-text-muted hover:text-primary px-3 py-2 rounded-lg hover:bg-neutral-warm transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteStage(stage)}
                        className="text-sm text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Inactive Stages */}
            {inactiveStages.length > 0 && (
              <>
                <div className="px-6 py-3 bg-neutral-warm/50">
                  <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">Inactive Stages</h3>
                </div>
                {inactiveStages.map((stage) => (
                  <div key={stage.id} className="p-5 sm:p-6 bg-neutral-warm/20">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0 opacity-60">
                        <div className="w-8 h-8 rounded-lg bg-neutral-warm flex items-center justify-center flex-shrink-0">
                          <span className="text-text-muted/50 text-sm">—</span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-primary-dark">{stage.name}</span>
                          <p className="text-sm text-text-muted mt-0.5">
                            {stage.tax_returns_count} return{stage.tax_returns_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleReactivateStage(stage)}
                        className="text-sm text-primary hover:text-primary-dark px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors font-medium"
                      >
                        Reactivate
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {activeStages.length === 0 && !isAddingNewStage && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-neutral-warm rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-text-muted mb-4">No workflow stages configured</p>
                <button
                  onClick={() => setIsAddingNewStage(true)}
                  className="text-primary hover:text-primary-dark font-medium"
                >
                  Add your first stage →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Time Categories Tab */}
      {activeTab === 'time' && (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-warm overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-warm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-primary-dark">Time Categories</h2>
            <p className="text-sm text-text-muted mt-0.5">Configure categories for time tracking</p>
          </div>
          {!isAddingNewCategory && !editingCategory && (
            <button
              onClick={() => setIsAddingNewCategory(true)}
              className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-dark transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Category
            </button>
          )}
        </div>

        {loadingCategories ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : (
          <div className="divide-y divide-neutral-warm">
            {/* Add New Category Form */}
            {isAddingNewCategory && (
              <div className="p-6 bg-neutral-warm/30">
                <h3 className="font-semibold text-primary-dark mb-4">Add New Category</h3>
                <CategoryForm
                  formData={categoryFormData}
                  onFormChange={(key, value) => setCategoryFormData(prev => ({ ...prev, [key]: value }))}
                  onSave={handleSaveCategory}
                  onCancel={cancelEditCategory}
                  saving={savingCategory}
                  error={categoryError}
                />
              </div>
            )}

            {/* Active Categories */}
            {activeCategories.map((category) => (
              <div key={category.id} className="p-5 sm:p-6 hover:bg-neutral-warm/20 transition-colors">
                {editingCategory?.id === category.id ? (
                  <CategoryForm
                    formData={categoryFormData}
                    onFormChange={(key, value) => setCategoryFormData(prev => ({ ...prev, [key]: value }))}
                    onSave={handleSaveCategory}
                    onCancel={cancelEditCategory}
                    saving={savingCategory}
                    error={categoryError}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-primary-dark">{category.name}</span>
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                          {category.time_entries_count} entries
                        </span>
                      </div>
                      {category.description && (
                        <p className="text-sm text-text-muted mt-1">{category.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEditCategory(category)}
                        className="text-sm text-text-muted hover:text-primary px-3 py-2 rounded-lg hover:bg-neutral-warm transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        className="text-sm text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Inactive Categories */}
            {inactiveCategories.length > 0 && (
              <>
                <div className="px-6 py-3 bg-neutral-warm/50">
                  <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">Inactive Categories</h3>
                </div>
                {inactiveCategories.map((category) => (
                  <div key={category.id} className="p-5 sm:p-6 bg-neutral-warm/20">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 opacity-60">
                        <span className="font-medium text-primary-dark">{category.name}</span>
                        <p className="text-sm text-text-muted mt-0.5">
                          {category.time_entries_count} entries
                        </p>
                      </div>
                      <button
                        onClick={() => handleReactivateCategory(category)}
                        className="text-sm text-primary hover:text-primary-dark px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors font-medium"
                      >
                        Reactivate
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {activeCategories.length === 0 && !isAddingNewCategory && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-neutral-warm rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-text-muted mb-4">No time categories configured</p>
                <button
                  onClick={() => setIsAddingNewCategory(true)}
                  className="text-primary hover:text-primary-dark font-medium"
                >
                  Add your first category →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Schedule Time Presets Tab */}
      {activeTab === 'schedule' && (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-warm overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-warm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-primary-dark">Schedule Time Presets</h2>
            <p className="text-sm text-text-muted mt-0.5">Quick time options for the employee schedule form</p>
          </div>
          {!isAddingNewPreset && !editingPreset && (
            <button
              onClick={() => setIsAddingNewPreset(true)}
              className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-dark transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Preset
            </button>
          )}
        </div>

        {loadingPresets ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : (
          <div className="divide-y divide-neutral-warm">
            {/* Add New Form */}
            {isAddingNewPreset && (
              <div className="p-6 bg-neutral-warm/30">
                <h3 className="font-semibold text-primary-dark mb-4">Add New Preset</h3>
                <PresetForm
                  formData={presetFormData}
                  onChange={setPresetFormData}
                  onSave={handleSavePreset}
                  onCancel={cancelEditPreset}
                  saving={savingPreset}
                  error={presetError}
                />
              </div>
            )}

            {/* Existing Presets */}
            {presets.length === 0 && !isAddingNewPreset ? (
              <div className="p-12 text-center">
                <p className="text-text-muted">No presets configured. Add your first preset above.</p>
              </div>
            ) : (
              presets.map(preset => (
                <div key={preset.id} className="p-6">
                  {editingPreset?.id === preset.id ? (
                    <div>
                      <h3 className="font-semibold text-primary-dark mb-4">Edit Preset</h3>
                      <PresetForm
                        formData={presetFormData}
                        onChange={setPresetFormData}
                        onSave={handleSavePreset}
                        onCancel={cancelEditPreset}
                        saving={savingPreset}
                        error={presetError}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-primary-dark">{preset.label}</p>
                          <p className="text-sm text-text-muted">
                            {preset.formatted_start_time} → {preset.formatted_end_time}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditPreset(preset)}
                          className="p-2 text-text-muted hover:text-primary hover:bg-neutral-warm rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset)}
                          className="p-2 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      )}

      {/* System Settings Tab */}
      {activeTab === 'system' && (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-warm overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-warm">
          <h2 className="text-lg font-semibold text-primary-dark">System Settings</h2>
          <p className="text-sm text-text-muted mt-0.5">Configure general system settings</p>
        </div>

        <div className="p-6 space-y-6">
          {loadingSystemSettings ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-primary" fill="none" aria-hidden="true" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <>
              {systemSettingsSuccess && (
                <div className="bg-green-50 text-green-600 p-4 rounded-xl text-sm border border-green-100">
                  {systemSettingsSuccess}
                </div>
              )}
              
              {systemSettingsError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
                  {systemSettingsError}
                </div>
              )}

              <div className="space-y-6">
                {/* Contact Email Setting */}
                <div className="bg-secondary/30 rounded-xl p-6">
                  <h3 className="font-semibold text-primary-dark mb-2">Contact Form Email</h3>
                  <p className="text-sm text-text-muted mb-4">
                    Email address where contact form submissions will be sent.
                  </p>
                  <input
                    type="email"
                    value={contactEmail}
                    aria-label="Contact email address"
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="dmshimizucpa@gmail.com"
                    className="w-full max-w-md px-4 py-2.5 border border-neutral-warm rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-neutral-warm">
                <button
                  onClick={handleSaveSystemSettings}
                  disabled={savingSystemSettings}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-all shadow-md"
                >
                  {savingSystemSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

// Stage Form Component
interface StageFormProps {
  formData: {
    name: string
    slug: string
    color: string
    notify_client: boolean
  }
  colorOptions: Array<{ value: string; label: string; hex: string }>
  onNameChange: (name: string) => void
  onFormChange: (key: string, value: string | boolean) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string
}

function StageForm({ formData, colorOptions, onNameChange, onFormChange, onSave, onCancel, saving, error }: StageFormProps) {
  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-2">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g., In Review"
            className="w-full px-4 py-2.5 border border-neutral-warm rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-2">Slug</label>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => onFormChange('slug', e.target.value)}
            placeholder="e.g., in_review"
            className="w-full px-4 py-2.5 border border-neutral-warm rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-2">Badge Color</label>
          <div className="flex flex-wrap gap-2">
            {colorOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onFormChange('color', opt.value)}
                className={`w-8 h-8 rounded-lg shadow-sm transition-all ${
                  formData.color === opt.value ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: opt.hex }}
                title={opt.label}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notify_client}
              onChange={(e) => onFormChange('notify_client', e.target.checked)}
              className="w-5 h-5 text-primary border-neutral-warm rounded focus:ring-primary"
            />
            <span className="text-sm text-text-muted">Notify client when status changes to this stage</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-text-muted hover:bg-neutral-warm rounded-xl text-sm font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-all shadow-md"
        >
          {saving ? 'Saving...' : 'Save Stage'}
        </button>
      </div>
    </div>
  )
}

// Category Form Component
interface CategoryFormProps {
  formData: {
    name: string
    description: string
  }
  onFormChange: (key: string, value: string) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string
}

function CategoryForm({ formData, onFormChange, onSave, onCancel, saving, error }: CategoryFormProps) {
  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-2">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onFormChange('name', e.target.value)}
            placeholder="e.g., Tax Preparation"
            className="w-full px-4 py-2.5 border border-neutral-warm rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-2">Description</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => onFormChange('description', e.target.value)}
            placeholder="e.g., Time spent preparing tax returns"
            className="w-full px-4 py-2.5 border border-neutral-warm rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-text-muted hover:bg-neutral-warm rounded-xl text-sm font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-all shadow-md"
        >
          {saving ? 'Saving...' : 'Save Category'}
        </button>
      </div>
    </div>
  )
}

// Preset Form Component
interface PresetFormProps {
  formData: { label: string; start_time: string; end_time: string }
  onChange: (data: { label: string; start_time: string; end_time: string }) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string
}

function PresetForm({ formData, onChange, onSave, onCancel, saving, error }: PresetFormProps) {
  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="preset-label" className="block text-sm font-medium text-primary-dark mb-2">
            Label <span className="text-red-500">*</span>
          </label>
          <input
            id="preset-label"
            type="text"
            value={formData.label}
            onChange={(e) => onChange({ ...formData, label: e.target.value })}
            placeholder="e.g., 8-5"
            className="w-full px-4 py-2.5 border border-neutral-warm rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          />
        </div>

        <div>
          <label htmlFor="preset-start-time" className="block text-sm font-medium text-primary-dark mb-2">
            Start Time <span className="text-red-500">*</span>
          </label>
          <input
            id="preset-start-time"
            type="time"
            value={formData.start_time}
            onChange={(e) => onChange({ ...formData, start_time: e.target.value })}
            className="w-full px-4 py-2.5 border border-neutral-warm rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          />
        </div>

        <div>
          <label htmlFor="preset-end-time" className="block text-sm font-medium text-primary-dark mb-2">
            End Time <span className="text-red-500">*</span>
          </label>
          <input
            id="preset-end-time"
            type="time"
            value={formData.end_time}
            onChange={(e) => onChange({ ...formData, end_time: e.target.value })}
            className="w-full px-4 py-2.5 border border-neutral-warm rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-text-muted hover:bg-neutral-warm rounded-xl text-sm font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-all shadow-md"
        >
          {saving ? 'Saving...' : 'Save Preset'}
        </button>
      </div>
    </div>
  )
}
