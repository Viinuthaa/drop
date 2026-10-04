"use client"

import { useEffect, useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import FileDropzone from "../components/FileDropzone"

const SIGNALING_URL = "ws://localhost:4000"

type SignalMessage = {
  type: string
  roomCode?: string
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit
}

export default function Home() {
  const [mode, setMode] = useState<"create" | "join">("create")
  const [roomCode, setRoomCode] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [status, setStatus] = useState("")
  const [dataChannel, setDataChannel] =
    useState<RTCDataChannel | null>(null)
  const [disconnected, setDisconnected] = useState(false)

  const socketRef = useRef<WebSocket | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])

  useEffect(() => {
    connectSignaling()

    return () => {
      socketRef.current?.close()
      peerRef.current?.close()
    }
  }, [])

  function connectSignaling() {
    const socket = new WebSocket(SIGNALING_URL)
    socketRef.current = socket

    socket.onopen = () => {
      setStatus("")
    }

    socket.onmessage = async event => {
      try {
        const message: SignalMessage = JSON.parse(event.data)

        if (message.type === "room-created") {
          setRoomCode(message.roomCode || "")
          setStatus("Waiting for the other device")
          setDisconnected(false)
        }

        if (message.type === "room-joined") {
          setRoomCode(joinCode)
          setStatus("Joining room")
          setDisconnected(false)
        }

        if (message.type === "peer-joined") {
          setStatus("Connecting to other device")
          setDisconnected(false)
          await createPeer(true)
        }

        if (message.type === "offer" && message.data) {
          await createPeer(false)

          const peer = peerRef.current

          if (!peer) return

          await peer.setRemoteDescription(message.data)

          for (const candidate of pendingCandidates.current) {
            await peer.addIceCandidate(candidate)
          }

          pendingCandidates.current = []

          const answer = await peer.createAnswer()
          await peer.setLocalDescription(answer)

          socket.send(
            JSON.stringify({
              type: "answer",
              data: answer,
            })
          )
        }

        if (message.type === "answer" && message.data) {
          await peerRef.current?.setRemoteDescription(message.data)
        }

        if (message.type === "ice-candidate" && message.data) {
          const peer = peerRef.current

          if (peer?.remoteDescription) {
            await peer.addIceCandidate(message.data)
          } else {
            pendingCandidates.current.push(
              message.data as RTCIceCandidateInit
            )
          }
        }

        if (message.type === "peer-left") {
          handleDisconnect("Other device disconnected")
        }

        if (message.type === "room-unavailable") {
          setStatus("Room unavailable")
          setDisconnected(true)
        }

        if (message.type === "server-error") {
          setStatus("Signaling server error")
        }
      } catch {
        setStatus("Invalid signaling message")
      }
    }

    socket.onerror = () => {
      setStatus("Signaling server unavailable")
    }

    socket.onclose = () => {
      if (!disconnected && !peerRef.current) {
        setStatus("Signaling server unavailable")
      }
    }
  }

  async function createPeer(offerer: boolean) {
    if (peerRef.current) return

    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    })

    peerRef.current = peer

    peer.onicecandidate = event => {
      if (!event.candidate) return

      socketRef.current?.send(
        JSON.stringify({
          type: "ice-candidate",
          data: event.candidate.toJSON(),
        })
      )
    }

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        setStatus("Connected directly")
        setDisconnected(false)
      }

      if (peer.connectionState === "failed") {
        handleDisconnect("Connection failed")
      }

      if (peer.connectionState === "disconnected") {
        setStatus("Connection interrupted")
      }

      if (peer.connectionState === "closed") {
        setDataChannel(null)
      }
    }

    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === "failed") {
        handleDisconnect("Network connection failed")
      }
    }

    peer.ondatachannel = event => {
      setupDataChannel(event.channel)
    }

    if (offerer) {
      const channel = peer.createDataChannel("files")

      setupDataChannel(channel)

      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)

      socketRef.current?.send(
        JSON.stringify({
          type: "offer",
          data: offer,
        })
      )
    }
  }

  function setupDataChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      setDataChannel(channel)
      setStatus("Connected directly")
      setDisconnected(false)
    }

    channel.onclose = () => {
      setDataChannel(null)
    }

    channel.onerror = () => {
      setStatus("File transfer connection failed")
    }
  }

  function handleDisconnect(message: string) {
    setStatus(message)
    setDisconnected(true)
    setDataChannel(null)

    peerRef.current?.close()
    peerRef.current = null
    pendingCandidates.current = []
  }

  function createRoom() {
    const socket = socketRef.current

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatus("Signaling server unavailable")
      return
    }

    setRoomCode("")
    setDisconnected(false)

    socket.send(
      JSON.stringify({
        type: "create",
      })
    )
  }

  function joinRoom() {
    const socket = socketRef.current

    if (
      joinCode.length !== 6 ||
      !socket ||
      socket.readyState !== WebSocket.OPEN
    ) {
      return
    }

    setDisconnected(false)

    socket.send(
      JSON.stringify({
        type: "join",
        roomCode: joinCode,
      })
    )
  }

  const connected = status === "Connected directly"

  return (
    <main className="page">
      <nav className="navbar">
        <div className="status">
          <span />
          P2P transfer
        </div>

        <span>WEBRTC</span>
      </nav>

      <section className="hero">
        <div className="brand">drop</div>

        <p className="eyebrow">PRIVATE FILE TRANSFER</p>

        <h1>Send files directly</h1>

        <p className="hero-text">
          Fast, private file transfers between devices.
          Nothing is uploaded or stored on a server.
        </p>

        <div className="panel">
          <div className="tabs">
            <button
              className={mode === "create" ? "active" : ""}
              onClick={() => setMode("create")}
            >
              Create room
            </button>

            <button
              className={mode === "join" ? "active" : ""}
              onClick={() => setMode("join")}
            >
              Join room
            </button>
          </div>

          {mode === "create" ? (
            roomCode && !disconnected ? (
              <div className="room-created">
                <p className="room-label">ROOM CODE</p>
                <strong>{roomCode}</strong>
                <p>{status}</p>

                <div className="qr-code">
                  <QRCodeSVG
                    value={`${window.location.origin}/?room=${roomCode}`}
                    size={160}
                    bgColor="#1a171f"
                    fgColor="#e5e0e5"
                  />
                </div>
              </div>
            ) : (
              <button className="primary-button" onClick={createRoom}>
                Create a room
                <span>→</span>
              </button>
            )
          ) : (
            <div className="join-form">
              <input
                value={joinCode}
                onChange={event =>
                  setJoinCode(event.target.value.toUpperCase())
                }
                maxLength={6}
                placeholder="Room code"
              />

              <button
                className="primary-button"
                onClick={joinRoom}
                disabled={joinCode.length !== 6}
              >
                Join room
                <span>→</span>
              </button>
            </div>
          )}

          {connected && <FileDropzone dataChannel={dataChannel} />}

          {disconnected && (
            <div className="room-created">
              <p className="room-label">DISCONNECTED</p>
              <p>{status}</p>

              <button
                className="primary-button"
                onClick={createRoom}
              >
                Create new room
                <span>→</span>
              </button>
            </div>
          )}

          <p className="panel-note">
            {status ||
              "No account required · Browser-to-browser transfer"}
          </p>
        </div>
      </section>

      <footer>
        <span>DROP / 12</span>
        <span>NO SERVER STORAGE</span>
      </footer>
    </main>
  )
}