"use client"

import { useRef, useState, useCallback, useEffect } from "react"

interface UseOracleStreamProps {
  roomId: string
  onRemoteStream: (streamUrl: string, userId: string) => void
  onConnectionStateChange: (state: string) => void
}

interface StreamInfo {
  userId: string
  streamId: string
  streamUrl: string
}

export function useOracleStream({ roomId, onRemoteStream, onConnectionStateChange }: UseOracleStreamProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<StreamInfo[]>([])

  const userId = useRef<string>(`user_${Math.random().toString(36).substr(2, 9)}`)
  const pollingInterval = useRef<NodeJS.Timeout | null>(null)
  const hasJoinedRoom = useRef<boolean>(false)
  const streamServerUrl = useRef<string>("")
  const localStreamId = useRef<string>("")
  const previousStreams = useRef<Set<string>>(new Set())

  const sendStreamMessage = async (type: string, data?: any) => {
    try {
      const response = await fetch("/api/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          roomId,
          userId: userId.current,
          data,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log(`✅ [${userId.current}] Sent ${type}:`, result)
      return result
    } catch (error) {
      console.error(`❌ [${userId.current}] Stream API error for ${type}:`, error)
      throw error
    }
  }

  const startLocalVideo = async () => {
    try {
      setError(null)
      console.log(`📹 [${userId.current}] Requesting camera access...`)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: "user",
        },
        audio: false, // No audio for now
      })

      console.log(`✅ [${userId.current}] Camera access granted`)
      setLocalStream(stream)
      return stream
    } catch (err) {
      console.error(`❌ [${userId.current}] Camera access error:`, err)
      const errorMessage = err instanceof Error ? err.message : "Failed to access camera"
      setError(errorMessage)
      throw err
    }
  }

  const startStreamToServer = async () => {
    if (!localStream) {
      console.error("No local stream available")
      return
    }

    try {
      console.log(`🚀 [${userId.current}] Starting stream to Oracle server...`)

      // Generate unique stream ID
      localStreamId.current = `stream_${userId.current}_${Date.now()}`

      // In a real implementation, you would:
      // 1. Create WebSocket connection to Oracle VM
      // 2. Send video frames via WebSocket or WebRTC to Oracle server
      // 3. Oracle server processes frames with filters
      // 4. Oracle server streams processed video back

      // For now, we'll simulate this
      await sendStreamMessage("start-stream", {
        streamId: localStreamId.current,
      })

      console.log(`✅ [${userId.current}] Stream started: ${localStreamId.current}`)
      setIsConnected(true)
      onConnectionStateChange("connected")
    } catch (error) {
      console.error(`❌ [${userId.current}] Failed to start stream:`, error)
      setError("Failed to start stream to server")
      onConnectionStateChange("failed")
    }
  }

  const pollForStreams = useCallback(async () => {
    if (!hasJoinedRoom.current) return

    try {
      const response = await sendStreamMessage("get-streams")
      const { streams } = response

      // Filter out our own stream
      const otherStreams = streams.filter((stream: any) => stream.userId !== userId.current)

      // Update remote streams
      const newStreams = otherStreams.map((stream: any) => {
        // Create a fake stream URL for testing
        // In production, this would be a real URL from your Oracle server
        const streamUrl = stream.streamId
          ? `${process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL || "http://localhost:8080"}/stream/${stream.streamId}`
          : null

        return {
          userId: stream.userId,
          streamId: stream.streamId,
          streamUrl: streamUrl,
        }
      })

      // Check if we have new streams
      const currentStreamIds = new Set(newStreams.map((s: StreamInfo) => s.streamId))
      const hasNewStreams = newStreams.some((stream: StreamInfo) => !previousStreams.current.has(stream.streamId))

      // Update previous streams
      previousStreams.current = currentStreamIds

      if (hasNewStreams || newStreams.length !== remoteStreams.length) {
        console.log(`📺 [${userId.current}] Found ${newStreams.length} remote streams:`, newStreams)
        setRemoteStreams(newStreams)

        // Notify about new streams
        newStreams.forEach((stream: StreamInfo) => {
          if (stream.streamUrl) {
            console.log(`🔗 [${userId.current}] Notifying about stream: ${stream.streamUrl}`)
            onRemoteStream(stream.streamUrl, stream.userId)
          }
        })
      }
    } catch (error) {
      console.error(`❌ [${userId.current}] Polling error:`, error)
    }
  }, [onRemoteStream, remoteStreams.length])

  const joinRoom = async () => {
    if (hasJoinedRoom.current) {
      console.log(`⚠️ [${userId.current}] Already joined room, skipping...`)
      return
    }

    try {
      setIsConnecting(true)
      setError(null)

      if (!localStream) {
        throw new Error("Local stream not available")
      }

      if (!roomId) {
        throw new Error("No room ID provided")
      }

      console.log(`🚪 [${userId.current}] Joining room: ${roomId}`)
      const joinResponse = await sendStreamMessage("join")
      const { participants, totalParticipants, streamServerUrl: serverUrl } = joinResponse

      console.log(`🏠 [${userId.current}] Room joined! Participants: ${totalParticipants}`)
      console.log(`👥 [${userId.current}] Other participants:`, participants)

      // Use the server URL from the response or fall back to environment variable
      streamServerUrl.current = serverUrl || process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL || "http://localhost:8080"
      hasJoinedRoom.current = true

      // Start streaming to Oracle server
      await startStreamToServer()

      // Start polling for other streams
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current)
      }

      // Poll immediately and then every 2 seconds
      await pollForStreams()
      pollingInterval.current = setInterval(pollForStreams, 2000)

      console.log(`✅ [${userId.current}] Successfully joined room and started streaming`)
      setIsConnecting(false)
    } catch (err) {
      console.error(`❌ [${userId.current}] Failed to join room:`, err)
      setError(`Failed to join room: ${err instanceof Error ? err.message : "Unknown error"}`)
      setIsConnecting(false)
      hasJoinedRoom.current = false
    }
  }

  const leaveRoom = async () => {
    console.log(`🚪 [${userId.current}] Leaving room...`)

    try {
      if (hasJoinedRoom.current) {
        await sendStreamMessage("leave")
      }
    } catch (error) {
      console.error(`❌ [${userId.current}] Error leaving room:`, error)
    }

    hasJoinedRoom.current = false

    if (pollingInterval.current) {
      clearInterval(pollingInterval.current)
      pollingInterval.current = null
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
    }

    setIsConnected(false)
    setIsConnecting(false)
    setError(null)
    setRemoteStreams([])
    previousStreams.current.clear()
    localStreamId.current = ""
  }

  const retryConnection = useCallback(async () => {
    console.log(`🔄 [${userId.current}] Retrying connection...`)

    setIsConnecting(true)
    setError(null)

    // Wait a bit before retrying
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (localStream && !hasJoinedRoom.current) {
      await joinRoom()
    } else if (localStream && hasJoinedRoom.current) {
      await startStreamToServer()
    }

    setIsConnecting(false)
  }, [localStream])

  useEffect(() => {
    return () => {
      leaveRoom()
    }
  }, [])

  return {
    localStream,
    isConnected,
    isConnecting,
    error,
    remoteStreams,
    startLocalVideo,
    joinRoom,
    leaveRoom,
    retryConnection,
    streamServerUrl: streamServerUrl.current,
    localStreamId: localStreamId.current,
    userId: userId.current,
  }
}
