import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface BankDetailsProps {
  bank: {
    id: string
    name: string
    code: string
    logo?: string
    interestRate: number
    transferFee: number
    minFee: number
    maxFee: number
    status: "active" | "inactive" | "maintenance"
  }
}

export function BankDetailsCard({ bank }: BankDetailsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{bank.name}</CardTitle>
            <CardDescription>Partner Bank Details</CardDescription>
          </div>
          <Badge variant={bank.status === "active" ? "outline" : "destructive"}>
            {bank.status === "active" ? "Active" : bank.status === "maintenance" ? "Maintenance" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Bank Code:</span>
            <span className="font-medium">{bank.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Interest Rate:</span>
            <span className="font-medium">{(bank.interestRate * 100).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Transfer Fee:</span>
            <span className="font-medium">{(bank.transferFee * 100).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Min/Max Fee:</span>
            <span className="font-medium">
              GHS {bank.minFee.toFixed(2)} - GHS {bank.maxFee.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
