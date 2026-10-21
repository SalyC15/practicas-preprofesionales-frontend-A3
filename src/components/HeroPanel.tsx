import type { ReactNode } from 'react'

interface HeroPanelProps {
  title: ReactNode
  description: ReactNode
  /** Bloque de la derecha: atajos o datos de contexto. */
  aside?: ReactNode
  children?: ReactNode
}

/** Panel destacado ejecutivo: fondo oscuro profundo con texto blanco nítido y alto contraste. */
export function HeroPanel({ title, description, aside, children }: HeroPanelProps) {
  return (
    <section className="relative overflow-hidden flex flex-wrap items-center justify-between gap-x-8 gap-y-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 px-7 py-6.5 text-white shadow-md border border-slate-800">
      {/* Luz ambiental sutil de fondo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-blue-500/10 blur-3xl"
      />
      <div className="relative z-10 min-w-[280px] flex-1">
        <h2 className="font-display text-22 font-bold tracking-[-0.01em] text-white">{title}</h2>
        <p className="mt-1.5 max-w-[540px] text-14 leading-relaxed text-slate-300">{description}</p>
        {children ? <div className="mt-4 max-w-[560px]">{children}</div> : null}
      </div>
      {aside ? <div className="relative z-10 flex flex-wrap gap-2.5">{aside}</div> : null}
    </section>
  )
}

/** Pastilla traslúcida con dato de contexto de alto contraste. */
export function HeroCard({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="w-[190px] rounded-xl bg-white/10 backdrop-blur-md border border-white/15 px-4 py-3.5 text-white shadow-sm">
      <div className="text-12 font-medium text-slate-300">{label}</div>
      <div className="mt-1.5 font-display text-15 font-semibold leading-snug text-white">
        {children}
      </div>
    </div>
  )
}
