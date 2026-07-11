import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '../../lib/formatters/currency'

export type CashFlowChartPoint = {
  month: string
  income: number
  expense: number
}

type CashFlowChartProps = {
  data: CashFlowChartPoint[]
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  return (
    <ResponsiveContainer height="100%" width="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
        <Bar dataKey="income" fill="#16a34a" name="Pemasukan" />
        <Bar dataKey="expense" fill="#dc2626" name="Pengeluaran" />
      </BarChart>
    </ResponsiveContainer>
  )
}
