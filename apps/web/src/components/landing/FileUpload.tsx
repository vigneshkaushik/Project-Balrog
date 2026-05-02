import { useId, useRef, useState } from 'react'

interface FileUploadProps {
  onFileSelected: (file: File | null) => void
  selectedFileName?: string | null
  disabled?: boolean
}

export function FileUpload({
  onFileSelected,
  selectedFileName,
  disabled,
}: FileUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isXmlFile = (file: File): boolean => {
    const name = file.name.toLowerCase()
    const type = file.type.toLowerCase()
    return (
      name.endsWith('.xml') ||
      type === 'text/xml' ||
      type === 'application/xml' ||
      type.endsWith('+xml')
    )
  }

  const handleSelectedFile = (file: File | null) => {
    if (!file) {
      return
    }
    if (!isXmlFile(file)) {
      setError('Only XML clash report files are supported.')
      onFileSelected(null)
      return
    }
    setError(null)
    onFileSelected(file)
  }

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".xml,application/xml,text/xml"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null
          handleSelectedFile(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        className={[
          'flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors cursor-pointer',
          disabled
            ? 'cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400'
            : isDragging
              ? 'border-primary bg-primary/10 text-primary-hover'
              : 'border-primary/60 bg-white text-neutral-700 hover:bg-primary/5',
        ].join(' ')}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault()
          if (disabled) return
          setIsDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (disabled) return
          setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          if (disabled) return
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
          setIsDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (disabled) return
          setIsDragging(false)
          const file = e.dataTransfer.files?.[0] ?? null
          handleSelectedFile(file)
        }}
      >
        {selectedFileName ? (
          <p className="text-sm font-medium">{selectedFileName}</p>
        ) : (
          <>
            <p className="text-xs font-medium">
              Drag and drop your Navisworks clash report here (XML only)
            </p>
            <p className="text-xs opacity-80">or click to browse files</p>
          </>
        )}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
