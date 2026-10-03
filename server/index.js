const { WebSocketServer } = require("ws")
const crypto = require("crypto")

const server = new WebSocketServer({ port: 4000 })
const rooms = new Map()

function createCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase()
}

function send(socket, message) {
  socket.send(JSON.stringify(message))
}

server.on("connection", socket => {
  socket.on("message", raw => {
    const message = JSON.parse(raw)

    if (message.type === "create") {
      let code = createCode()

      while (rooms.has(code)) {
        code = createCode()
      }

      rooms.set(code, new Set([socket]))
      socket.roomCode = code

      send(socket, {
        type: "room-created",
        roomCode: code,
      })

      return
    }

    if (message.type === "join") {
      const room = rooms.get(message.roomCode)

      if (!room || room.size >= 2) {
        send(socket, { type: "room-unavailable" })
        return
      }

      room.add(socket)
      socket.roomCode = message.roomCode

      for (const peer of room) {
        if (peer !== socket) {
          send(peer, { type: "peer-joined" })
        }
      }

      send(socket, { type: "room-joined" })
      return
    }

    if (["offer", "answer", "ice-candidate"].includes(message.type)) {
      const room = rooms.get(socket.roomCode)

      if (!room) return

      for (const peer of room) {
        if (peer !== socket) {
          send(peer, {
            type: message.type,
            data: message.data,
          })
        }
      }
    }
  })

  socket.on("close", () => {
    const code = socket.roomCode

    if (!code) return

    const room = rooms.get(code)

    if (!room) return

    room.delete(socket)

    for (const peer of room) {
      send(peer, { type: "peer-left" })
    }

    if (room.size === 0) {
      rooms.delete(code)
    }
  })
})

console.log("Drop signaling server running on port 4000")