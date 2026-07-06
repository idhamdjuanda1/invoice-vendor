import type { ReactNode } from 'react'
import { Card, CardContent } from './Card'

type StatCardProps = {
  label: string
  value: string
  helper: string
  icon?: ReactNode
}

export function StatCard({ label, value, helper, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-neutral-500">{label}</p>
          <p className="mt-2 break-words text-xl font-bold text-app-text sm:text-2xl">{value}</p>
          <p className="mt-1 break-words text-xs text-neutral-500">{helper}</p>
        </div>
        {icon ? <div className="shrink-0 rounded-md bg-app-gold-soft p-2 text-app-text">{icon}</div> : null}
      </CardContent>
    </Card>
  )
}
