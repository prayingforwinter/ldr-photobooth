import { type NextRequest, NextResponse } from "next/server"

// In-memory storage for demo (use Redis/database in production)
const rooms = new Map<
  string,
  {
    participants: Set<string>
    streams: Map<string, { streamId: string; lastActivity: number }>
    lastActivity: number
  }
>()

// Clean up old rooms every 5 minutes
setInterval(
  () => {
    const now = Date.now()
    const ROOM_TIMEOUT = 30 * 60 * 1000 // 30 minutes

    for (const [roomId, room] of rooms.entries()) {
      if (now - room.lastActivity > ROOM_TIMEOUT) {
        rooms.delete(roomId)
        console.log(`Cleaned up room: ${roomId}`)
      }
    }
  },
  5 * 60 * 1000,
)

export async function POST(request: NextRequest) {
  try {
    const { type, roomId, userId, data } = await request.json()

    console.log(`Stream API: ${type} from ${userId} in room ${roomId}`)

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: new Set(),
        streams: new Map(),
        lastActivity: Date.now(),
      })
    }

    const room = rooms.get(roomId)!
    room.lastActivity = Date.now()

    switch (type) {
      case "join":
        room.participants.add(userId)
        console.log(`Room ${roomId} participants:`, Array.from(room.participants))

        return NextResponse.json({
          success: true,
          participants: Array.from(room.participants).filter((id) => id !== userId),
          totalParticipants: room.participants.size,
          streamServerUrl: process.env.ORACLE_STREAM_SERVER_URL || "ws://localhost:8080",
        })

      case "start-stream":
        room.streams.set(userId, {
          streamId: data.streamId,
          lastActivity: Date.now(),
        })
        console.log(`Started stream for ${userId}: ${data.streamId}`)
        return NextResponse.json({ success: true })

      case "stop-stream":
        room.streams.delete(userId)
        console.log(`Stopped stream for ${userId}`)
        return NextResponse.json({ success: true })

      case "get-streams":
        const activeStreams = Array.from(room.streams.entries())
          .filter(([id]) => id !== userId)
          .map(([id, stream]) => ({
            userId: id,
            streamId: stream.streamId,
          }))

        return NextResponse.json({ streams: activeStreams })

      case "leave":
        room.participants.delete(userId)
        room.streams.delete(userId)
        console.log(`${userId} left room ${roomId}`)
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json({ error: "Unknown message type" }, { status: 400 })
    }
  } catch (error) {
    console.error("Stream API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
