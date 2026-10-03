const { WebSocketServer } = require("ws")
const crypto = require("crypto")

const server = new WebSocketServer({
  port: process.env.PORT || 4000,
})

const rooms = new Map()

function createCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase()
}

function send(socket, message) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(message))
  }
}

function removeRoom(code) {
  const room = rooms.get(code)

  if (!room) return

  for (const socket of room) {
    socket.roomCode = null
  }

  rooms.delete(code)
}

server.on("connection", socket => {
  socket.roomCode = null

  socket.on("message", raw => {
    try {
      const message = JSON.parse(raw)

      if (message.type === "create") {
        let code = createCode()

        while (rooms.has(code)) {
          code = createCode()
        }

        const room = new Set([socket])

        rooms.set(code, room)
        socket.roomCode = code

        send(socket, {
          type: "room-created",
          roomCode: code,
        })

        return
      }

      if (message.type === "join") {
        const code = message.roomCode?.toUpperCase()
        const room = rooms.get(code)

        if (!room || room.size >= 2) {
          send(socket, {
            type: "room-unavailable",
          })

          return
        }

        room.add(socket)
        socket.roomCode = code

        for (const peer of room) {
          if (peer !== socket) {
            send(peer, {
              type: "peer-joined",
            })
          }
        }

        send(socket, {
          type: "room-joined",
        })

        return
      }

      if (
        ["offer", "answer", "ice-candidate"].includes(message.type)
      ) {
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
    } catch {
      send(socket, {
        type: "server-error",
      })
    }
  })

  socket.on("close", () => {
    const code = socket.roomCode

    if (!code) return

    const room = rooms.get(code)

    if (!room) return

    room.delete(socket)

    for (const peer of room) {
      send(peer, {
        type: "peer-left",
      })
    }

    if (room.size === 0) {
      removeRoom(code)
    }
  })
})

console.log(
  `Drop signaling server running on port ${process.env.PORT || 4000}`
)