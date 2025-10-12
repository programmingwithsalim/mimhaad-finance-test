"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, Database, Table, Columns } from "lucide-react"

interface SchemaInfo {
  [tableName: string]: Array<{
    column: string
    type: string
    nullable: boolean
    default: string | null
    position: number
  }>
}

interface SampleData {
  [tableName: string]: any
}

export function SchemaViewer() {
  const [schema, setSchema] = useState<SchemaInfo>({})
  const [sampleData, setSampleData] = useState<SampleData>({})
  const [loading, setLoading] = useState(false)
  const [openTables, setOpenTables] = useState<Set<string>>(new Set())

  const fetchSchema = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/gl/schema-info")
      const data = await response.json()

      if (data.success) {
        setSchema(data.schema)
        setSampleData(data.sampleData)
        console.log("Schema data:", data.schema)
        console.log("Sample data:", data.sampleData)
      } else {
        console.error("Failed to fetch schema:", data.error)
      }
    } catch (error) {
      console.error("Error fetching schema:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleTable = (tableName: string) => {
    const newOpenTables = new Set(openTables)
    if (newOpenTables.has(tableName)) {
      newOpenTables.delete(tableName)
    } else {
      newOpenTables.add(tableName)
    }
    setOpenTables(newOpenTables)
  }

  const getTypeColor = (type: string) => {
    if (type.includes("varchar") || type.includes("text")) return "bg-blue-100 text-blue-800"
    if (type.includes("integer") || type.includes("bigint")) return "bg-green-100 text-green-800"
    if (type.includes("decimal") || type.includes("numeric")) return "bg-yellow-100 text-yellow-800"
    if (type.includes("timestamp") || type.includes("date")) return "bg-purple-100 text-purple-800"
    if (type.includes("boolean")) return "bg-red-100 text-red-800"
    if (type.includes("uuid")) return "bg-indigo-100 text-indigo-800"
    return "bg-gray-100 text-gray-800"
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Database Schema Viewer
        </CardTitle>
        <Button onClick={fetchSchema} disabled={loading} className="w-fit">
          {loading ? "Loading..." : "Fetch Schema"}
        </Button>
      </CardHeader>

      <CardContent>
        {Object.keys(schema).length === 0 ? (
          <p className="text-muted-foreground">Click "Fetch Schema" to view database structure</p>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Found {Object.keys(schema).length} tables</div>

            {Object.entries(schema).map(([tableName, columns]) => (
              <Card key={tableName} className="border-l-4 border-l-blue-500">
                <Collapsible open={openTables.has(tableName)} onOpenChange={() => toggleTable(tableName)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardTitle className="flex items-center justify-between text-lg">
                        <div className="flex items-center gap-2">
                          <Table className="h-4 w-4" />
                          {tableName}
                          <Badge variant="secondary">{columns.length} columns</Badge>
                        </div>
                        {openTables.has(tableName) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {/* Columns */}
                        <div>
                          <h4 className="font-medium flex items-center gap-2 mb-2">
                            <Columns className="h-4 w-4" />
                            Columns
                          </h4>
                          <div className="grid gap-2">
                            {columns.map((col) => (
                              <div
                                key={col.column}
                                className="flex items-center justify-between p-2 bg-muted/30 rounded"
                              >
                                <div className="flex items-center gap-2">
                                  <code className="font-mono text-sm font-medium">{col.column}</code>
                                  {!col.nullable && (
                                    <Badge variant="destructive" className="text-xs">
                                      NOT NULL
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className={getTypeColor(col.type)}>
                                    {col.type}
                                  </Badge>
                                  {col.default && (
                                    <Badge variant="outline" className="text-xs">
                                      default: {col.default}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Sample Data */}
                        {sampleData[tableName] && typeof sampleData[tableName] === "object" && (
                          <div>
                            <h4 className="font-medium mb-2">Sample Data</h4>
                            <div className="bg-muted/30 p-3 rounded overflow-x-auto">
                              <pre className="text-xs">{JSON.stringify(sampleData[tableName], null, 2)}</pre>
                            </div>
                          </div>
                        )}

                        {/* Error message if sample data failed */}
                        {typeof sampleData[tableName] === "string" && (
                          <div>
                            <h4 className="font-medium mb-2">Sample Data</h4>
                            <div className="bg-red-50 border border-red-200 p-3 rounded">
                              <p className="text-red-700 text-sm">{sampleData[tableName]}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
