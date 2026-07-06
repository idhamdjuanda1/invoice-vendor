import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-app-border pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-gold">Invoice Vendor</p>
        <h1 className="mt-2 text-2xl font-bold text-app-text md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{description}</p>
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap [&>a]:w-full [&>a]:sm:w-auto [&_button]:w-full [&_button]:sm:w-auto">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
