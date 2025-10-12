"use client"

import { CalendarDays, MapPin, Phone, Mail, Users, Building, Hash } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { Branch } from "@/hooks/use-branches"

interface BranchDetailsProps {
  branch: Branch
}

export function BranchDetails({ branch }: BranchDetailsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold">{branch.name}</h3>
        <Badge variant={branch.status === "active" ? "default" : "secondary"}>
          {branch.status === "active" ? "Active" : "Inactive"}
        </Badge>
      </div>

      <Separator />

      <div className="grid gap-4">
        <div className="flex items-start gap-2">
          <Hash className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Branch Code</p>
            <p className="text-sm text-muted-foreground">{branch.code}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Location</p>
            <p className="text-sm text-muted-foreground">{branch.location}</p>
            {branch.address && <p className="text-sm text-muted-foreground">{branch.address}</p>}
            <p className="text-sm text-muted-foreground">Region: {branch.region}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Branch Manager</p>
            <p className="text-sm text-muted-foreground">{branch.manager}</p>
          </div>
        </div>

        {(branch.contact_phone || branch.phone) && (
          <div className="flex items-start gap-2">
            <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Contact Information</p>
              {branch.contact_phone && <p className="text-sm text-muted-foreground">Mobile: {branch.contact_phone}</p>}
              {branch.phone && <p className="text-sm text-muted-foreground">Office: {branch.phone}</p>}
            </div>
          </div>
        )}

        {branch.email && (
          <div className="flex items-start gap-2">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{branch.email}</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2">
          <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Staff Count</p>
            <p className="text-sm text-muted-foreground">{branch.staff_count || 0} employees</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <CalendarDays className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Dates</p>
            <p className="text-sm text-muted-foreground">Created: {new Date(branch.created_at).toLocaleDateString()}</p>
            <p className="text-sm text-muted-foreground">
              Last Updated: {new Date(branch.updated_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
