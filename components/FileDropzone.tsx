"use client"

import { useEffect, useRef, useState } from "react"

type Props = {
  dataChannel: RTCDataChannel | null
}

type IncomingFile = {
  id: string
  name: string
  size: number
  type: string
  chunks: ArrayBuffer[]
  received: number
}

type ReceivedFile = {
  name: string
  size: number
  url: string
}

const CHUNK_SIZE = 64 * 1024
const MAX_BUFFERED_AMOUNT = 1024 * 1024

export default function FileDropzone({
  dataChannel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const incomingFile = useRef<IncomingFile | null>(null)
  const receivedUrls = useRef<string[]>([])
  const transferActive = useRef(false)

  const [files, setFiles] = useState<File[]>([])
  const [receivedFiles, setReceivedFiles] =
    useState<ReceivedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [receiving, setReceiving] = useState(false)
  const [receiveProgress, setReceiveProgress] =
    useState(0)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!dataChannel) return

    function handleClose() {
      transferActive.current = false
      incomingFile.current = null
      setSending(false)
      setReceiving(false)
      setProgress(0)
      setReceiveProgress(0)
      setMessage("Connection lost during transfer")
    }

    function handleMessage(event: MessageEvent) {
      if (typeof event.data === "string") {
        try {
          const data = JSON.parse(event.data)

          if (data.type === "file-start") {
            incomingFile.current = {
              id: data.id,
              name: data.name,
              size: data.size,
              type:
                data.fileType ||
                "application/octet-stream",
              chunks: [],
              received: 0,
            }

            setReceiving(true)
            setReceiveProgress(0)
            setMessage(`Receiving ${data.name}`)
          }

          if (data.type === "file-end") {
            const file = incomingFile.current

            if (!file || file.id !== data.id) {
              return
            }

            if (file.received !== file.size) {
              incomingFile.current = null
              setReceiving(false)
              setReceiveProgress(0)
              setMessage("Incomplete file received")
              return
            }

            const blob = new Blob(file.chunks, {
              type: file.type,
            })

            const url = URL.createObjectURL(blob)

            receivedUrls.current.push(url)

            setReceivedFiles(current => [
              ...current,
              {
                name: file.name,
                size: file.size,
                url,
              },
            ])

            setReceiveProgress(100)
            setReceiving(false)
            setMessage(`${file.name} received`)
            incomingFile.current = null
          }
        } catch {
          return
        }

        return
      }

      const file = incomingFile.current

      if (!file) return

      if (event.data instanceof ArrayBuffer) {
        file.chunks.push(event.data)
        file.received += event.data.byteLength

        setReceiveProgress(
          Math.min(
            100,
            Math.round(
              (file.received / file.size) * 100
            )
          )
        )

        return
      }

      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then(buffer => {
          const current = incomingFile.current

          if (!current) return

          current.chunks.push(buffer)
          current.received += buffer.byteLength

          setReceiveProgress(
            Math.min(
              100,
              Math.round(
                (current.received / current.size) * 100
              )
            )
          )
        })
      }
    }

    dataChannel.addEventListener(
      "message",
      handleMessage
    )

    dataChannel.addEventListener(
      "close",
      handleClose
    )

    return () => {
      dataChannel.removeEventListener(
        "message",
        handleMessage
      )

      dataChannel.removeEventListener(
        "close",
        handleClose
      )
    }
  }, [dataChannel])

  useEffect(() => {
    return () => {
      receivedUrls.current.forEach(url =>
        URL.revokeObjectURL(url)
      )
    }
  }, [])

  function addFiles(selected: FileList | null) {
    if (!selected) return

    setFiles(current => [
      ...current,
      ...Array.from(selected),
    ])

    setMessage("")
  }

  function removeFile(index: number) {
    setFiles(current =>
      current.filter((_, i) => i !== index)
    )
  }

  function waitForBuffer() {
    if (!dataChannel) {
      return Promise.resolve()
    }

    if (
      dataChannel.bufferedAmount <=
      MAX_BUFFERED_AMOUNT
    ) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      const handleLow = () => {
        cleanup()
        resolve()
      }

      const handleClose = () => {
        cleanup()
        reject(
          new Error("Connection closed")
        )
      }

      const cleanup = () => {
        dataChannel.removeEventListener(
          "bufferedamountlow",
          handleLow
        )

        dataChannel.removeEventListener(
          "close",
          handleClose
        )
      }

      dataChannel.bufferedAmountLowThreshold =
        MAX_BUFFERED_AMOUNT

      dataChannel.addEventListener(
        "bufferedamountlow",
        handleLow
      )

      dataChannel.addEventListener(
        "close",
        handleClose
      )
    })
  }

  async function sendFile(file: File) {
    if (
      !dataChannel ||
      dataChannel.readyState !== "open"
    ) {
      throw new Error(
        "Data channel is not connected"
      )
    }

    const id = crypto.randomUUID()

    dataChannel.send(
      JSON.stringify({
        type: "file-start",
        id,
        name: file.name,
        size: file.size,
        fileType: file.type,
      })
    )

    let offset = 0

    while (offset < file.size) {
      if (
        !dataChannel ||
        dataChannel.readyState !== "open" ||
        !transferActive.current
      ) {
        throw new Error("Connection closed")
      }

      await waitForBuffer()

      if (
        dataChannel.readyState !== "open" ||
        !transferActive.current
      ) {
        throw new Error("Connection closed")
      }

      const chunk = await file
        .slice(offset, offset + CHUNK_SIZE)
        .arrayBuffer()

      dataChannel.send(chunk)

      offset += chunk.byteLength

      setProgress(
        Math.min(
          100,
          Math.round(
            (offset / file.size) * 100
          )
        )
      )
    }

    if (dataChannel.readyState !== "open") {
      throw new Error("Connection closed")
    }

    dataChannel.send(
      JSON.stringify({
        type: "file-end",
        id,
      })
    )
  }

  async function sendFiles() {
    if (
      !dataChannel ||
      dataChannel.readyState !== "open" ||
      files.length === 0
    ) {
      return
    }

    transferActive.current = true
    setSending(true)
    setProgress(0)
    setMessage("Preparing transfer...")

    try {
      for (const file of files) {
        setProgress(0)
        setMessage(`Sending ${file.name}`)
        await sendFile(file)
      }

      setProgress(100)
      setMessage(
        files.length === 1
          ? "File sent successfully"
          : `${files.length} files sent successfully`
      )

      setFiles([])
    } catch {
      setProgress(0)
      setMessage(
        "Transfer failed — connection was lost"
      )
    } finally {
      transferActive.current = false
      setSending(false)
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const isConnected =
    dataChannel?.readyState === "open"

  return (
    <div className="file-transfer">
      <div
        className={`dropzone ${
          dragging ? "dragging" : ""
        }`}
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
        onClick={() =>
          inputRef.current?.click()
        }
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={event =>
            addFiles(event.target.files)
          }
        />

        <span className="drop-icon">+</span>

        <strong>Drop files here</strong>

        <p>or click to browse</p>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((file, index) => (
            <div
              className="file-item"
              key={`${file.name}-${index}`}
            >
              <div>
                <strong>{file.name}</strong>
                <span>
                  {formatSize(file.size)}
                </span>
              </div>

              <button
                onClick={event => {
                  event.stopPropagation()
                  removeFile(index)
                }}
                disabled={sending}
              >
                ×
              </button>
            </div>
          ))}

          <button
            className="primary-button"
            onClick={event => {
              event.stopPropagation()
              sendFiles()
            }}
            disabled={
              sending || !isConnected
            }
          >
            {sending
              ? `Sending ${progress}%`
              : `Send ${
                  files.length === 1
                    ? "file"
                    : `${files.length} files`
                }`}

            <span>→</span>
          </button>
        </div>
      )}

      {(sending || receiving) && (
        <div className="transfer-progress">
          <div className="transfer-progress-header">
            <span>
              {sending
                ? "Sending"
                : "Receiving"}
            </span>

            <span>
              {sending
                ? progress
                : receiveProgress}
              %
            </span>
          </div>

          <div className="progress-track">
            <div
              className="progress-bar"
              style={{
                width: `${
                  sending
                    ? progress
                    : receiveProgress
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {message && (
        <p className="transfer-message">
          {message}
        </p>
      )}

      {receivedFiles.length > 0 && (
        <div className="received-section">
          <p className="section-label">
            RECEIVED FILES
          </p>

          <div className="file-list">
            {receivedFiles.map((file, index) => (
              <div
                className="file-item"
                key={`${file.name}-${index}`}
              >
                <div>
                  <strong>{file.name}</strong>
                  <span>
                    {formatSize(file.size)}
                  </span>
                </div>

                <a
                  href={file.url}
                  download={file.name}
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}