import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function MoMoTransactionsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-4 w-[350px]" />
      </div>

      <Tabs defaultValue="new" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="new">New Transaction</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
        </TabsList>
        <TabsContent value="new" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Transaction Form Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-[180px]" />
                <Skeleton className="h-4 w-[250px]" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <div className="grid gap-4 md:grid-cols-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>

            {/* Balance Card Skeleton */}
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-[150px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col space-y-4 py-2">
                    <div className="rounded-lg border p-4">
                      <Skeleton className="h-4 w-[100px]" />
                      <Skeleton className="mt-1 h-8 w-[150px]" />
                      <div className="mt-2 flex space-x-4">
                        <Skeleton className="h-4 w-[100px]" />
                        <Skeleton className="h-4 w-[100px]" />
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <Skeleton className="h-4 w-[100px]" />
                      <Skeleton className="mt-1 h-8 w-[150px]" />
                      <div className="mt-2 flex space-x-4">
                        <Skeleton className="h-4 w-[100px]" />
                        <Skeleton className="h-4 w-[100px]" />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Skeleton className="h-10 w-[120px]" />
                  <Skeleton className="h-10 w-[120px]" />
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-[120px]" />
                  <Skeleton className="h-4 w-[180px]" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border p-3">
                      <Skeleton className="h-4 w-[100px]" />
                      <Skeleton className="mt-1 h-8 w-[60px]" />
                    </div>
                    <div className="rounded-lg border p-3">
                      <Skeleton className="h-4 w-[100px]" />
                      <Skeleton className="mt-1 h-8 w-[80px]" />
                    </div>
                    <div className="rounded-lg border p-3">
                      <Skeleton className="h-4 w-[100px]" />
                      <Skeleton className="mt-1 h-8 w-[70px]" />
                    </div>
                    <div className="rounded-lg border p-3">
                      <Skeleton className="h-4 w-[100px]" />
                      <Skeleton className="mt-1 h-8 w-[50px]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {/* Transaction History Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[180px]" />
              <Skeleton className="h-4 w-[250px]" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
                  <div className="flex w-full items-center space-x-2 md:w-2/3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-[240px]" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-10 w-[100px]" />
                    <Skeleton className="h-10 w-[100px]" />
                  </div>
                </div>

                <div className="rounded-md border">
                  <div className="p-4">
                    <div className="flex items-center justify-between border-b pb-4">
                      <Skeleton className="h-5 w-[100px]" />
                      <Skeleton className="h-5 w-[100px]" />
                      <Skeleton className="h-5 w-[100px]" />
                      <Skeleton className="h-5 w-[80px]" />
                      <Skeleton className="h-5 w-[80px]" />
                      <Skeleton className="h-5 w-[80px]" />
                      <Skeleton className="h-5 w-[80px]" />
                      <Skeleton className="h-5 w-[50px]" />
                    </div>
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center justify-between py-4">
                        <Skeleton className="h-5 w-[80px]" />
                        <Skeleton className="h-5 w-[120px]" />
                        <Skeleton className="h-5 w-[120px]" />
                        <Skeleton className="h-5 w-[80px]" />
                        <Skeleton className="h-5 w-[80px]" />
                        <Skeleton className="h-5 w-[60px]" />
                        <Skeleton className="h-5 w-[80px]" />
                        <Skeleton className="h-5 w-[30px]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
