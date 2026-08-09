"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Package, Pencil, Plus, Trash2 } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/toast"
import { useWorkspace } from "@/components/workspace-provider"
import { formatCents, moneyToCents } from "@/lib/invoice"

type Product = {
  id: string
  name: string
  sellingPrice: string
}

type ProductDraft = {
  name: string
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
    onSubmit({ name: trimmed, sellingPrice: value })
  }

  const message = localError ?? error

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-lg outline-none">
          <Dialog.Title className="text-lg font-semibold">
            {editing ? "Edit Product" : "Add Product"}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {editing
              ? "Update the name or selling price for this product."
              : "Create a product to use on your invoices."}
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Name</Label>
              <Input
                id="product-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sugar 1kg"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">Selling Price (ETB)</Label>
              <Input
                id="product-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>

            {message && <p className="text-sm text-destructive">{message}</p>}

            <div className="flex justify-end gap-2">
              <Dialog.Close render={<Button variant="outline" />} disabled={pending}>
                Cancel
              </Dialog.Close>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : editing ? "Save Changes" : "Add Product"}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default function ProductsPage() {
  const { workspace } = useWorkspace()
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
          body: JSON.stringify({ name: draft.name, sellingPrice: draft.sellingPrice }),
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
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      return
    }
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
          <Plus className="mr-1 h-4 w-4" />
          Add Product
        </Button>
      </div>

      {!workspace ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No business selected. Create or select a business to manage products.
          </p>
          <Link href="/businesses/new" className="mt-4 inline-block">
            <Button>Create business</Button>
          </Link>
        </div>
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Package className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No products yet. Add your first product to get started.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setEditing(null)
              setFormError(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Product
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead className="w-40 text-right">Selling Price</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
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
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit {product.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Delete {product.name}</span>
                      </Button>
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
