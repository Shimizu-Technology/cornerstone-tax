import { Link } from 'react-router-dom'

const programs = [
  {
    title: 'Private Pilot Certificate',
    description: 'Build your core flight skills with structured one-on-one instruction.',
    href: '/aire/programs',
  },
  {
    title: 'Discovery Flight',
    description: 'Take the controls and experience Guam from the air with an instructor.',
    href: '/aire/programs',
  },
  {
    title: 'Aircraft Rental',
    description: 'Flexible aircraft rental options for current and qualified pilots.',
    href: '/aire/programs',
  },
]

export default function AireHome() {
  return (
    <div className="bg-white text-slate-900">
      <section className="relative overflow-hidden bg-slate-900 py-20 text-white md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.35),transparent_45%)]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
            Aire Services Guam
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Flight training and operations, built for Guam.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 md:text-lg">
            Learn to fly, train with experienced instructors, and build your aviation future with a local team committed to safe,
            practical, and professional instruction.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/aire/programs"
              className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300"
            >
              Explore Programs
            </Link>
            <Link
              to="/aire/contact"
              className="rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Contact Aire
            </Link>
            <Link
              to="/aire/kiosk"
              className="rounded-xl border border-cyan-300/70 px-6 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/10"
            >
              Staff Kiosk
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">Training Programs</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Start your aviation journey</h2>
            </div>
            <Link to="/aire/programs" className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">
              View all programs →
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {programs.map((program) => (
              <Link
                key={program.title}
                to={program.href}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50/40"
              >
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">{program.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{program.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
