"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Package, Pencil, Plus, Trash2 } from "lucide-react"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/toast"
import { useWorkspace } from "@/components/workspace-provider"
import { formatCents, moneyToCents } from "@/lib/invoice"
import { UNIT_OPTIONS, unitLabel } from "@/lib/units"

type Product = {
  id: string
  name: string
  itemCode: string | null
  unit: string | null
  sellingPrice: string
}

type ProductDraft = {
  name: string
  itemCode: string
  unit: string
  sellingPrice: number
}

function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSubmit,
  pending,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSubmit: (draft: ProductDraft) => void
  pending: boolean
  error: string | null
}) {
  const [name, setName] = useState(product?.name ?? "")
  const [itemCode, setItemCode] = useState(product?.itemCode ?? "")
  const [unit, setUnit] = useState(product?.unit ?? "PCS")
  const [price, setPrice] = useState(
    product ? Number(product.sellingPrice).toFixed(2) : ""
  )
  const [localError, setLocalError] = useState<string | null>(null)

  const editing = Boolean(product)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = name.trim()
    const value = Number(price)
    if (!trimmed) {
      setLocalError("Product name is required")
      return
    }
    if (!Number.isFinite(value) || value < 0) {
      setLocalError("Selling price must be a valid number and cannot be negative")
      return
    }
    setLocalError(null)
    onSubmit({
      name: trimmed,
      itemCode: itemCode.trim(),
      unit,
      sellingPrice: value,
    })
  }

  const message = localError ?? error

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Product" : "Add Product"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the name or selling price for this product."
              : "Create a product to use on your invoices."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="product-name">Name</FieldLabel>
              <Input
                id="product-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sugar 1kg"
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="product-code">Item Code</FieldLabel>
                <Input
                  id="product-code"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  placeholder="SKU (optional)"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="product-unit">Unit</FieldLabel>
                <Select value={unit} onValueChange={(value) => setUnit(value ?? "PCS")}>
                  <SelectTrigger id="product-unit" aria-label="Unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="product-price">Selling Price (ETB)</FieldLabel>
              <Input
                id="product-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </Field>
          </FieldGroup>

          {message && <p className="text-sm text-destructive">{message}</p>}

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" />}
              disabled={pending}
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ProductsPage() {
  const { workspace, isPending: workspacePending } = useWorkspace()
  const queryClient = useQueryClient()
  const businessId = workspace?.businessId ?? ""
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data, isPending, error } = useQuery({
    queryKey: ["products", businessId],
    queryFn: async () => {
      const res = await fetch(`/api/products?businessId=${businessId}`)
      if (!res.ok) throw new Error("Failed to load products")
      const body = (await res.json()) as { products: Product[] }
      return body.products
    },
    enabled: Boolean(workspace),
  })

  const products = data ?? []
  const loadError = error instanceof Error ? error.message : null

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["products", businessId] })
  }

  const saveMutation = useMutation({
    mutationFn: async (draft: ProductDraft & { id?: string }) => {
      const res = await fetch(
        draft.id ? `/api/products/${draft.id}` : "/api/products",
        {
          method: draft.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            itemCode: draft.itemCode,
            unit: draft.unit,
            sellingPrice: draft.sellingPrice,
          }),
        }
      )
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? `Failed to save product (${res.status})`)
      }
    },
    onSuccess: () => {
      invalidate()
      setDialogOpen(false)
      setEditing(null)
      setFormError(null)
      toast.add({
        title: "Product saved",
        description: "Your product was saved successfully.",
        type: "success",
      })
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to save product"
      setFormError(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`Failed to delete product (${res.status})`)
    },
    onSuccess: () => {
      invalidate()
      toast.add({
        title: "Product deleted",
        description: "The product was removed.",
        type: "success",
      })
    },
    onError: (err) => {
      toast.add({
        title: "Could not delete product",
        description: err instanceof Error ? err.message : "Failed to delete",
        type: "destructive",
      })
    },
  })

  const handleDelete = (product: Product) => {
    deleteMutation.mutate(product.id)
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button
          onClick={() => {
            setEditing(null)
            setFormError(null)
            setDialogOpen(true)
          }}
        >
          <Plus data-icon="inline-start" />
          Add Product
        </Button>
      </div>

      {workspacePending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !workspace ? (
        <Empty className="rounded-xl border border-dashed p-10">
          <EmptyContent>
            <EmptyTitle>No business selected</EmptyTitle>
            <EmptyDescription>
              Create or select a business to manage products.
            </EmptyDescription>
            <Link href="/businesses/new">
              <Button>Create business</Button>
            </Link>
          </EmptyContent>
        </Empty>
      ) : isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : products.length === 0 ? (
        <Empty className="rounded-xl border border-dashed p-10">
          <EmptyMedia variant="icon">
            <Package />
          </EmptyMedia>
          <EmptyContent>
            <EmptyTitle>No products yet</EmptyTitle>
            <EmptyDescription>
              Add your first product to get started.
            </EmptyDescription>
            <Button
              onClick={() => {
                setEditing(null)
                setFormError(null)
                setDialogOpen(true)
              }}
            >
              <Plus data-icon="inline-start" />
              Add Product
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead className="w-28">Item Code</TableHead>
                <TableHead className="w-20">Unit</TableHead>
                <TableHead className="w-40 text-right">Selling Price</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.itemCode || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {unitLabel(product.unit) || "PCS"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(moneyToCents(product.sellingPrice))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(product)
                          setFormError(null)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">Edit {product.name}</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button variant="ghost" size="sm" />
                          }
                        >
                          <Trash2 className="size-4 text-destructive" />
                          <span className="sr-only">Delete {product.name}</span>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete &quot;{product.name}&quot;?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep product</AlertDialogCancel>
                            <AlertDialogCancel
                              variant="destructive"
                              onClick={() => handleDelete(product)}
                            >
                              Delete product
                            </AlertDialogCancel>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditing(null)
            setFormError(null)
          }
        }}
        product={editing}
        onSubmit={(draft) =>
          saveMutation.mutate(editing ? { ...draft, id: editing.id } : draft)
        }
        pending={saveMutation.isPending}
        error={formError}
      />
    </div>
  )
}
