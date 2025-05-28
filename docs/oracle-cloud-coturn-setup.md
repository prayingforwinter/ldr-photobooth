# Oracle Cloud Coturn Setup Guide

## Oracle Cloud Free Tier Resources
- 2 AMD VM instances (1 GB RAM each)
- 4 Arm-based Ampere A1 cores (24 GB RAM total)
- Always Free - No time limits!

## Step 1: Create Oracle Cloud VM

1. Sign up for Oracle Cloud (if you haven't already)
2. Create a new VM instance:
   - Shape: VM.Standard.A1.Flex (Arm-based - more resources)
   - CPU: 2-4 cores
   - Memory: 8-12 GB
   - Image: Ubuntu 22.04
   - Assign a public IP

## Step 2: Configure Security Rules

In Oracle Cloud Console:
1. Go to Networking > Virtual Cloud Networks
2. Select your VCN > Security Lists > Default Security List
3. Add Ingress Rules:
   - Port 3478 (UDP/TCP) - STUN/TURN
   - Port 5349 (UDP/TCP) - TURN over TLS
   - Port 49152-65535 (UDP) - TURN relay ports

## Step 3: Install and Configure Coturn

SSH into your VM and run these commands:

\`\`\`bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Coturn
sudo apt install coturn -y

# Enable Coturn service
sudo systemctl enable coturn

# Create Coturn configuration
sudo tee /etc/turnserver.conf > /dev/null << 'EOF'
# Oracle Cloud Coturn Configuration
listening-port=3478
tls-listening-port=5349

# Use your Oracle Cloud VM's external IP
external-ip=YOUR_ORACLE_VM_PUBLIC_IP
listening-ip=0.0.0.0

# Relay ports range
min-port=49152
max-port=65535

# Authentication
use-auth-secret
static-auth-secret=your-super-secret-key-change-this

# Security
no-multicast-peers
no-loopback-peers
no-stdout-log

# Database (optional, for persistent users)
# userdb=/var/lib/turn/turndb

# Verbosity
verbose

# Realm
realm=yourdomain.com

# Additional security
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=224.0.0.0-239.255.255.255
denied-peer-ip=240.0.0.0-255.255.255.255

# Process limits
proc-user=turnserver
proc-group=turnserver
EOF

# Replace placeholder values
read -p "Enter your Oracle VM's public IP: " PUBLIC_IP
read -p "Enter a strong secret key: " SECRET_KEY
read -p "Enter your domain (or use the IP): " DOMAIN

sudo sed -i "s/YOUR_ORACLE_VM_PUBLIC_IP/$PUBLIC_IP/g" /etc/turnserver.conf
sudo sed -i "s/your-super-secret-key-change-this/$SECRET_KEY/g" /etc/turnserver.conf
sudo sed -i "s/yourdomain.com/$DOMAIN/g" /etc/turnserver.conf

# Start Coturn
sudo systemctl start coturn
sudo systemctl status coturn

# Test if it's working
sudo journalctl -u coturn -f
\`\`\`

## Step 4: Test Your TURN Server

\`\`\`bash
# Install test tools
sudo apt install coturn-utils -y

# Test STUN
turnutils_stunclient YOUR_ORACLE_VM_PUBLIC_IP

# Test TURN
turnutils_uclient -t -T -s -v YOUR_ORACLE_VM_PUBLIC_IP
\`\`\`

## Step 5: Configure Firewall (Ubuntu)

\`\`\`bash
# Configure UFW
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 5349/udp
sudo ufw allow 5349/tcp
sudo ufw allow 49152:65535/udp
sudo ufw enable
\`\`\`

## Environment Variables for Your App

Add these to your Vercel environment variables:
\`\`\`
NEXT_PUBLIC_TURN_SERVER_URL=turn:YOUR_ORACLE_VM_PUBLIC_IP:3478
NEXT_PUBLIC_TURN_SERVER_USERNAME=webrtc
NEXT_PUBLIC_TURN_SERVER_CREDENTIAL=your-super-secret-key-change-this
\`\`\`

**Important:** Make sure to include the `turn:` prefix in the URL!

Example:
\`\`\`
NEXT_PUBLIC_TURN_SERVER_URL=turn:168.138.103.248:3478
NEXT_PUBLIC_TURN_SERVER_USERNAME=webrtc
NEXT_PUBLIC_TURN_SERVER_CREDENTIAL=mySecretKey123
\`\`\`

## Monitoring and Maintenance

\`\`\`bash
# Check Coturn logs
sudo journalctl -u coturn

# Restart if needed
sudo systemctl restart coturn

# Check resource usage
htop
\`\`\`

## Cost: FREE! 
Oracle's Always Free tier includes this VM forever!

## Troubleshooting 401 Unauthorized Error

If you see this error in your Coturn logs:
\`\`\`
session 000000000000000003: realm <photoboothappthingyforldr.vercel.app> user <>: incoming packet message processed, error 401: Unauthorized
\`\`\`

This means authentication is failing. Here's how to fix it:

### 1. Check Your Coturn Configuration

\`\`\`bash
# View your current config
sudo cat /etc/turnserver.conf | grep -E "(static-auth-secret|realm|use-auth-secret)"

# Should show:
# use-auth-secret
# static-auth-secret=your-secret-key
# realm=your-domain-or-ip
\`\`\`

### 2. Update Coturn Configuration for WebRTC

Edit your Coturn config to be more compatible with WebRTC:

\`\`\`bash
sudo nano /etc/turnserver.conf
\`\`\`

Replace the authentication section with:

\`\`\`
# Authentication method - use static auth secret
use-auth-secret
static-auth-secret=your-super-secret-key-change-this

# Set realm to your domain or IP
realm=your-oracle-ip

# Allow any realm (more permissive for WebRTC)
# Comment out or remove any specific realm restrictions

# WebRTC compatibility
no-auth-pings
no-multicast-peers
no-loopback-peers

# Logging for debugging
verbose
log-file=/var/log/turnserver.log
\`\`\`

### 3. Generate Time-Limited Credentials

For better security, you can use time-limited credentials. Update your environment variables to use this format:

\`\`\`bash
# Calculate credentials (run this on your Oracle VM)
SECRET="your-super-secret-key-change-this"
USERNAME="webrtc"
TIMESTAMP=$(date +%s)
TEMP_USERNAME="${TIMESTAMP}:${USERNAME}"
TEMP_PASSWORD=$(echo -n "$TEMP_USERNAME" | openssl dgst -sha1 -hmac "$SECRET" -binary | base64)

echo "Username: $TEMP_USERNAME"
echo "Password: $TEMP_PASSWORD"
\`\`\`

### 4. Restart Coturn After Changes

\`\`\`bash
sudo systemctl restart coturn
sudo systemctl status coturn
sudo journalctl -u coturn -f
\`\`\`

### 5. Test with Correct Credentials

Use the TURN server test in the app with:
- **Server**: your-oracle-ip:3478
- **Username**: webrtc (or the time-limited username)
- **Credential**: your-secret-key (or the time-limited password)

Now let's update your WebRTC configuration to use environment variables:

\`\`\`typescriptreact file="hooks/useWebRTC.ts"
"use client"

import { useRef, useState, useCallback, useEffect } from "react"

interface UseWebRTCProps {
  roomId: string
  onRemoteStream: (stream: MediaStream) => void
  onConnectionStateChange: (state: string) => void
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

  const configuration: RTCConfiguration = {
    iceServers: [
      // Primary STUN server
      { urls: "stun:stun.l.google.com:19302" },
    
      // Your Oracle Cloud Coturn server (if available)
      ...(process.env.NEXT_PUBLIC_TURN_SERVER_URL ? [{
        urls: [
          process.env.NEXT_PUBLIC_TURN_SERVER_URL,
          process.env.NEXT_PUBLIC_TURN_SERVER_URL.replace('3478', '5349') // TLS version
        ],
        username: process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME || "webrtc",
        credential: process.env.NEXT_PUBLIC_TURN_SERVER_CREDENTIAL || "",
      }] : []),
    
      // Fallback public TURN (keep as backup)
      {
        urls: ["turn:turn.anyfirewall.com:443?transport=tcp"],
        username: "webrtc", 
        credential: "webrtc",
      },
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
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

  const createPeerConnection = useCallback(() => {
    console.log(`🔄 [${peerId.current}] Creating new peer connection...`)

    if (peerConnection.current) {
      console.log(`🗑️ [${peerId.current}] Closing existing peer connection`)
      peerConnection.current.close()
    }

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

    const pc = createPeerConnection()

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
          createPeerConnection()
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
  }
}
