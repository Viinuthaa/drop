"use client"

import { useEffect, useRef, useState } from "react"

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

  const socketRef = useRef<WebSocket | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])

  useEffect(() => {
    const socket = new WebSocket(SIGNALING_URL)
    socketRef.current = socket

    socket.onmessage = async event => {
      const message: SignalMessage = JSON.parse(event.data)

      if (message.type === "room-created") {
        setRoomCode(message.roomCode || "")
        setStatus("Waiting for the other device")
      }

      if (message.type === "room-joined") {
        setRoomCode(joinCode)
        setStatus("Joining room")
      }

      if (message.type === "peer-joined") {
        setStatus("Connecting to other device")
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
        setStatus("Other device disconnected")
        peerRef.current?.close()
        peerRef.current = null
      }

      if (message.type === "room-unavailable") {
        setStatus("Room unavailable")
      }
    }

    socket.onerror = () => {
      setStatus("Signaling server unavailable")
    }

    return () => {
      socket.close()
      peerRef.current?.close()
    }
  }, [joinCode])

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
      }

      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "disconnected"
      ) {
        setStatus("Connection interrupted")
      }
    }

    peer.ondatachannel = event => {
      const channel = event.channel

      channel.onopen = () => {
        setStatus("Connected directly")
      }
    }

    if (offerer) {
      const channel = peer.createDataChannel("connection")

      channel.onopen = () => {
        setStatus("Connected directly")
      }

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

  function createRoom() {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setStatus("Signaling server unavailable")
      return
    }

    socketRef.current.send(
      JSON.stringify({
        type: "create",
      })
    )
  }

  function joinRoom() {
    if (
      joinCode.length !== 6 ||
      socketRef.current?.readyState !== WebSocket.OPEN
    ) {
      return
    }

    socketRef.current.send(
      JSON.stringify({
        type: "join",
        roomCode: joinCode,
      })
    )
  }

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
            roomCode ? (
              <div className="room-created">
                <p className="room-label">ROOM CODE</p>
                <strong>{roomCode}</strong>
                <p>{status}</p>
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

          <p className="panel-note">
            {status || "No account required · Browser-to-browser transfer"}
          </p>
        </div>
      </section>

      <footer>
        <span>DROP / 05</span>
        <span>NO SERVER STORAGE</span>
      </footer>
    </main>
  )
}