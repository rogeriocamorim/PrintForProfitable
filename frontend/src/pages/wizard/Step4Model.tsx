import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Upload } from 'lucide-react'
import { apiFormData } from '../../lib/api'

export default function Step4Model() {
  const navigate = useNavigate()
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name.replace(/\.(3mf|stl)$/i, ''))
      await apiFormData('/models/upload', formData)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="flex flex-col justify-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Upload your first model</h1>
          <p className="text-muted text-lg">
            Upload a 3D model file so we can analyze it and generate a cost breakdown for your first product.
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="py-6">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : file
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Upload className={`mb-4 h-10 w-10 ${file ? 'text-green-500' : 'text-gray-400'}`} />
                {file ? (
                  <>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="mt-2 text-sm text-primary hover:text-primary-hover cursor-pointer"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-900">
                      Drag and drop your model file here
                    </p>
                    <label className="mt-2 text-sm text-primary hover:text-primary-hover cursor-pointer">
                      or browse to upload
                      <input
                        type="file"
                        accept=".3mf,.stl"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <p className="mt-3 text-xs text-muted">
                      Supported formats: .3mf, .stl
                    </p>
                  </>
                )}
              </div>

              <div className="mt-6 text-center">
                <span className="text-sm text-muted">OR</span>
              </div>

              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => navigate('/dashboard/models/new')}
              >
                Enter model details manually
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
            )}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-sm text-muted hover:text-gray-700 cursor-pointer"
              >
                Skip and add a model later
              </button>
              <Button size="lg" onClick={handleSubmit} disabled={!file || loading}>
                {loading ? 'Uploading...' : 'Upload & Continue'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
