import * as React from "react"

import { cn } from "@/lib/utils"

function Field({
  className,
  orientation = "vertical",
  "data-invalid": dataInvalid,
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "vertical" | "horizontal"
  "data-invalid"?: boolean
}) {
  return (
    <div
      data-slot="field"
      data-invalid={dataInvalid}
      className={cn(
        "grid gap-2",
        orientation === "horizontal" &&
          "grid-cols-[auto_1fr] items-center gap-x-3",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        "text-sm font-medium text-foreground",
        "group-data-[invalid=true]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn("grid gap-4", className)}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant,
  ...props
}: React.ComponentProps<"legend"> & {
  variant?: "label"
}) {
  return (
    <legend
      data-slot="field-legend"
      className={cn(
        variant === "label" &&
          "text-sm font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-title"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("grid gap-1", className)}
      {...props}
    />
  )
}

function FieldError({
  className,
  errors,
  message,
  children,
  ...props
}: React.ComponentProps<"p"> & {
  errors?: ReadonlyArray<unknown>
  message?: string
}) {
  const fallback = message ?? children
  const list = [
    ...new Set(
      (errors ?? [])
        .map((error) => {
          if (typeof error === "string") return error
          if (error instanceof Error) return error.message
          if (error && typeof error === "object") {
            return (error as { message?: string }).message
          }
          return undefined
        })
        .filter((error): error is string => Boolean(error))
    ),
  ]

  if (!fallback && list.length === 0) return null

  return (
    <div data-slot="field-error" className={cn("space-y-1", className)}>
      {fallback && (
        <p className="text-xs font-medium text-destructive" {...props}>
          {fallback}
        </p>
      )}
      {list.map((error, index) => (
        <p key={index} className="text-xs font-medium text-destructive" {...props}>
          {error}
        </p>
      ))}
    </div>
  )
}

export {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldLegend,
  FieldTitle,
  FieldContent,
}
