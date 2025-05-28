"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Camera, Download, Users, Server, UserX, AlertTriangle, Move, Square } from "lucide-react"
import { useOracleStream } from "../hooks/useOracleStream"
import { OracleStreamMonitor } from "../components/oracle-stream-monitor"
import { FilterControls } from "../components/filter-controls"

interface PhotoPosition {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export default function PhotoboothApp() {
  const [roomId, setRoomId] = useState<string>("")
  const [isInRoom, setIsInRoom] = useState(false)
  const [remoteStreamUrls, setRemoteStreamUrls] = useState<Map<string, string>>(new Map())
  const [connectionState, setConnectionState] = useState<string>("new")
  const [selectedFrame, setSelectedFrame] = useState<string>("/placeholder.svg?height=400&width=710")
  const [customFrame, setCustomFrame] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [captureResolution, setCaptureResolution] = useState<string>("match") // match, hd, vertical
  const [user1Position, setUser1Position] = useState<PhotoPosition>({
    x: 50,
    y: 100,
    width: 200,
    height: 150,
    rotation: 0,
  })
  const [user2Position, setUser2Position] = useState<PhotoPosition>({
    x: 350,
    y: 100,
    width: 200,
    height: 150,
    rotation: 0,
  })
  const [isDragging, setIsDragging] = useState<string | null>(null)
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [filters, setFilters] = useState<any>({})

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    localStream,
    isConnected,
    isConnecting,
    error: streamError,
    remoteStreams,
    startLocalVideo,
    joinRoom,
    leaveRoom,
    retryConnection,
    streamServerUrl,
    localStreamId,
  } = useOracleStream({
    roomId,
    onRemoteStream: (streamUrl: string, userId: string) => {
      setRemoteStreamUrls((prev) => new Map(prev.set(userId, streamUrl)))
    },
    onConnectionStateChange: setConnectionState,
  })

  const predefinedFrames = [
    "/placeholder.svg?height=400&width=710&text=Classic+Frame",
    "/placeholder.svg?height=400&width=710&text=Heart+Frame",
    "/placeholder.svg?height=400&width=710&text=Star+Frame",
    "/placeholder.svg?height=400&width=710&text=Circle+Frame",
  ]

  // Set video streams when they change
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  const generateRoomId = () => {
    const newRoomId = Math.random().toString(36).substr(2, 8).toUpperCase()
    setRoomId(newRoomId)
  }

  const handleCreateRoom = async () => {
    try {
      generateRoomId()
      setIsInRoom(true)
      await startLocalVideo()
    } catch (error) {
      console.error("Failed to create room:", error)
      setIsInRoom(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!roomId.trim()) return

    try {
      setIsInRoom(true)
      await startLocalVideo()
      // Wait for stream to be ready
      setTimeout(() => {
        joinRoom().catch((error) => {
          console.error("Failed to join room:", error)
        })
      }, 1000)
    } catch (error) {
      console.error("Failed to join room:", error)
      setIsInRoom(false)
    }
  }

  const handleLeaveRoom = async () => {
    await leaveRoom()
    setIsInRoom(false)
    setRoomId("")
    setRemoteStreamUrls(new Map())
  }

  const copyRoomLink = () => {
    const link = `${window.location.origin}?room=${roomId}`
    navigator.clipboard.writeText(link)
  }

  const shareRoom = () => {
    const link = `${window.location.origin}?room=${roomId}`
    if (navigator.share) {
      navigator.share({
        title: "Join my Photobooth Session",
        text: "Let's take some photos together!",
        url: link,
      })
    } else {
      copyRoomLink()
    }
  }

  // Check for room ID in URL on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const roomFromUrl = urlParams.get("room")
    if (roomFromUrl) {
      setRoomId(roomFromUrl)
    }
  }, [])

  // Auto-join room when everything is ready
  useEffect(() => {
    if (isInRoom && roomId && localStream && !isConnecting && !isConnected) {
      console.log("Auto-joining room after creation/setup")
      const timer = setTimeout(() => {
        joinRoom().catch((error) => {
          console.error("Auto-join failed:", error)
        })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isInRoom, roomId, localStream, isConnecting, isConnected, joinRoom])

  const handleCustomFrameUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setCustomFrame(result)
        setSelectedFrame(result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleMouseDown = (e: React.MouseEvent, userId: string, action: "drag" | "resize") => {
    e.preventDefault()
    if (action === "drag") {
      setIsDragging(userId)
    } else {
      setIsResizing(userId)
    }
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging && !isResizing) return

      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y

      if (isDragging) {
        const setPosition = isDragging === "1" ? setUser1Position : setUser2Position
        setPosition((prev) => ({
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }))
      } else if (isResizing) {
        const setPosition = isResizing === "1" ? setUser1Position : setUser2Position
        setPosition((prev) => ({
          ...prev,
          width: Math.max(50, prev.width + deltaX),
          height: Math.max(50, prev.height + deltaY),
        }))
      }

      setDragStart({ x: e.clientX, y: e.clientY })
    },
    [isDragging, isResizing, dragStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(null)
    setIsResizing(null)
  }, [])

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp])

  const getCanvasDimensions = () => {
    switch (captureResolution) {
      case "hd":
        return { width: 1920, height: 1080 }
      case "vertical":
        return { width: 1080, height: 1920 }
      case "match":
      default:
        return { width: 710, height: 400 }
    }
  }

  const capturePhoto = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsProcessing(true)

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height } = getCanvasDimensions()
    canvas.width = width
    canvas.height = height

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw the frame first (background)
    if (selectedFrame) {
      const frameImg = new Image()
      frameImg.crossOrigin = "anonymous"
      frameImg.onload = () => {
        // Draw frame as background
        ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height)

        // Draw user videos on top of frame
        drawUserVideos(ctx)

        const dataURL = canvas.toDataURL("image/png")
        setCapturedPhoto(dataURL)
        setIsProcessing(false)
      }
      frameImg.onerror = () => {
        // If frame fails to load, just draw videos
        drawUserVideos(ctx)
        const dataURL = canvas.toDataURL("image/png")
        setCapturedPhoto(dataURL)
        setIsProcessing(false)
      }
      frameImg.src = selectedFrame
    } else {
      drawUserVideos(ctx)
      const dataURL = canvas.toDataURL("image/png")
      setCapturedPhoto(dataURL)
      setIsProcessing(false)
    }
  }

  const drawUserVideos = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { width, height } = getCanvasDimensions()

    // Calculate scale factor from photobooth area (710x400) to canvas
    const scaleX = width / 710
    const scaleY = height / 400

    // Draw local user video
    if (localStream && localVideoRef.current) {
      ctx.save()

      // Scale positions according to canvas size
      const scaledX = user1Position.x * scaleX
      const scaledY = user1Position.y * scaleY
      const scaledWidth = user1Position.width * scaleX
      const scaledHeight = user1Position.height * scaleY

      ctx.translate(scaledX + scaledWidth / 2, scaledY + scaledHeight / 2)
      ctx.rotate((user1Position.rotation * Math.PI) / 180)
      ctx.drawImage(localVideoRef.current, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight)
      ctx.restore()
    }

    // Draw remote user videos
    remoteVideoRefs.current.forEach((videoRef, userId) => {
      if (videoRef) {
        ctx.save()

        // Scale positions according to canvas size
        const scaledX = user2Position.x * scaleX
        const scaledY = user2Position.y * scaleY
        const scaledWidth = user2Position.width * scaleX
        const scaledHeight = user2Position.height * scaleY

        ctx.translate(scaledX + scaledWidth / 2, scaledY + scaledHeight / 2)
        ctx.rotate((user2Position.rotation * Math.PI) / 180)
        ctx.drawImage(videoRef, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight)
        ctx.restore()
      }
    })
  }

  const downloadPhoto = () => {
    if (!capturedPhoto) return

    const link = document.createElement("a")
    link.download = `photobooth-${Date.now()}.png`
    link.href = capturedPhoto
    link.click()
  }

  if (!isInRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Join Photobooth Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="room-id">Room ID</Label>
              <Input
                id="room-id"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Enter room ID"
                className="text-center font-mono"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleJoinRoom} disabled={!roomId.trim()} className="flex-1">
                <Server className="h-4 w-4 mr-2" />
                Join Room
              </Button>
              <Button onClick={handleCreateRoom} variant="outline" className="flex-1">
                <Users className="h-4 w-4 mr-2" />
                Create Room
              </Button>
            </div>

            {streamError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{streamError}</div>
            )}

            <div className="text-center text-sm text-gray-500">
              Create a room and share the ID with a friend to start your photobooth session!
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">AI Photobooth Studio</h1>
          <p className="text-gray-600">Room: {roomId}</p>
          <div className="text-sm text-gray-500 mt-2">
            Room: {roomId} | Status: {connectionState} | You: {localStream ? "✓" : "✗"} | Partners:{" "}
            {remoteStreams.length}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Connection Status */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">You</span>
                  <Badge variant={localStream ? "default" : "secondary"}>
                    {localStream ? (
                      <>
                        <Camera className="h-3 w-3 mr-1" /> Connected
                      </>
                    ) : (
                      <>
                        <UserX className="h-3 w-3 mr-1" /> Disconnected
                      </>
                    )}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Oracle Server</span>
                  <Badge variant={isConnected ? "default" : "secondary"}>
                    {isConnected ? (
                      <>
                        <Server className="h-3 w-3 mr-1" /> Connected
                      </>
                    ) : isConnecting ? (
                      <>
                        <Server className="h-3 w-3 mr-1" /> Connecting...
                      </>
                    ) : (
                      <>
                        <UserX className="h-3 w-3 mr-1" /> Waiting
                      </>
                    )}
                  </Badge>
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="font-medium">Partner Connected</span>
                    <Badge variant={remoteStreams.length > 0 ? "default" : "secondary"}>
                      {remoteStreams.length > 0 ? (
                        <>
                          <Camera className="h-3 w-3 mr-1" />
                          Yes ({remoteStreams.length})
                        </>
                      ) : (
                        <>
                          <UserX className="h-3 w-3 mr-1" />
                          Waiting...
                        </>
                      )}
                    </Badge>
                  </div>

                  {remoteStreams.length > 0 && (
                    <div className="mt-2 text-xs text-gray-600 bg-green-50 p-2 rounded">
                      ✅ Partner's camera is connected and streaming
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Photobooth Studio */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Photobooth Studio
                  <Badge variant="secondary">Oracle AI Processing</Badge>
                </span>
                <div className="flex gap-2">
                  <Button onClick={capturePhoto} disabled={!localStream || isProcessing}>
                    <Camera className="h-4 w-4 mr-2" />
                    {isProcessing ? "Processing..." : "Capture"}
                  </Button>
                  {capturedPhoto && (
                    <Button onClick={downloadPhoto} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <div
                  className="relative bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300"
                  style={{ width: "710px", height: "400px" }}
                >
                  {/* Frame overlay */}
                  <img
                    src={selectedFrame || "/placeholder.svg"}
                    alt="Frame"
                    className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
                  />

                  {/* Local user video */}
                  {localStream && (
                    <div
                      className="absolute border-2 border-blue-500 cursor-move z-20 bg-black"
                      style={{
                        left: user1Position.x,
                        top: user1Position.y,
                        width: user1Position.width,
                        height: user1Position.height,
                        transform: `rotate(${user1Position.rotation}deg)`,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, "1", "drag")}
                    >
                      <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

                      <div className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-br">
                        You
                      </div>
                      <div
                        className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize flex items-center justify-center"
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          handleMouseDown(e, "1", "resize")
                        }}
                      >
                        <Square className="h-3 w-3 text-white" />
                      </div>
                      <div className="absolute top-0 right-0 w-4 h-4 bg-blue-600 cursor-move flex items-center justify-center">
                        <Move className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}

                  {/* Remote user videos */}
                  {remoteStreams.map((stream, index) => (
                    <div
                      key={stream.userId}
                      className="absolute border-2 border-green-500 cursor-move z-20 bg-black"
                      style={{
                        left: user2Position.x + index * 20,
                        top: user2Position.y + index * 20,
                        width: user2Position.width,
                        height: user2Position.height,
                        transform: `rotate(${user2Position.rotation}deg)`,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, "2", "drag")}
                    >
                      <video
                        ref={(el) => {
                          if (el) {
                            remoteVideoRefs.current.set(stream.userId, el)
                            // Set the stream URL for the video element
                            if (stream.streamUrl && el.src !== stream.streamUrl) {
                              el.src = stream.streamUrl
                              el.load()
                            }
                          }
                        }}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error("Video error for stream:", stream.streamUrl, e)
                        }}
                        onLoadStart={() => {
                          console.log("Loading stream:", stream.streamUrl)
                        }}
                        onCanPlay={() => {
                          console.log("Stream ready:", stream.streamUrl)
                        }}
                      />

                      <div className="absolute top-0 left-0 bg-green-500 text-white text-xs px-2 py-1 rounded-br">
                        Partner {index + 1}
                      </div>
                      <div
                        className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 cursor-se-resize flex items-center justify-center"
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          handleMouseDown(e, "2", "resize")
                        }}
                      >
                        <Square className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  ))}

                  {/* No camera message */}
                  {!localStream && (
                    <div className="absolute inset-0 flex items-center justify-center z-30">
                      <div className="text-center p-6 bg-white/90 rounded-lg shadow-lg">
                        <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-semibold mb-2">Camera Access Required</h3>
                        <p className="text-gray-600">Please allow camera access to start the session</p>
                      </div>
                    </div>
                  )}

                  {/* Waiting for partner message */}
                  {localStream && remoteStreams.length === 0 && (
                    <div className="absolute top-4 right-4 z-30">
                      <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 text-sm">
                        <div className="flex items-center gap-2 text-yellow-700">
                          <Users className="h-4 w-4" />
                          <span>Waiting for partner to join...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filter Controls */}
          <Card className="lg:col-span-1">
            <FilterControls onFiltersChange={setFilters} isConnected={isConnected} />
          </Card>
        </div>

        {isInRoom && (
          <div className="mt-6 space-y-6">
            <OracleStreamMonitor />
          </div>
        )}

        {streamError && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Connection Troubleshooting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2">Current Error:</h4>
                <p className="text-red-700 text-sm">{streamError}</p>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Troubleshooting Steps:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                  <li>Check if Oracle Cloud VM is running and accessible</li>
                  <li>Verify stream server is running on the VM</li>
                  <li>Check firewall settings - stream server needs ports open</li>
                  <li>Try a different browser (Chrome/Firefox work best)</li>
                  <li>Check the Oracle stream server monitor above</li>
                  <li>Verify NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL is set correctly</li>
                </ol>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700 text-sm">
                  <strong>Oracle VM Setup:</strong> Make sure your stream processing server is running on your Oracle
                  Cloud VM and accessible via the configured URL.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {capturedPhoto && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Captured Photo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <img
                  src={capturedPhoto || "/placeholder.svg"}
                  alt="Captured"
                  className="max-w-full h-auto rounded-lg shadow-lg"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
