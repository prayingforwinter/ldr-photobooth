const WebSocket = require("ws")
const express = require("express")
const http = require("http")
const cors = require("cors")

const app = express()
const server = http.createServer(app)

// Enable CORS
app.use(
  cors({
    origin: [
      "https://ldrphotobooththingy.vercel.app",
      "https://*.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "User-Agent"],
  }),
)

app.use(express.json({ limit: "50mb" }))

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    totalConnections: connections.size,
    server: "Oracle WebSocket Photobooth Server",
    version: "3.0.0",
  })
})

// WebSocket server
const wss = new WebSocket.Server({
  server,
  maxPayload: 50 * 1024 * 1024, // 50MB max payload
})

// Store rooms and connections
const rooms = new Map() // roomId -> Set<userId>
const connections = new Map() // userId -> { ws, roomId }

wss.on("connection", (ws, req) => {
  const clientIP = req.socket.remoteAddress
  console.log(`🔗 WebSocket client connected from ${clientIP}`)

  let userId = null
  let roomId = null

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message)
      console.log(`📥 Received message: ${data.type} from ${data.userId || "unknown"}`)

      switch (data.type) {
        case "join-room":
          userId = data.userId
          roomId = data.roomId

          // Add user to room
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set())
          }
          rooms.get(roomId).add(userId)

          // Store connection
          connections.set(userId, { ws, roomId })

          console.log(`👤 User ${userId} joined room ${roomId}`)

          // Notify user they're connected
          ws.send(
            JSON.stringify({
              type: "connected",
              message: "Successfully joined room",
              roomId,
              userId,
            }),
          )

          // Notify other users in the room
          const otherUsers = Array.from(rooms.get(roomId)).filter((id) => id !== userId)
          otherUsers.forEach((otherUserId) => {
            const otherConnection = connections.get(otherUserId)
            if (otherConnection && otherConnection.ws.readyState === WebSocket.OPEN) {
              otherConnection.ws.send(
                JSON.stringify({
                  type: "user-joined",
                  userId: userId,
                }),
              )
            }
          })

          // Tell the new user about existing users
          otherUsers.forEach((otherUserId) => {
            ws.send(
              JSON.stringify({
                type: "user-joined",
                userId: otherUserId,
              }),
            )
          })

          break

        case "offer":
        case "answer":
        case "ice-candidate":
          // Forward WebRTC signaling messages
          const targetConnection = connections.get(data.to)
          if (targetConnection && targetConnection.ws.readyState === WebSocket.OPEN) {
            targetConnection.ws.send(
              JSON.stringify({
                type: data.type,
                from: userId,
                [data.type]: data[data.type] || data.candidate,
                offer: data.offer,
                answer: data.answer,
                candidate: data.candidate,
              }),
            )
            console.log(`📡 Forwarded ${data.type} from ${userId} to ${data.to}`)
          } else {
            console.warn(`⚠️ Target user ${data.to} not found or disconnected`)
          }
          break

        case "position-update":
          // Broadcast position updates to other users in the room
          if (roomId && rooms.has(roomId)) {
            const otherUsers = Array.from(rooms.get(roomId)).filter((id) => id !== userId)
            otherUsers.forEach((otherUserId) => {
              const otherConnection = connections.get(otherUserId)
              if (otherConnection && otherConnection.ws.readyState === WebSocket.OPEN) {
                otherConnection.ws.send(
                  JSON.stringify({
                    type: "position-update",
                    from: userId,
                    position: data.position,
                  }),
                )
              }
            })
          }
          break

        case "ping":
          ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }))
          break

        default:
          console.warn(`⚠️ Unknown message type: ${data.type}`)
          ws.send(
            JSON.stringify({
              type: "error",
              message: `Unknown message type: ${data.type}`,
            }),
          )
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error)
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Failed to process message",
        }),
      )
    }
  })

  ws.on("close", () => {
    console.log(`🔌 WebSocket client disconnected: ${userId || "unknown"}`)

    if (userId && roomId) {
      // Remove user from room
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(userId)
        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId)
        }
      }

      // Remove connection
      connections.delete(userId)

      // Notify other users in the room
      if (rooms.has(roomId)) {
        const otherUsers = Array.from(rooms.get(roomId))
        otherUsers.forEach((otherUserId) => {
          const otherConnection = connections.get(otherUserId)
          if (otherConnection && otherConnection.ws.readyState === WebSocket.OPEN) {
            otherConnection.ws.send(
              JSON.stringify({
                type: "user-left",
                userId: userId,
              }),
            )
          }
        })
      }
    }
  })

  ws.on("error", (error) => {
    console.error(`WebSocket error for ${userId || "unknown"}:`, error)
  })
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully...")
  server.close(() => {
    console.log("✅ Server closed")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully...")
  server.close(() => {
    console.log("✅ Server closed")
    process.exit(0)
  })
})

const PORT = process.env.PORT || 8080
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Oracle WebSocket Photobooth Server running on port ${PORT}`)
  console.log(`📡 WebSocket server ready for connections`)
  console.log(`🔗 Health check: http://localhost:${PORT}/health`)
  console.log(`🎥 Direct WebRTC peer-to-peer video streaming`)
})
