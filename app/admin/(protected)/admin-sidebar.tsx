"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Receipt,
  ScrollText,
  User,
  Users,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { AdminUserMenu } from "./admin-user-menu"

const NAV = [
  {
    title: "General",
    items: [
      {
        href: "/admin",
        label: "Overview",
        icon: LayoutDashboard,
        exact: true,
      },
      { href: "/admin/users", label: "Users", icon: Users },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/admin/invoices", label: "Invoices", icon: Receipt },
      { href: "/admin/logs", label: "Logs", icon: ScrollText },
      { href: "/admin/profile", label: "Profile", icon: User },
    ],
  },
]

export function AdminSidebar({
  name,
  email,
}: {
  name: string | null
  email: string
}) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  // Close the mobile sheet after navigating.
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/admin" />}
              className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                CR
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">CashRegistrar</span>
                <span className="text-xs text-sidebar-foreground/60">
                  Admin Console
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((link) => {
                  const active = link.exact
                    ? pathname === link.href
                    : pathname === link.href ||
                      pathname.startsWith(`${link.href}/`)
                  return (
                    <SidebarMenuItem key={link.href}>
                      <SidebarMenuButton
                        render={<Link href={link.href} />}
                        isActive={active}
                        tooltip={link.label}
                      >
                        <link.icon />
                        <span>{link.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <AdminUserMenu name={name} email={email} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}