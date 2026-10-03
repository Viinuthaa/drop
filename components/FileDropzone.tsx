"use client"

import { useRef, useState } from "react"

type Props = {
  onFiles: (files: File[]) => void
}

export default function FileDropzone({ onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)

  function addFiles(selected: FileList | null) {
    if (!selected) return

    const next = [...files, ...Array.from(selected)]
    setFiles(next)
    onFiles(next)
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index)
    setFiles(next)
    onFiles(next)
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="file-transfer">
      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={event => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault()
          setDragging(false)
          addFiles(event.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={event => addFiles(event.target.files)}
        />

        <span className="drop-icon">+</span>

        <strong>Drop files here</strong>

        <p>or click to browse</p>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((file, index) => (
            <div className="file-item" key={`${file.name}-${index}`}>
              <div>
                <strong>{file.name}</strong>
                <span>{formatSize(file.size)}</span>
              </div>

              <button
                onClick={event => {
                  event.stopPropagation()
                  removeFile(index)
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}