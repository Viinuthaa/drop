require("dotenv").config()

const { WebSocketServer } = require("ws")
const crypto = require("crypto")
const { createClient } = require("redis")

const PORT = process.env.PORT || 4000
const ROOM_TTL = 30 * 60

const server = new WebSocketServer({
  port: PORT,
})

const redis = createClient({
  url: process.env.REDIS_URL,
})

const sockets = new Map()

function createCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase()
}

function send(socket, message) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(message))
  }
}

async function createRoom(socket) {
  let code = createCode()

  while (await redis.exists(`drop:room:${code}`)) {
    code = createCode()
  }

  await redis.set(
    `drop:room:${code}`,
    JSON.stringify({
      createdAt: Date.now(),
    }),
    {
      EX: ROOM_TTL,
    }
  )

  sockets.set(code, new Set([socket]))
  socket.roomCode = code

  send(socket, {
    type: "room-created",
    roomCode: code,
  })
}

async function joinRoom(socket, code) {
  const roomExists = await redis.exists(`drop:room:${code}`)

  if (!roomExists) {
    send(socket, {
      type: "room-unavailable",
    })

    return
  }

  let room = sockets.get(code)

  if (!room) {
    room = new Set()
    sockets.set(code, room)
  }

  if (room.size >= 2) {
    send(socket, {
      type: "room-unavailable",
    })

    return
  }

  room.add(socket)
  socket.roomCode = code

  await redis.expire(`drop:room:${code}`, ROOM_TTL)

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
}

async function removeSocket(socket) {
  const code = socket.roomCode

  if (!code) return

  const room = sockets.get(code)

  if (!room) return

  room.delete(socket)

  for (const peer of room) {
    send(peer, {
      type: "peer-left",
    })
  }

  if (room.size === 0) {
    sockets.delete(code)
    await redis.del(`drop:room:${code}`)
  } else {
    await redis.expire(`drop:room:${code}`, ROOM_TTL)
  }

  socket.roomCode = null
}

async function start() {
  await redis.connect()

  console.log("Redis connected")
  console.log(`Drop signaling server running on port ${PORT}`)

  server.on("connection", socket => {
    socket.roomCode = null

    socket.on("message", async raw => {
      try {
        const message = JSON.parse(raw)

        if (message.type === "create") {
          await createRoom(socket)
          return
        }

        if (message.type === "join") {
          const code = message.roomCode?.toUpperCase()

          if (!code || code.length !== 6) {
            send(socket, {
              type: "room-unavailable",
            })

            return
          }

          await joinRoom(socket, code)
          return
        }

        if (
          ["offer", "answer", "ice-candidate"].includes(message.type)
        ) {
          const room = sockets.get(socket.roomCode)

          if (!room) return

          for (const peer of room) {
            if (peer !== socket) {
              send(peer, {
                type: message.type,
                data: message.data,
              })
            }
          }

          await redis.expire(
            `drop:room:${socket.roomCode}`,
            ROOM_TTL
          )
        }
      } catch {
        send(socket, {
          type: "server-error",
        })
      }
    })

    socket.on("close", () => {
      removeSocket(socket).catch(error => {
        console.error("Failed to remove socket:", error)
      })
    })
  })
}

start().catch(error => {
  console.error("Failed to start Drop server:", error)
  process.exit(1)
})