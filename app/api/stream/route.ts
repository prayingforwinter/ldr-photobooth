// In-memory storage for rooms and streams (replace with a database in production)
const rooms = new Map<string, Set<string>>() // roomId -> Set<userId>
const streams = new Map<string, { userId: string; streamId: string; roomId: string; timestamp: number }>() // "roomId:userId" -> stream info
const userPositions = new Map<string, { x: number; y: number; width: number; height: number; rotation: number }>() // "roomId:userId" -> position

export async function POST(request: Request) {
  try {
    const { type, roomId, userId, data } = await request.json()

    console.log(`📡 Stream API: ${type} from ${userId} in room ${roomId}`)

    switch (type) {
      case "join":
        // Add user to room
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set())
        }
        rooms.get(roomId)!.add(userId)

        const participants = Array.from(rooms.get(roomId)!)
        console.log(`👥 Room ${roomId} participants:`, participants)

        return Response.json({
          success: true,
          participants: participants.filter((p) => p !== userId),
          totalParticipants: participants.length,
          streamServerUrl: process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL || "http://localhost:8080",
        })

      case "start-stream":
        // Register stream
        const streamKey = `${roomId}:${userId}`
        streams.set(streamKey, {
          userId,
          streamId: data.streamId,
          roomId,
          timestamp: Date.now(),
        })

        console.log(`📺 Stream registered: ${streamKey} -> ${data.streamId}`)

        return Response.json({
          success: true,
          streamId: data.streamId,
        })

      case "get-streams":
        // Get all streams in the room
        const roomStreams = Array.from(streams.entries())
          .filter(([key]) => key.startsWith(`${roomId}:`))
          .map(([key, stream]) => stream)
          .filter((stream) => stream.userId !== userId) // Filter out the requester's own stream

        console.log(`📋 Streams in room ${roomId} for ${userId}:`, roomStreams)

        return Response.json({
          success: true,
          streams: roomStreams,
        })

      case "update-position":
        // Update user's camera position
        const positionKey = `${roomId}:${userId}`
        userPositions.set(positionKey, data.position)

        console.log(`📍 Position updated for ${userId} in room ${roomId}:`, data.position)

        return Response.json({
          success: true,
          position: data.position,
        })

      case "get-positions":
        // Get all user positions in the room
        const roomPositions = Array.from(userPositions.entries())
          .filter(([key]) => key.startsWith(`${roomId}:`))
          .reduce(
            (acc, [key, position]) => {
              const userId = key.split(":")[1]
              acc[userId] = position
              return acc
            },
            {} as Record<string, any>,
          )

        console.log(`📍 Positions in room ${roomId}:`, roomPositions)

        return Response.json({
          success: true,
          positions: roomPositions,
        })

      case "leave":
        // Remove user from room and clean up streams
        if (rooms.has(roomId)) {
          rooms.get(roomId)!.delete(userId)
          if (rooms.get(roomId)!.size === 0) {
            rooms.delete(roomId)
          }
        }

        // Remove user's streams and positions
        const userStreamKey = `${roomId}:${userId}`
        const userPositionKey = `${roomId}:${userId}`
        streams.delete(userStreamKey)
        userPositions.delete(userPositionKey)

        console.log(`👋 User ${userId} left room ${roomId}`)

        return Response.json({ success: true })

      default:
        return Response.json({ error: "Unknown message type" }, { status: 400 })
    }
  } catch (error) {
    console.error("Stream API error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
