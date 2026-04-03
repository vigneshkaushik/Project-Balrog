import { useId, useRef } from 'react'

interface FileUploadProps {
  onFileSelected: (file: File | null) => void
  disabled?: boolean
}

export function FileUpload({ onFileSelected, disabled }: FileUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".html,.xml,text/html,application/xml,text/xml"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null
          onFileSelected(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="btn-primary btn-primary--full"
      >
        Upload Navisworks report
      </button>
    </div>
  )
}
