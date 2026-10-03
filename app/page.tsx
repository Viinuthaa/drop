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

  function createRoom() {
    setRoomCode(generateRoomCode())
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
              <input placeholder="Room code" />

              <button className="primary-button">
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
        <span>DROP / 02</span>
        <span>NO SERVER STORAGE</span>
      </footer>
    </main>
  )
}