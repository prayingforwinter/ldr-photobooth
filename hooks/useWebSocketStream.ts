"use client"

import { useRef, useState, useCallback, useEffect } from "react"

interface UseWebSocketStreamProps {
  roomId: string
  onRemoteStream: (stream: MediaStream, userId: string) => void
  onConnectionStateChange: (state: string) => void
  onPositionUpdate: (userId: string, position: any) => void
}

export function useWebSocketStream({
  roomId,
  onRemoteStream,
  onConnectionStateChange,
  onPositionUpdate,
}: UseWebSocketStreamProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<string[]>([])

  const userId = useRef<string>(`user_${Math.random().toString(36).substr(2, 9)}`)
  const websocket = useRef<WebSocket | null>(null)
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const hasJoinedRoom = useRef<boolean>(false)
  const localStreamId = useRef<string>("")

  const getWebSocketUrl = () => {
    const serverUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL || ""

    if (serverUrl.startsWith("ws://") || serverUrl.startsWith("wss://")) {
      return serverUrl
    } else if (serverUrl.startsWith("http://")) {
      return serverUrl.replace("http://", "ws://")
    } else if (serverUrl.startsWith("https://")) {
      return serverUrl.replace("https://", "wss://")
    } else {
      // Default to WebSocket
      return `ws://${serverUrl}`
    }
  }

  const connectWebSocket = useCallback(() => {
    const wsUrl = getWebSocketUrl()
    console.log(`🔌 [${userId.current}] Connecting to WebSocket: ${wsUrl}`)

    try {
      websocket.current = new WebSocket(wsUrl)

      websocket.current.onopen = () => {
        console.log(`✅ [${userId.current}] WebSocket connected`)
        setIsConnected(true)
        setError(null)
        onConnectionStateChange("connected")
      }

      websocket.current.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data)
          await handleWebSocketMessage(message)
        } catch (error) {
          console.error(`❌ [${userId.current}] Error parsing WebSocket message:`, error)
        }
      }

      websocket.current.onclose = (event) => {
        console.log(`🔌 [${userId.current}] WebSocket closed:`, event.code, event.reason)
        setIsConnected(false)
        onConnectionStateChange("disconnected")

        // Attempt to reconnect after 3 seconds
        if (!event.wasClean) {
          setTimeout(() => {
            if (hasJoinedRoom.current) {
              connectWebSocket()
            }
          }, 3000)
        }
      }

      websocket.current.onerror = (error) => {
        console.error(`❌ [${userId.current}] WebSocket error:`, error)
        setError("WebSocket connection failed")
        setIsConnected(false)
        onConnectionStateChange("failed")
      }
    } catch (error) {
      console.error(`❌ [${userId.current}] Failed to create WebSocket:`, error)
      setError("Failed to create WebSocket connection")
    }
  }, [onConnectionStateChange])

  const sendWebSocketMessage = (message: any) => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      websocket.current.send(JSON.stringify(message))
      console.log(`📤 [${userId.current}] Sent WebSocket message:`, message.type)
    } else {
      console.warn(`⚠️ [${userId.current}] WebSocket not ready, message not sent:`, message.type)
    }
  }

  const handleWebSocketMessage = async (message: any) => {
    console.log(`📥 [${userId.current}] Received WebSocket message:`, message.type)

    switch (message.type) {
      case "connected":
        console.log(`🎉 [${userId.current}] Connected to server:`, message.message)
        break

      case "user-joined":
        console.log(`👤 [${userId.current}] User joined:`, message.userId)
        if (message.userId !== userId.current) {
          await createPeerConnection(message.userId)
        }
        break

      case "user-left":
        console.log(`👋 [${userId.current}] User left:`, message.userId)
        closePeerConnection(message.userId)
        break

      case "offer":
        await handleOffer(message.from, message.offer)
        break

      case "answer":
        await handleAnswer(message.from, message.answer)
        break

      case "ice-candidate":
        await handleIceCandidate(message.from, message.candidate)
        break

      case "position-update":
        onPositionUpdate(message.from, message.position)
        break

      case "error":
        console.error(`❌ [${userId.current}] Server error:`, message.message)
        setError(message.message)
        break

      default:
        console.warn(`⚠️ [${userId.current}] Unknown message type:`, message.type)
    }
  }

  const createPeerConnection = async (remoteUserId: string) => {
    console.log(`🔗 [${userId.current}] Creating peer connection with ${remoteUserId}`)

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    })

    peerConnections.current.set(remoteUserId, pc)

    // Add local stream to peer connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream)
      })
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log(`📹 [${userId.current}] Received remote stream from ${remoteUserId}`)
      const [remoteStream] = event.streams
      onRemoteStream(remoteStream, remoteUserId)
      setRemoteStreams((prev) => [...prev.filter((id) => id !== remoteUserId), remoteUserId])
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendWebSocketMessage({
          type: "ice-candidate",
          to: remoteUserId,
          candidate: event.candidate,
        })
      }
    }

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`🔗 [${userId.current}] Peer connection state with ${remoteUserId}:`, pc.connectionState)
    }

    // Create offer if we're the initiator (user with smaller ID)
    if (userId.current < remoteUserId) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendWebSocketMessage({
        type: "offer",
        to: remoteUserId,
        offer: offer,
      })
    }
  }

  const handleOffer = async (from: string, offer: RTCSessionDescriptionInit) => {
    console.log(`📥 [${userId.current}] Handling offer from ${from}`)

    let pc = peerConnections.current.get(from)
    if (!pc) {
      await createPeerConnection(from)
      pc = peerConnections.current.get(from)!
    }

    await pc.setRemoteDescription(offer)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    sendWebSocketMessage({
      type: "answer",
      to: from,
      answer: answer,
    })
  }

  const handleAnswer = async (from: string, answer: RTCSessionDescriptionInit) => {
    console.log(`📥 [${userId.current}] Handling answer from ${from}`)

    const pc = peerConnections.current.get(from)
    if (pc) {
      await pc.setRemoteDescription(answer)
    }
  }

  const handleIceCandidate = async (from: string, candidate: RTCIceCandidateInit) => {
    console.log(`🧊 [${userId.current}] Handling ICE candidate from ${from}`)

    const pc = peerConnections.current.get(from)
    if (pc) {
      await pc.addIceCandidate(candidate)
    }
  }

  const closePeerConnection = (remoteUserId: string) => {
    const pc = peerConnections.current.get(remoteUserId)
    if (pc) {
      pc.close()
      peerConnections.current.delete(remoteUserId)
    }
    setRemoteStreams((prev) => prev.filter((id) => id !== remoteUserId))
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
        audio: true, // Enable audio for better experience
      })

      console.log(`✅ [${userId.current}] Camera access granted`)
      setLocalStream(stream)
      localStreamId.current = `stream_${userId.current}_${Date.now()}`
      return stream
    } catch (err) {
      console.error(`❌ [${userId.current}] Camera access error:`, err)
      const errorMessage = err instanceof Error ? err.message : "Failed to access camera"
      setError(errorMessage)
      throw err
    }
  }

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

      // Connect WebSocket first
      connectWebSocket()

      // Wait for WebSocket connection
      await new Promise((resolve, reject) => {
        const checkConnection = () => {
          if (websocket.current?.readyState === WebSocket.OPEN) {
            resolve(true)
          } else if (websocket.current?.readyState === WebSocket.CLOSED) {
            reject(new Error("WebSocket connection failed"))
          } else {
            setTimeout(checkConnection, 100)
          }
        }
        checkConnection()
      })

      // Join room via WebSocket
      sendWebSocketMessage({
        type: "join-room",
        roomId,
        userId: userId.current,
      })

      hasJoinedRoom.current = true
      console.log(`✅ [${userId.current}] Successfully joined room: ${roomId}`)
      setIsConnecting(false)
    } catch (err) {
      console.error(`❌ [${userId.current}] Failed to join room:`, err)
      setError(`Failed to join room: ${err instanceof Error ? err.message : "Unknown error"}`)
      setIsConnecting(false)
      hasJoinedRoom.current = false
    }
  }

  const updatePosition = async (position: any) => {
    if (!hasJoinedRoom.current || !isConnected) return

    sendWebSocketMessage({
      type: "position-update",
      position,
    })
  }

  const leaveRoom = async () => {
    console.log(`🚪 [${userId.current}] Leaving room...`)

    hasJoinedRoom.current = false

    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close())
    peerConnections.current.clear()

    // Close WebSocket
    if (websocket.current) {
      websocket.current.close()
      websocket.current = null
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
    }

    setIsConnected(false)
    setIsConnecting(false)
    setError(null)
    setRemoteStreams([])
    localStreamId.current = ""
  }

  const retryConnection = useCallback(async () => {
    console.log(`🔄 [${userId.current}] Retrying connection...`)

    setIsConnecting(true)
    setError(null)

    // Close existing connections
    if (websocket.current) {
      websocket.current.close()
    }

    // Wait a bit before retrying
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (localStream && roomId) {
      hasJoinedRoom.current = false
      await joinRoom()
    }

    setIsConnecting(false)
  }, [localStream, roomId])

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
    updatePosition,
    userId: userId.current,
  }
}
