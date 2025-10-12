import type { Metadata } from "next"
import { TransactionSourcesMapping } from "@/components/gl-accounting/transaction-sources-mapping"
import { TransactionSourceIntegration } from "@/components/gl-accounting/transaction-source-integration"

export const metadata: Metadata = {
  title: "GL Integration",
  description: "GL Integration with Transaction Sources",
}

export default function GLIntegrationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">GL Integration</h2>
        <p className="text-muted-foreground">
          Configure and monitor the integration between transaction sources and the GL accounting system
        </p>
      </div>

      <div className="space-y-6">
        <TransactionSourceIntegration />
        <TransactionSourcesMapping />
      </div>
    </div>
  )
}
