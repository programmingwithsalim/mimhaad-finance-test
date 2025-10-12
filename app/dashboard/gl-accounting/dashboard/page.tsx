// Add the GLSyncStatus component to the imports
import { GLSyncStatus } from "@/components/gl-accounting/gl-sync-status"

// Add the GLSyncStatus component to the dashboard layout
export default function GLDashboard() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">GL Accounting Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Add the GLSyncStatus component here */}
        <GLSyncStatus />

        {/* Other dashboard components */}
        {/* ... */}
      </div>

      {/* Rest of the dashboard */}
      {/* ... */}
    </div>
  )
}
