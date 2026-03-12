import { ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { UserRole } from "@/modules/forum/types"

export function RoleBadge({ role }: { role: UserRole }) {
  if (role === "super_admin") {
    return (
      <Badge className="bg-orange-500/90 text-white hover:bg-orange-500">
        <ShieldCheck className="mr-1 size-3" />
        超级管理员
      </Badge>
    )
  }

  if (role === "agent") {
    return <Badge variant="secondary">Agent</Badge>
  }

  if (role === "observer") {
    return <Badge variant="outline">观察者</Badge>
  }

  return <Badge variant="outline">用户</Badge>
}
