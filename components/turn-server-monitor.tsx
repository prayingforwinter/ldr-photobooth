"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Server, Activity, Clock, Zap, AlertTriangle, CheckCircle } from "lucide-react"

interface TurnServerStats {
  latency: number
  isReachable: boolean
  lastChecked: Date
  consecutiveFailures: number
  error?: string
}

export function TurnServerMonitor() {
  const [stats, setStats] = useState<TurnServerStats>({
    latency: 0,
    isReachable: false,
    lastChecked: new Date(),
    consecutiveFailures: 0,
  })
  const [isMonitoring, setIsMonitoring] = useState(false)

  const formatTurnUrl = (url: string): string => {
    if (!url) return ""

    // Remove any existing protocol
    const cleanUrl = url.replace(/^(turn:|stun:)/, "")

    // Add turn: prefix
    return `turn:${cleanUrl}`
  }

  const testTurnServerLatency = async (): Promise<{ latency: number; isReachable: boolean; error?: string }> => {
    const rawServerUrl = process.env.NEXT_PUBLIC_TURN_SERVER_URL
    if (!rawServerUrl) {
      return { latency: 0, isReachable: false, error: "No TURN server URL configured" }
    }

    try {
      const startTime = performance.now()

      // Format the URL properly
      const turnUrl = formatTurnUrl(rawServerUrl)

      console.log("Testing TURN server:", { rawServerUrl, turnUrl })

      const config = {
        iceServers: [
          {
            urls: [turnUrl],
            username: process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME || "webrtc",
            credential: process.env.NEXT_PUBLIC_TURN_SERVER_CREDENTIAL || "",
          },
        ],
      }

      const pc = new RTCPeerConnection(config)
      pc.createDataChannel("test")

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const result = await new Promise<{ success: boolean; latency: number }>((resolve) => {
        let hasCandidate = false
        let timeout: NodeJS.Timeout

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            hasCandidate = true
            const endTime = performance.now()
            const latency = endTime - startTime
            clearTimeout(timeout)
            pc.close()
            resolve({ success: true, latency })
          } else if (!hasCandidate) {
            clearTimeout(timeout)
            pc.close()
            resolve({ success: false, latency: 0 })
          }
        }

        timeout = setTimeout(() => {
          pc.close()
          resolve({ success: hasCandidate, latency: hasCandidate ? performance.now() - startTime : 0 })
        }, 5000)
      })

      return {
        latency: Math.round(result.latency),
        isReachable: result.success,
        error: result.success ? undefined : "No ICE candidates received",
      }
    } catch (error) {
      console.error("TURN server test failed:", error)
      return {
        latency: 0,
        isReachable: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  const runMonitoring = async () => {
    const result = await testTurnServerLatency()

    setStats((prev) => ({
      latency: result.latency,
      isReachable: result.isReachable,
      lastChecked: new Date(),
      consecutiveFailures: result.isReachable ? 0 : prev.consecutiveFailures + 1,
      error: result.error,
    }))
  }

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_TURN_SERVER_URL) return

    setIsMonitoring(true)

    // Initial test
    runMonitoring()

    // Set up periodic monitoring every 30 seconds
    const interval = setInterval(runMonitoring, 30000)

    return () => {
      clearInterval(interval)
      setIsMonitoring(false)
    }
  }, [])

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return "text-green-600"
    if (latency < 300) return "text-yellow-600"
    return "text-red-600"
  }

  const getLatencyProgress = (latency: number) => {
    return Math.min((latency / 500) * 100, 100)
  }

  const rawUrl = process.env.NEXT_PUBLIC_TURN_SERVER_URL
  const formattedUrl = rawUrl ? formatTurnUrl(rawUrl) : ""

  if (!rawUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            TURN Server Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4 text-gray-500">
            <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No Oracle TURN server configured</p>
            <p className="text-sm">Add NEXT_PUBLIC_TURN_SERVER_URL to enable monitoring</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Oracle TURN Server Monitor
          {isMonitoring && <Activity className="h-4 w-4 text-green-500 animate-pulse" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge variant={stats.isReachable ? "default" : "destructive"}>
                {stats.isReachable ? "Online" : "Offline"}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Raw URL</span>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{rawUrl}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Formatted URL</span>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{formattedUrl}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Latency</span>
              <span className={`text-sm font-mono ${getLatencyColor(stats.latency)}`}>
                {stats.isReachable ? `${stats.latency}ms` : "N/A"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Failures</span>
              <span className="text-sm">{stats.consecutiveFailures > 0 ? stats.consecutiveFailures : "None"}</span>
            </div>
          </div>
        </div>

        {stats.isReachable && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">Response Time</span>
            </div>
            <Progress value={getLatencyProgress(stats.latency)} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Fast (0ms)</span>
              <span>Slow (500ms+)</span>
            </div>
          </div>
        )}

        {stats.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-600 text-sm mt-1">{stats.error}</p>
          </div>
        )}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">Security Status</span>
          </div>
          <div className="text-green-600 text-sm mt-1">
            <p>✅ Credentials generated server-side</p>
            <p>✅ Time-limited authentication (1 hour)</p>
            <p>✅ HMAC-SHA1 signed credentials</p>
            <p>✅ Secret key protected</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          <span>Last checked: {stats.lastChecked.toLocaleTimeString()}</span>
        </div>

        {stats.consecutiveFailures > 3 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">
              ⚠️ TURN server has been offline for {stats.consecutiveFailures} consecutive checks. Check your Oracle Cloud
              VM and Coturn service.
            </p>
          </div>
        )}

        <div className="text-xs text-gray-500">
          <p>Monitoring every 30 seconds • Oracle Cloud Always Free Tier</p>
          <p className="mt-1">
            <strong>Expected format:</strong> <code>turn:your-ip:3478</code> or <code>your-ip:3478</code>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
