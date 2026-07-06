import { Card } from './Card'

type PlaceholderTableProps = {
  columns: string[]
  rows?: number
}

export function PlaceholderTable({ columns, rows = 4 }: PlaceholderTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-app-muted text-xs uppercase text-neutral-500">
            <tr>
              {columns.map((column) => (
                <th className="border-b border-app-border px-4 py-3 font-semibold" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr className="border-b border-app-border last:border-0" key={rowIndex}>
                {columns.map((column, columnIndex) => (
                  <td className="px-4 py-4" key={`${column}-${columnIndex}`}>
                    <div className="h-3 w-full max-w-32 rounded bg-neutral-200" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
