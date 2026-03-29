const programs = [
  {
    name: 'Private Pilot Certificate',
    details:
      'The foundational certificate for future pilot training, focused on safety, confidence, and practical flight proficiency.',
  },
  {
    name: 'Discovery Flight',
    details: 'A first-hand introductory flight experience with an instructor to explore aviation in Guam.',
  },
  {
    name: 'Aircraft Rental',
    details: 'Rental options for current pilots, with currency and qualification requirements managed by the Aire team.',
  },
]

export default function AirePrograms() {
  return (
    <div className="bg-white py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">Aire Programs</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Training and flight services</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600 md:text-base">
          This page is the AIRE v1 scaffold inside the Cornerstone Tax base app. Next pass will migrate complete content,
          pricing blocks, FAQs, and media assets from the existing Aire Services site.
        </p>

        <div className="mt-8 space-y-4">
          {programs.map((program) => (
            <article key={program.name} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">{program.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{program.details}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
