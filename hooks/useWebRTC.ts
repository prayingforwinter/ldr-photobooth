"use client"

import { useRef, useState, useCallback, useEffect } from "react"

interface UseWebRTCProps {
  roomId: string
  onRemoteStream: (stream: MediaStream) => void
  onConnectionStateChange: (state: string) => void
}

interface TurnCredentials {
  urls: string[]
  username: string
  credential: string
  ttl: number
}

export function useWebRTC({ roomId, onRemoteStream, onConnectionStateChange }: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const peerId = useRef<string>(`peer_${Math.random().toString(36).substr(2, 9)}`)
  const pollingInterval = useRef<NodeJS.Timeout | null>(null)
  const isInitiator = useRef<boolean>(false)
  const hasJoinedRoom = useRef<boolean>(false)
  const connectionAttempts = useRef<number>(0)
  const turnCredentials = useRef<TurnCredentials | null>(null)

  const fetchTurnCredentials = async (): Promise<TurnCredentials | null> => {
    try {
      const response = await fetch("/api/turn-credentials")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const credentials = await response.json()
      console.log(`🔑 [${peerId.current}] Fetched TURN credentials`)
      return credentials
    } catch (error) {
      console.error(`❌ [${peerId.current}] Failed to fetch TURN credentials:`, error)
      return null
    }
  }

  const getConfiguration = async (): Promise<RTCConfiguration> => {
    // Fetch fresh TURN credentials
    const credentials = await fetchTurnCredentials()
    turnCredentials.current = credentials

    const iceServers: RTCIceServer[] = [
      // Primary STUN server
      { urls: "stun:stun.l.google.com:19302" },
    ]

    // Add Oracle Cloud TURN server if credentials are available
    if (credentials) {
      iceServers.push({
        urls: credentials.urls,
        username: credentials.username,
        credential: credentials.credential,
      })
    }

    // Fallback public TURN server
    iceServers.push({
      urls: ["turn:turn.anyfirewall.com:443?transport=tcp"],
      username: "webrtc",
      credential: "webrtc",
    })

    return {
      iceServers,
      iceCandidatePoolSize: 10,
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    }
  }

  const sendSignalingMessage = async (type: string, data?: any) => {
    try {
      const response = await fetch("/api/signaling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          roomId,
          peerId: peerId.current,
          data,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log(`✅ [${peerId.current}] Sent ${type}:`, result)
      return result
    } catch (error) {
      console.error(`❌ [${peerId.current}] Signaling error for ${type}:`, error)
      throw error
    }
  }

  const testTurnServers = async () => {
    console.log(`🧪 [${peerId.current}] Testing TURN server connectivity...`)

    try {
      const configuration = await getConfiguration()
      const testPc = new RTCPeerConnection(configuration)

      // Create a data channel to trigger ICE gathering
      testPc.createDataChannel("test")

      // Create offer to start ICE gathering
      const offer = await testPc.createOffer()
      await testPc.setLocalDescription(offer)

      return new Promise((resolve) => {
        let hasRelay = false
        let timeout: NodeJS.Timeout

        testPc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log(`🧊 [${peerId.current}] Test candidate:`, event.candidate.type, event.candidate.candidate)
            if (event.candidate.type === "relay") {
              hasRelay = true
              console.log(`✅ [${peerId.current}] TURN server working - found relay candidate`)
              clearTimeout(timeout)
              testPc.close()
              resolve(true)
            }
          } else {
            // ICE gathering complete
            console.log(
              `${hasRelay ? "✅" : "❌"} [${peerId.current}] ICE gathering complete. TURN ${hasRelay ? "working" : "failed"}`,
            )
            clearTimeout(timeout)
            testPc.close()
            resolve(hasRelay)
          }
        }

        // Timeout after 8 seconds
        timeout = setTimeout(() => {
          console.log(`⏰ [${peerId.current}] TURN test timeout`)
          testPc.close()
          resolve(false)
        }, 8000)
      })
    } catch (error) {
      console.error(`❌ [${peerId.current}] TURN test error:`, error)
      return false
    }
  }

  const createPeerConnection = useCallback(async () => {
    console.log(`🔄 [${peerId.current}] Creating new peer connection...`)

    if (peerConnection.current) {
      console.log(`🗑️ [${peerId.current}] Closing existing peer connection`)
      peerConnection.current.close()
    }

    const configuration = await getConfiguration()
    console.log(`🔧 [${peerId.current}] ICE servers:`, configuration.iceServers)

    const pc = new RTCPeerConnection(configuration)
    peerConnection.current = pc

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log(`🧊 [${peerId.current}] Sending ICE candidate`)
        try {
          await sendSignalingMessage("ice-candidate", event.candidate)
        } catch (error) {
          console.error("Failed to send ICE candidate:", error)
        }
      } else {
        console.log(`🧊 [${peerId.current}] ICE gathering complete`)
      }
    }

    pc.ontrack = (event) => {
      console.log(`📹 [${peerId.current}] Received remote stream!`)
      const [remoteStream] = event.streams
      onRemoteStream(remoteStream)
      setIsConnected(true)
      setIsConnecting(false)
      connectionAttempts.current = 0
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.log(`🔗 [${peerId.current}] Connection state: ${state}`)
      onConnectionStateChange(state)

      switch (state) {
        case "connected":
          setIsConnected(true)
          setIsConnecting(false)
          setError(null)
          connectionAttempts.current = 0
          break
        case "connecting":
          setIsConnecting(true)
          setIsConnected(false)
          break
        case "disconnected":
          setIsConnected(false)
          setIsConnecting(false)
          break
        case "failed":
          setIsConnected(false)
          setIsConnecting(false)
          setError("Connection failed")
          connectionAttempts.current++

          // Auto-retry up to 3 times
          if (connectionAttempts.current < 3 && localStream && hasJoinedRoom.current) {
            console.log(`🔄 [${peerId.current}] Auto-retry attempt ${connectionAttempts.current}/3`)
            setTimeout(() => {
              retryConnection()
            }, 2000)
          }
          break
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 [${peerId.current}] ICE connection state: ${pc.iceConnectionState}`)
    }

    pc.onsignalingstatechange = () => {
      console.log(`📡 [${peerId.current}] Signaling state: ${pc.signalingState}`)
    }

    // Add local stream tracks
    if (localStream) {
      console.log(`➕ [${peerId.current}] Adding local stream tracks to peer connection`)
      localStream.getTracks().forEach((track) => {
        console.log(`  ➕ [${peerId.current}] Adding ${track.kind} track`)
        pc.addTrack(track, localStream)
      })
    } else {
      console.warn(`⚠️ [${peerId.current}] No local stream available when creating peer connection`)
    }

    return pc
  }, [localStream, onRemoteStream, onConnectionStateChange])

  const initializePeerConnection = useCallback(async () => {
    console.log(`🚀 [${peerId.current}] Initializing peer connection (isInitiator: ${isInitiator.current})`)

    if (!localStream) {
      console.error(`❌ [${peerId.current}] No local stream available for peer connection`)
      return
    }

    const pc = await createPeerConnection()

    // Wait for connection to be ready
    await new Promise((resolve) => setTimeout(resolve, 500))

    // If we're the initiator, create an offer
    if (isInitiator.current) {
      try {
        console.log(`📤 [${peerId.current}] Creating offer as initiator...`)
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        })
        await pc.setLocalDescription(offer)
        console.log(`📤 [${peerId.current}] Sending offer...`)
        await sendSignalingMessage("offer", offer)
      } catch (error) {
        console.error(`❌ [${peerId.current}] Error creating/sending offer:`, error)
        setError("Failed to create offer")
      }
    } else {
      console.log(`👂 [${peerId.current}] Waiting for offer as non-initiator...`)
    }
  }, [createPeerConnection, localStream])

  const pollForMessages = useCallback(async () => {
    if (!hasJoinedRoom.current) return

    try {
      const response = await sendSignalingMessage("get-messages")
      const { messages } = response

      if (messages.length > 0) {
        console.log(`📨 [${peerId.current}] Processing ${messages.length} messages`)
      }

      for (const message of messages) {
        console.log(`📨 [${peerId.current}] Processing ${message.type} from ${message.from}`)

        // Ensure we have a peer connection for incoming messages
        if (!peerConnection.current && localStream) {
          console.log(`🔄 [${peerId.current}] Creating peer connection for incoming message`)
          await createPeerConnection()
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        switch (message.type) {
          case "offer":
            if (peerConnection.current) {
              try {
                console.log(`📥 [${peerId.current}] Processing offer...`)
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(message.data))
                console.log(`📤 [${peerId.current}] Creating answer...`)
                const answer = await peerConnection.current.createAnswer()
                await peerConnection.current.setLocalDescription(answer)
                console.log(`📤 [${peerId.current}] Sending answer...`)
                await sendSignalingMessage("answer", answer)
              } catch (error) {
                console.error(`❌ [${peerId.current}] Error processing offer:`, error)
              }
            }
            break

          case "answer":
            if (peerConnection.current && peerConnection.current.signalingState === "have-local-offer") {
              try {
                console.log(`📥 [${peerId.current}] Processing answer...`)
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(message.data))
              } catch (error) {
                console.error(`❌ [${peerId.current}] Error processing answer:`, error)
              }
            }
            break

          case "ice-candidate":
            if (peerConnection.current && peerConnection.current.remoteDescription) {
              try {
                console.log(`🧊 [${peerId.current}] Adding ICE candidate...`)
                await peerConnection.current.addIceCandidate(new RTCIceCandidate(message.data))
              } catch (error) {
                console.error(`❌ [${peerId.current}] Error adding ICE candidate:`, error)
              }
            } else {
              console.log(`⏳ [${peerId.current}] Queuing ICE candidate (no remote description yet)`)
            }
            break
        }
      }
    } catch (error) {
      console.error(`❌ [${peerId.current}] Polling error:`, error)
    }
  }, [createPeerConnection, localStream])

  const startLocalVideo = async () => {
    try {
      setError(null)
      console.log(`📹 [${peerId.current}] Requesting camera access...`)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      console.log(`✅ [${peerId.current}] Camera access granted`)
      setLocalStream(stream)
      return stream
    } catch (err) {
      console.error(`❌ [${peerId.current}] Camera access error:`, err)
      const errorMessage = err instanceof Error ? err.message : "Failed to access camera"
      setError(errorMessage)
      throw err
    }
  }

  const joinRoom = async () => {
    if (hasJoinedRoom.current) {
      console.log(`⚠️ [${peerId.current}] Already joined room, skipping...`)
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

      // Test TURN servers before joining
      console.log(`🧪 [${peerId.current}] Testing TURN connectivity before joining...`)
      const turnWorking = await testTurnServers()

      if (!turnWorking) {
        console.warn(`⚠️ [${peerId.current}] TURN servers not responding - connection may fail behind NAT`)
        setError("TURN servers not responding - connection may fail")
      }

      console.log(`🚪 [${peerId.current}] Joining room: ${roomId}`)
      const joinResponse = await sendSignalingMessage("join")
      const { participants, totalParticipants, isFirstParticipant } = joinResponse

      console.log(
        `🏠 [${peerId.current}] Room joined! Participants: ${totalParticipants}, First: ${isFirstParticipant}`,
      )
      console.log(`👥 [${peerId.current}] Other participants:`, participants)

      hasJoinedRoom.current = true
      isInitiator.current = isFirstParticipant || participants.length === 0

      console.log(`👑 [${peerId.current}] Am I the initiator? ${isInitiator.current}`)

      // Always initialize peer connection when joining
      await initializePeerConnection()

      // Start polling for messages
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current)
      }
      pollingInterval.current = setInterval(pollForMessages, 1000)

      console.log(`✅ [${peerId.current}] Successfully joined room and started polling`)
    } catch (err) {
      console.error(`❌ [${peerId.current}] Failed to join room:`, err)
      setError(`Failed to join room: ${err instanceof Error ? err.message : "Unknown error"}`)
      setIsConnecting(false)
      hasJoinedRoom.current = false
    }
  }

  const retryConnection = useCallback(async () => {
    console.log(`🔄 [${peerId.current}] Retrying connection...`)

    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }

    setIsConnecting(true)
    setError(null)

    // Wait a bit before retrying
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (localStream && hasJoinedRoom.current) {
      await initializePeerConnection()
    }
  }, [initializePeerConnection, localStream])

  const leaveRoom = async () => {
    console.log(`🚪 [${peerId.current}] Leaving room...`)

    try {
      if (hasJoinedRoom.current) {
        await sendSignalingMessage("leave")
      }
    } catch (error) {
      console.error(`❌ [${peerId.current}] Error leaving room:`, error)
    }

    hasJoinedRoom.current = false
    connectionAttempts.current = 0

    if (pollingInterval.current) {
      clearInterval(pollingInterval.current)
      pollingInterval.current = null
    }

    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
    }

    setIsConnected(false)
    setIsConnecting(false)
    setError(null)
  }

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
    startLocalVideo,
    joinRoom,
    leaveRoom,
    retryConnection,
    peerConnection: peerConnection.current,
    turnCredentials: turnCredentials.current,
  }
}
