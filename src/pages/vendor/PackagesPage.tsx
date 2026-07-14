import { Edit, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { getFriendlyAuthError } from '../../features/auth/authErrors'
import { useAuth } from '../../features/auth/useAuth'
import {
  createServicePackageCategory,
  listServicePackageCategories,
  softDeleteServicePackageCategory,
  updateServicePackageCategory,
} from '../../services/firestore/packageCategories'
import {
  createServicePackage,
  listServicePackages,
  softDeleteServicePackage,
  updateServicePackage,
  type ServicePackageInput,
} from '../../services/firestore/packages'
import type { ServicePackage, ServicePackageCategory } from '../../types/domain'

const emptyPackageForm: ServicePackageInput = {
  categoryId: '',
  categoryName: '',
  name: '',
  price: 0,
  description: '',
  eventDuration: '',
  additionalNote: '',
  isActive: true,
}

export function PackagesPage() {
  const { profile } = useAuth()
  const [categories, setCategories] = useState<ServicePackageCategory[]>([])
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [categoryName, setCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [form, setForm] = useState<ServicePackageInput>(emptyPackageForm)
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCategorySaving, setIsCategorySaving] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = useCallback(async () => {
    if (!profile) return

    setError('')
    setIsLoading(true)

    try {
      const [loadedCategories, loadedPackages] = await Promise.all([
        listServicePackageCategories(profile.uid),
        listServicePackages(profile.uid),
      ])

      setCategories(loadedCategories)
      setPackages(loadedPackages)
    } catch (loadError) {
      setError(getFriendlyAuthError(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [profile])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function updateField<TField extends keyof ServicePackageInput>(field: TField, value: ServicePackageInput[TField]) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function handleCategorySelect(categoryId: string) {
    const selectedCategory = categories.find((category) => category.id === categoryId)

    setForm((currentForm) => ({
      ...currentForm,
      categoryId,
      categoryName: selectedCategory?.name ?? '',
    }))
  }

  function resetPackageForm() {
    setForm(emptyPackageForm)
    setEditingPackageId(null)
  }

  function resetCategoryForm() {
    setCategoryName('')
    setEditingCategoryId(null)
  }

  function startEditCategory(category: ServicePackageCategory) {
    setCategoryName(category.name)
    setEditingCategoryId(category.id)
    setError('')
    setSuccess('')
  }

  function startEditPackage(servicePackage: ServicePackage) {
    setEditingPackageId(servicePackage.id)
    setForm({
      categoryId: servicePackage.categoryId,
      categoryName: servicePackage.categoryName,
      name: servicePackage.name,
      price: servicePackage.price,
      description: servicePackage.description ?? '',
      eventDuration: servicePackage.eventDuration ?? '',
      additionalNote: servicePackage.additionalNote ?? '',
      isActive: servicePackage.isActive,
    })
    setSuccess('')
    setError('')
  }

  async function handleCategorySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!profile) return

    setError('')
    setSuccess('')
    setIsCategorySaving(true)

    try {
      if (editingCategoryId) {
        await updateServicePackageCategory(editingCategoryId, profile.uid, { name: categoryName })
        setSuccess('Kategori berhasil diperbarui.')
      } else {
        await createServicePackageCategory(profile.uid, { name: categoryName })
        setSuccess('Kategori berhasil ditambahkan.')
      }

      resetCategoryForm()
      await loadData()
    } catch (categoryError) {
      setError(getFriendlyAuthError(categoryError))
    } finally {
      setIsCategorySaving(false)
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!profile) return

    setError('')
    setSuccess('')

    try {
      await softDeleteServicePackageCategory(categoryId, profile.uid)
      setSuccess('Kategori berhasil dihapus.')
      await loadData()

      if (editingCategoryId === categoryId) resetCategoryForm()
      if (form.categoryId === categoryId) resetPackageForm()
    } catch (deleteError) {
      setError(getFriendlyAuthError(deleteError))
    }
  }

  async function handlePackageSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!profile) return

    setError('')
    setSuccess('')
    setIsSaving(true)

    try {
      if (editingPackageId) {
        await updateServicePackage(editingPackageId, profile.uid, form)
        setSuccess('Paket berhasil diperbarui.')
      } else {
        await createServicePackage(profile.uid, form)
        setSuccess('Paket berhasil dibuat.')
      }

      resetPackageForm()
      await loadData()
    } catch (saveError) {
      setError(getFriendlyAuthError(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeletePackage(packageId: string) {
    setError('')
    setSuccess('')

    try {
      await softDeleteServicePackage(packageId)
      setSuccess('Paket berhasil dinonaktifkan dan disembunyikan.')
      await loadData()
      if (editingPackageId === packageId) resetPackageForm()
    } catch (deleteError) {
      setError(getFriendlyAuthError(deleteError))
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Manajemen Paket"
        description="Kelola kategori dan paket layanan vendor. Daftar paket diurutkan berdasarkan kategori, lalu harga termurah."
        actions={
          <Button disabled={isLoading} icon={<RefreshCw size={16} />} onClick={() => void loadData()} variant="secondary">
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold">Manajemen Kategori</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Tambahkan, edit, atau hapus kategori yang belum digunakan oleh paket.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={handleCategorySubmit}>
            <Input
              id="categoryName"
              label="Nama kategori"
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Wedding, Prewedding, Lamaran, Corporate Event"
              value={categoryName}
            />
            <div className="flex items-end gap-2">
              {editingCategoryId ? (
                <Button onClick={resetCategoryForm} type="button" variant="secondary">
                  Batal
                </Button>
              ) : null}
              <Button disabled={isCategorySaving} icon={<Plus size={16} />}>
                {isCategorySaving ? 'Menyimpan...' : editingCategoryId ? 'Simpan kategori' : 'Tambah kategori'}
              </Button>
            </div>
          </form>

          <div className="grid gap-2">
            {isLoading ? <p className="text-sm text-neutral-500">Memuat kategori...</p> : null}
            {!isLoading && categories.length === 0 ? (
              <p className="rounded-md bg-app-muted p-3 text-sm text-neutral-600">
                Belum ada kategori. Tambahkan kategori terlebih dahulu sebelum membuat paket.
              </p>
            ) : null}
            {categories.map((category) => (
              <div
                className="flex flex-col gap-2 rounded-md border border-app-border p-3 sm:flex-row sm:items-center sm:justify-between"
                key={category.id}
              >
                <span className="font-semibold text-app-text">{category.name}</span>
                <div className="flex gap-2">
                  <Button
                    className="h-9 min-h-9 px-3"
                    icon={<Edit size={14} />}
                    onClick={() => startEditCategory(category)}
                    type="button"
                    variant="secondary"
                  >
                    Edit
                  </Button>
                  <Button
                    className="h-9 min-h-9 px-3"
                    icon={<Trash2 size={14} />}
                    onClick={() => void handleDeleteCategory(category.id)}
                    type="button"
                    variant="danger"
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold">{editingPackageId ? 'Edit Paket' : 'Tambah Paket'}</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Pilih kategori dari Manajemen Kategori. Harga paket akan disalin ke invoice saat invoice dibuat.
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handlePackageSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-app-text" htmlFor="category">
                Kategori
                <select
                  className="min-h-11 rounded-md border border-app-border bg-white px-3 text-sm outline-none transition focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft"
                  disabled={categories.length === 0}
                  id="category"
                  onChange={(event) => handleCategorySelect(event.target.value)}
                  required
                  value={form.categoryId}
                >
                  <option value="">Pilih kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                id="packageName"
                label="Nama paket"
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Wedding Premium"
                required
                value={form.name}
              />
              <CurrencyInput
                id="price"
                label="Harga paket"
                onValueChange={(_, numericValue) => updateField('price', numericValue)}
                value={form.price}
              />
              <Input
                id="eventDuration"
                label="Durasi acara"
                onChange={(event) => updateField('eventDuration', event.target.value)}
                placeholder="8 jam"
                value={form.eventDuration}
              />
              <label className="flex items-center gap-3 rounded-md border border-app-border px-3 py-3 text-sm font-medium">
                <input
                  checked={form.isActive}
                  className="h-4 w-4 accent-app-gold"
                  onChange={(event) => updateField('isActive', event.target.checked)}
                  type="checkbox"
                />
                Paket aktif
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium text-app-text" htmlFor="description">
              Deskripsi paket
              <textarea
                className="min-h-24 rounded-md border border-app-border bg-white px-3 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft"
                id="description"
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Detail layanan yang termasuk dalam paket."
                value={form.description}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-app-text" htmlFor="additionalNote">
              Catatan tambahan
              <textarea
                className="min-h-20 rounded-md border border-app-border bg-white px-3 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-app-gold focus:ring-2 focus:ring-app-gold-soft"
                id="additionalNote"
                onChange={(event) => updateField('additionalNote', event.target.value)}
                value={form.additionalNote}
              />
            </label>
            {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-app-danger">{error}</p> : null}
            {success ? <p className="rounded-md bg-green-50 p-3 text-sm text-app-success">{success}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              {editingPackageId ? (
                <Button onClick={resetPackageForm} type="button" variant="secondary">
                  Batal edit
                </Button>
              ) : null}
              <Button disabled={isSaving || categories.length === 0} icon={<Plus size={16} />}>
                {isSaving ? 'Menyimpan...' : editingPackageId ? 'Simpan perubahan' : 'Tambah paket'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <h2 className="text-lg font-bold">Daftar Paket</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Urutan daftar: kategori terlebih dahulu, lalu harga dari termurah ke termahal.
          </p>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-left text-sm">
            <thead className="bg-app-muted text-xs uppercase text-neutral-500">
              <tr>
                <th className="border-b border-app-border px-4 py-3 font-semibold">Kategori</th>
                <th className="border-b border-app-border px-4 py-3 font-semibold">Nama paket</th>
                <th className="border-b border-app-border px-4 py-3 font-semibold">Harga</th>
                <th className="border-b border-app-border px-4 py-3 font-semibold">Durasi</th>
                <th className="border-b border-app-border px-4 py-3 font-semibold">Status</th>
                <th className="border-b border-app-border px-4 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-neutral-500" colSpan={6}>
                    Memuat paket...
                  </td>
                </tr>
              ) : null}
              {!isLoading && packages.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-neutral-500" colSpan={6}>
                    Belum ada paket.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? packages.map((servicePackage) => (
                    <tr className="border-b border-app-border last:border-0" key={servicePackage.id}>
                      <td className="px-4 py-4">{servicePackage.categoryName}</td>
                      <td className="px-4 py-4 font-semibold">{servicePackage.name}</td>
                      <td className="px-4 py-4">
                        {new Intl.NumberFormat('id-ID', {
                          currency: 'IDR',
                          style: 'currency',
                          maximumFractionDigits: 0,
                        }).format(servicePackage.price)}
                      </td>
                      <td className="px-4 py-4">{servicePackage.eventDuration ?? '-'}</td>
                      <td className="px-4 py-4">{servicePackage.isActive ? 'Aktif' : 'Nonaktif'}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <Button
                            className="h-9 min-h-9 px-3"
                            icon={<Edit size={14} />}
                            onClick={() => startEditPackage(servicePackage)}
                            type="button"
                            variant="secondary"
                          >
                            Edit
                          </Button>
                          <Button
                            className="h-9 min-h-9 px-3"
                            icon={<Trash2 size={14} />}
                            onClick={() => void handleDeletePackage(servicePackage.id)}
                            type="button"
                            variant="danger"
                          >
                            Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
