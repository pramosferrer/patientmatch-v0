import { ReactNode } from 'react'

export default function FeatureCard({ icon, title, children }:{
  icon: ReactNode; title: string; children: ReactNode
}) {
  return (
    <div className="pm-card p-6">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-pm-sky/50 text-pm-accent">
        {icon}
      </div>
      <h3 className="font-heading mt-5 text-pm-ink font-semibold text-lg">{title}</h3>
      <p className="mt-3 text-pm-body text-[15px] leading-relaxed">{children}</p>
    </div>
  )
}
