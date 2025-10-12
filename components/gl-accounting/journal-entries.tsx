import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SchemaViewer } from "./schema-viewer"

export function JournalEntries() {
  return (
    <Tabs defaultValue="transaction" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="transaction">Transaction History</TabsTrigger>
        <TabsTrigger value="schema">Database Schema</TabsTrigger>
      </TabsList>
      <TabsContent value="transaction" className="space-y-4">
        Transaction History Content
      </TabsContent>
      <TabsContent value="schema" className="space-y-4">
        <SchemaViewer />
      </TabsContent>
    </Tabs>
  )
}
