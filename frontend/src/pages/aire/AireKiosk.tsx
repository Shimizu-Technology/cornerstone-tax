import { useMemo, useState } from 'react'

type WorkCategory = 'flight' | 'ground' | 'admin'

const categories: Array<{ key: WorkCategory; label: string; rate: string }> = [
  { key: 'flight', label: 'Flight Time', rate: '$30/hr' },
  { key: 'ground', label: 'Ground Teaching', rate: '$30/hr' },
  { key: 'admin', label: 'Admin Office', rate: '$10/hr' },
]

const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'CLR']

export default function AireKiosk() {
  const [pin, setPin] = useState('')
  const [category, setCategory] = useState<WorkCategory>('flight')

  const maskedPin = useMemo(() => (pin.length ? '•'.repeat(pin.length) : '----'), [pin])

  const press = (key: string) => {
    if (key === 'CLR') return setPin('')
    if (key === '⌫') return setPin((v) => v.slice(0, -1))
    if (pin.length >= 6) return
    setPin((v) => v + key)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-4 py-8 md:grid-cols-[1.15fr_1fr] md:px-6">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-cyan-300">Aire Staff Kiosk</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Clock in and out quickly</h1>
          <p className="mt-3 max-w-xl text-sm text-slate-300 md:text-base">
            Enter your staff PIN, choose your work type, then clock in or clock out.
          </p>

          <div className="mt-8 space-y-3">
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                  category === c.key
                    ? 'border-cyan-300 bg-cyan-400/15 text-white'
                    : 'border-slate-700 bg-slate-900/40 text-slate-200 hover:border-slate-500'
                }`}
              >
                <span className="font-medium">{c.label}</span>
                <span className="text-sm font-semibold text-cyan-200">{c.rate}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button className="rounded-2xl bg-emerald-500 px-5 py-3.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400">
              Clock In
            </button>
            <button className="rounded-2xl bg-amber-400 px-5 py-3.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-300">
              Clock Out
            </button>
            <button className="rounded-2xl bg-indigo-400 px-5 py-3.5 text-sm font-semibold text-indigo-950 transition hover:bg-indigo-300">
              Start Break
            </button>
            <button className="rounded-2xl bg-fuchsia-400 px-5 py-3.5 text-sm font-semibold text-fuchsia-950 transition hover:bg-fuchsia-300">
              End Break
            </button>
          </div>

          <p className="mt-6 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-xs text-slate-300">
            v1 scaffold: UI and rate categories are wired. Next pass connects PIN auth + clock actions to backend endpoints.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-cyan-300">Enter PIN</p>
          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-center text-4xl tracking-[0.35em] text-cyan-200">
            {maskedPin}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {keypad.map((key) => (
              <button
                key={key}
                onClick={() => press(key)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-4 text-lg font-semibold text-slate-100 transition hover:border-cyan-300 hover:bg-cyan-500/10"
              >
                {key}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
