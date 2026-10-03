"use client"

import { useState } from "react"

export default function Home() {
  const [mode, setMode] = useState<"create" | "join">("create")

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
            <button className="primary-button">
              Create a room
              <span>→</span>
            </button>
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
        <span>DROP / 01</span>
        <span>NO SERVER STORAGE</span>
      </footer>
    </main>
  )
}