"use client"

import * as React from "react"
import * as ToastPrimitive from "@base-ui/react/toast"
import { CheckCircle2, X, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

type ToastVariant = "default" | "success" | "destructive"

const variantClasses: Record<ToastVariant, string> = {
  default: "border-border bg-background text-foreground",
  success:
    "border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950 dark:text-emerald-100",
  destructive:
    "border-destructive/60 bg-destructive text-destructive-foreground",
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") {
    return (
      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
    )
  }
  if (variant === "destructive") {
    return <XCircle className="size-4 shrink-0" />
  }
  return null
}

export const toast = ToastPrimitive.Toast.createToastManager()

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastPrimitive.Toast.Provider toastManager={toast}>
      {children}
      <ToastViewport />
    </ToastPrimitive.Toast.Provider>
  )
}

function ToastViewport() {
  const manager = ToastPrimitive.Toast.useToastManager()

  return (
    <ToastPrimitive.Toast.Viewport className="pointer-events-none fixed right-0 bottom-0 z-[100] flex w-full flex-col gap-2 p-4 sm:right-4 sm:bottom-4 sm:max-w-sm print:hidden">
      {manager.toasts.map((item) => {
        const variant = (item.type as ToastVariant) ?? "default"
        return (
          <ToastPrimitive.Toast.Root
            key={item.id}
            toast={item}
            className={cn(
              "pointer-events-auto flex w-full items-start justify-between gap-3 rounded-lg border p-4 shadow-lg transition-[opacity,transform] duration-200",
              "data-[ending]:data-[ending]:animate-out data-[starting]:data-[starting]:animate-in",
              variantClasses[variant]
            )}
          >
            <div className="flex items-start gap-3">
              <ToastIcon variant={variant} />
              <div className="space-y-1">
                <ToastPrimitive.Toast.Title className="text-sm font-semibold">
                  {item.title}
                </ToastPrimitive.Toast.Title>
                {item.description && (
                  <ToastPrimitive.Toast.Description className="text-sm opacity-90">
                    {item.description}
                  </ToastPrimitive.Toast.Description>
                )}
              </div>
            </div>
            <ToastPrimitive.Toast.Close
              aria-label="Close notification"
              className="rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:outline-none"
            >
              <X className="size-4" />
            </ToastPrimitive.Toast.Close>
          </ToastPrimitive.Toast.Root>
        )
      })}
    </ToastPrimitive.Toast.Viewport>
  )
}
