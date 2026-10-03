"use client"

import { useState } from "react"

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
  const [joined, setJoined] = useState(false)

  function createRoom() {
    setRoomCode(generateRoomCode())
  }

  function joinRoom() {
    const code = joinCode.trim().toUpperCase()

    if (code.length === 6) {
      setRoomCode(code)
      setJoined(true)
    }
  }

  if (joined) {
    return (
      <main className="room-page">
        <div className="room-header">
          <div className="brand">drop</div>
          <span>ROOM {roomCode}</span>
        </div>

        <section className="room-content">
          <p className="eyebrow">ROOM READY</p>

          <h1>Waiting for a connection.</h1>

          <div className="room-code">
            <span>ROOM CODE</span>
            <strong>{roomCode}</strong>
          </div>

          <p>
            Share this code with the other device to start
            transferring files.
          </p>
        </section>
      </main>
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
                <p className="room-label">YOUR ROOM CODE</p>
                <strong>{roomCode}</strong>
                <p>Share this code with the other device.</p>
              </div>
            ) : (
              <button
                className="primary-button"
                onClick={createRoom}
              >
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
        <span>DROP / 03</span>
        <span>NO SERVER STORAGE</span>
      </footer>
    </main>
  )
}