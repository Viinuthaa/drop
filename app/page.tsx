"use client"

import { useEffect, useState } from "react"

const SIGNALING_URL = "ws://localhost:4000"

function generateRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

  return Array.from(
    { length: 6 },
    () => characters[Math.floor(Math.random() * characters.length)]
  ).join("")
}

export default function Home() {
  const [mode, setMode] = useState<"create" | "join">("create")
  const [roomCode, setRoomCode] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [status, setStatus] = useState("")
  const [socket, setSocket] = useState<WebSocket | null>(null)

  useEffect(() => {
    const connection = new WebSocket(SIGNALING_URL)

    connection.onopen = () => setSocket(connection)
    connection.onclose = () => setSocket(null)

    connection.onmessage = event => {
      const message = JSON.parse(event.data)

      if (message.type === "room-created") {
        setRoomCode(message.roomCode)
        setStatus("Waiting for the other device")
      }

      if (message.type === "room-joined") {
        setRoomCode(joinCode)
        setStatus("Connected to room")
      }

      if (message.type === "peer-joined") {
        setStatus("Other device connected")
      }

      if (message.type === "peer-left") {
        setStatus("Other device disconnected")
      }

      if (message.type === "room-unavailable") {
        setStatus("Room unavailable")
      }
    }

    return () => connection.close()
  }, [joinCode])

  function createRoom() {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "create" }))
      return
    }

    setRoomCode(generateRoomCode())
    setStatus("Start the signaling server to create a live room")
  }

  function joinRoom() {
    if (joinCode.length !== 6) return

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "join",
          roomCode: joinCode,
        })
      )
      return
    }

    setRoomCode(joinCode)
    setStatus("Start the signaling server to join this room")
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
            No account required · Browser-to-browser transfer
          </p>
        </div>
      </section>

      <footer>
        <span>DROP / 04</span>
        <span>NO SERVER STORAGE</span>
      </footer>
    </main>
  )
}