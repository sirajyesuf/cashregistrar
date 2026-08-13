"use client"

import * as React from "react"
import * as ToastPrimitive from "@base-ui/react/toast"
import { CheckCircle2, Info, X, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

type ToastVariant = "default" | "success" | "destructive"

const iconClasses: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  destructive: "text-destructive",
}

function ToastIcon({
  variant,
  className,
}: {
  variant: ToastVariant
  className?: string
}) {
  if (variant === "success") return <CheckCircle2 className={className} />
  if (variant === "destructive") return <XCircle className={className} />
  return <Info className={className} />
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
              "pointer-events-auto flex w-full items-start justify-between gap-3 rounded-lg border bg-background p-4 shadow-lg transition-[opacity,transform] duration-200",
              "data-[ending]:animate-out data-[starting]:animate-in"
            )}
          >
            <div className="flex items-start gap-2.5">
              <ToastIcon
                variant={variant}
                className={cn("size-4 shrink-0", iconClasses[variant])}
              />
              <div className="flex flex-col gap-0.5">
                <ToastPrimitive.Toast.Title className="text-sm font-semibold">
                  {item.title}
                </ToastPrimitive.Toast.Title>
                {item.description && (
                  <ToastPrimitive.Toast.Description className="text-sm text-muted-foreground">
                    {item.description}
                  </ToastPrimitive.Toast.Description>
                )}
              </div>
            </div>
            <ToastPrimitive.Toast.Close
              aria-label="Close notification"
              className="rounded-md p-0.5 text-muted-foreground opacity-60 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-4" />
            </ToastPrimitive.Toast.Close>
          </ToastPrimitive.Toast.Root>
        )
      })}
    </ToastPrimitive.Toast.Viewport>
  )
}
