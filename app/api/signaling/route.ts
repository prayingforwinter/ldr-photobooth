import { type NextRequest, NextResponse } from "next/server"

// In-memory storage for demo (use Redis/database in production)
const rooms = new Map<
  string,
  {
    participants: Set<string>
    offers: Map<string, any>
    answers: Map<string, any>
    iceCandidates: Map<string, any[]>
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
    const { type, roomId, peerId, data } = await request.json()

    console.log(`Signaling: ${type} from ${peerId} in room ${roomId}`)

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: new Set(),
        offers: new Map(),
        answers: new Map(),
        iceCandidates: new Map(),
        lastActivity: Date.now(),
      })
    }

    const room = rooms.get(roomId)!
    room.lastActivity = Date.now()

    switch (type) {
      case "join":
        room.participants.add(peerId)
        if (!room.iceCandidates.has(peerId)) {
          room.iceCandidates.set(peerId, [])
        }

        const otherParticipants = Array.from(room.participants).filter((id) => id !== peerId)
        console.log(`Room ${roomId} participants:`, Array.from(room.participants))
        console.log(`Other participants for ${peerId}:`, otherParticipants)

        return NextResponse.json({
          success: true,
          participants: otherParticipants,
          totalParticipants: room.participants.size,
          isFirstParticipant: otherParticipants.length === 0,
        })

      case "offer":
        room.offers.set(peerId, data)
        console.log(`Stored offer from ${peerId}`)
        return NextResponse.json({ success: true })

      case "answer":
        room.answers.set(peerId, data)
        console.log(`Stored answer from ${peerId}`)
        return NextResponse.json({ success: true })

      case "ice-candidate":
        const candidates = room.iceCandidates.get(peerId) || []
        candidates.push(data)
        room.iceCandidates.set(peerId, candidates)
        console.log(`Stored ICE candidate from ${peerId}`)
        return NextResponse.json({ success: true })

      case "get-messages":
        const messages = []

        // Get messages from all other participants
        for (const participantId of room.participants) {
          if (participantId === peerId) continue

          // Get offer from this participant
          if (room.offers.has(participantId)) {
            messages.push({
              type: "offer",
              from: participantId,
              data: room.offers.get(participantId),
            })
            room.offers.delete(participantId) // Clear after reading
          }

          // Get answer from this participant
          if (room.answers.has(participantId)) {
            messages.push({
              type: "answer",
              from: participantId,
              data: room.answers.get(participantId),
            })
            room.answers.delete(participantId) // Clear after reading
          }

          // Get ICE candidates from this participant
          const iceCandidates = room.iceCandidates.get(participantId) || []
          iceCandidates.forEach((candidate) => {
            messages.push({
              type: "ice-candidate",
              from: participantId,
              data: candidate,
            })
          })
          room.iceCandidates.set(participantId, []) // Clear after reading
        }

        console.log(`Returning ${messages.length} messages for ${peerId}`)
        return NextResponse.json({ messages })

      case "leave":
        room.participants.delete(peerId)
        room.offers.delete(peerId)
        room.answers.delete(peerId)
        room.iceCandidates.delete(peerId)
        console.log(`${peerId} left room ${roomId}`)
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json({ error: "Unknown message type" }, { status: 400 })
    }
  } catch (error) {
    console.error("Signaling error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
