"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Wifi, WifiOff, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react"

interface ConnectionDiagnosticsProps {
  peerConnection: RTCPeerConnection | null
  isConnected: boolean
  error: string | null
}

export function ConnectionDiagnostics({ peerConnection, isConnected, error }: ConnectionDiagnosticsProps) {
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [turnTestResult, setTurnTestResult] = useState<boolean | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const runDiagnostics = async () => {
    if (!peerConnection) return

    setIsLoading(true)
    try {
      const statsReport = await peerConnection.getStats()
      const statsObj: any = {}

      statsReport.forEach((report) => {
        if (report.type === "candidate-pair" && report.state === "succeeded") {
          statsObj.candidatePair = report
        }
        if (report.type === "local-candidate") {
          statsObj.localCandidate = report
        }
        if (report.type === "remote-candidate") {
          statsObj.remoteCandidate = report
        }
        if (report.type === "inbound-rtp" && report.mediaType === "video") {
          statsObj.inboundVideo = report
        }
      })

      setStats(statsObj)
    } catch (err) {
      console.error("Failed to get stats:", err)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (peerConnection && isConnected) {
      runDiagnostics()
      const interval = setInterval(runDiagnostics, 5000)
      return () => clearInterval(interval)
    }
  }, [peerConnection, isConnected])

  const getConnectionType = () => {
    if (!stats?.candidatePair) return "Unknown"

    const local = stats.localCandidate
    const remote = stats.remoteCandidate

    if (local?.candidateType === "relay" || remote?.candidateType === "relay") {
      return "TURN (Relay)"
    } else if (local?.candidateType === "srflx" || remote?.candidateType === "srflx") {
      return "STUN (Server Reflexive)"
    } else if (local?.candidateType === "host" && remote?.candidateType === "host") {
      return "Direct (Host)"
    }
    return "Unknown"
  }

  const getConnectionQuality = () => {
    if (!stats?.candidatePair) return "Unknown"

    const rtt = stats.candidatePair.currentRoundTripTime
    if (rtt < 0.1) return "Excellent"
    if (rtt < 0.2) return "Good"
    if (rtt < 0.5) return "Fair"
    return "Poor"
  }

  const testTurnConnectivity = async () => {
    setIsTesting(true)
    setTurnTestResult(null)

    try {
      const testConfig = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: ["turn:turn.anyfirewall.com:443?transport=tcp", "turn:turn.anyfirewall.com:3478?transport=udp"],
            username: "webrtc",
            credential: "webrtc",
          },
        ],
      }

      const testPc = new RTCPeerConnection(testConfig)
      testPc.createDataChannel("test")

      const offer = await testPc.createOffer()
      await testPc.setLocalDescription(offer)

      const result = await new Promise<boolean>((resolve) => {
        let hasRelay = false
        let timeout: NodeJS.Timeout

        testPc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("TURN test candidate:", event.candidate.type, event.candidate.candidate)
            if (event.candidate.type === "relay") {
              hasRelay = true
              clearTimeout(timeout)
              testPc.close()
              resolve(true)
            }
          } else {
            clearTimeout(timeout)
            testPc.close()
            resolve(hasRelay)
          }
        }

        timeout = setTimeout(() => {
          testPc.close()
          resolve(false)
        }, 8000)
      })

      setTurnTestResult(result)
    } catch (error) {
      console.error("TURN test failed:", error)
      setTurnTestResult(false)
    }

    setIsTesting(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Connection Diagnostics
          <Button onClick={runDiagnostics} disabled={isLoading || !peerConnection} size="sm" variant="outline">
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge variant={isConnected ? "default" : error ? "destructive" : "secondary"}>
                {isConnected ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </>
                ) : error ? (
                  <>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Failed
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 mr-1" />
                    Disconnected
                  </>
                )}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connection Type</span>
              <span className="text-sm">{getConnectionType()}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Quality</span>
              <span className="text-sm">{getConnectionQuality()}</span>
            </div>
          </div>

          <div className="space-y-2">
            {stats?.candidatePair && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Round Trip Time</span>
                  <span className="text-sm">{(stats.candidatePair.currentRoundTripTime * 1000).toFixed(0)}ms</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Bytes Sent</span>
                  <span className="text-sm">{Math.round(stats.candidatePair.bytesSent / 1024)}KB</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Bytes Received</span>
                  <span className="text-sm">{Math.round(stats.candidatePair.bytesReceived / 1024)}KB</span>
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Connection Error</span>
            </div>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">TURN Server Test</span>
            <Button onClick={testTurnConnectivity} disabled={isTesting} size="sm" variant="outline">
              {isTesting ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Test TURN
                </>
              )}
            </Button>
          </div>

          {turnTestResult !== null && (
            <div
              className={`p-2 rounded text-sm ${
                turnTestResult
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {turnTestResult ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  TURN servers are working correctly
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  TURN servers are not responding - connection may fail
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>
            <strong>Direct:</strong> Best performance, both users on same network
          </p>
          <p>
            <strong>STUN:</strong> Good performance, users behind different NATs
          </p>
          <p>
            <strong>TURN:</strong> Fallback option, may have higher latency
          </p>
        </div>

        <div className="text-xs text-gray-500">
          <p>
            For detailed WebRTC information, visit <code>about:webrtc</code> in your browser
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
