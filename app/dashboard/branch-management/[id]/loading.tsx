import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function BranchDetailsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-[250px]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-[100px]" />
          <Skeleton className="h-10 w-[100px]" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-[200px] mb-2" />
              <Skeleton className="h-4 w-[150px]" />
            </div>
            <Skeleton className="h-6 w-[80px]" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-6 w-[200px]" />
            </div>
            <div>
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-6 w-[200px]" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-6 w-[200px]" />
            </div>
            <div>
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-6 w-[200px]" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-6 w-[200px]" />
            </div>
            <div>
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-6 w-[200px]" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-6 w-[200px]" />
            </div>
            <div>
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-6 w-[200px]" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-6 w-[200px]" />
            </div>
            <div>
              <Skeleton className="h-4 w-[100px] mb-2" />
              <Skeleton className="h-6 w-[200px]" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
