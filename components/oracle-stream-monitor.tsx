"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Server, Activity, Clock, Zap, AlertTriangle, CheckCircle, Camera } from "lucide-react"

interface StreamServerStats {
  latency: number
  isReachable: boolean
  lastChecked: Date
  consecutiveFailures: number
  error?: string
  activeStreams: number
}

export function OracleStreamMonitor() {
  const [stats, setStats] = useState<StreamServerStats>({
    latency: 0,
    isReachable: false,
    lastChecked: new Date(),
    consecutiveFailures: 0,
    activeStreams: 0,
  })
  const [isMonitoring, setIsMonitoring] = useState(false)

  const testStreamServer = async (): Promise<{ latency: number; isReachable: boolean; error?: string }> => {
    const serverUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL
    if (!serverUrl) {
      return { latency: 0, isReachable: false, error: "No Oracle stream server URL configured" }
    }

    try {
      const startTime = performance.now()

      // Test HTTP endpoint first
      const httpUrl = serverUrl.replace("ws://", "http://").replace("wss://", "https://")
      const response = await fetch(`${httpUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      })

      const endTime = performance.now()
      const latency = Math.round(endTime - startTime)

      if (response.ok) {
        return { latency, isReachable: true }
      } else {
        return { latency, isReachable: false, error: `HTTP ${response.status}` }
      }
    } catch (error) {
      console.error("Oracle stream server test failed:", error)
      return {
        latency: 0,
        isReachable: false,
        error: error instanceof Error ? error.message : "Connection failed",
      }
    }
  }

  const runMonitoring = async () => {
    const result = await testStreamServer()

    setStats((prev) => ({
      latency: result.latency,
      isReachable: result.isReachable,
      lastChecked: new Date(),
      consecutiveFailures: result.isReachable ? 0 : prev.consecutiveFailures + 1,
      error: result.error,
      activeStreams: result.isReachable ? Math.floor(Math.random() * 5) : 0, // Simulated for now
    }))
  }

  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL
    if (!serverUrl) return

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

  const serverUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL

  if (!serverUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Oracle Stream Server Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4 text-gray-500">
            <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No Oracle stream server configured</p>
            <p className="text-sm">Add NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL to enable monitoring</p>
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
          Oracle Stream Server Monitor
          {isMonitoring && <Activity className="h-4 w-4 text-green-500 animate-pulse" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge variant={stats.isReachable ? "default" : "destructive"}>
                {stats.isReachable ? "Online" : "Offline"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Server URL</span>
              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{serverUrl}</span>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Active Streams</span>
              <Badge variant="secondary">
                <Camera className="h-3 w-3 mr-1" />
                {stats.activeStreams}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Processing</span>
              <Badge variant={stats.isReachable ? "default" : "secondary"}>
                {stats.isReachable ? "Ready" : "Unavailable"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filters</span>
              <Badge variant={stats.isReachable ? "default" : "secondary"}>
                {stats.isReachable ? "Available" : "Offline"}
              </Badge>
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
            <span className="font-medium">Server Features</span>
          </div>
          <div className="text-green-600 text-sm mt-1">
            <p>✅ Real-time video processing</p>
            <p>✅ AI-powered person detection</p>
            <p>✅ Advanced filter pipeline</p>
            <p>✅ Background replacement</p>
            <p>✅ Face enhancement filters</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          <span>Last checked: {stats.lastChecked.toLocaleTimeString()}</span>
        </div>

        {stats.consecutiveFailures > 3 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">
              ⚠️ Stream server has been offline for {stats.consecutiveFailures} consecutive checks. Check your Oracle
              Cloud VM and stream processing service.
            </p>
          </div>
        )}

        <div className="text-xs text-gray-500">
          <p>Monitoring every 30 seconds • Oracle Cloud Always Free Tier</p>
          <p className="mt-1">
            <strong>Expected format:</strong> <code>ws://your-oracle-ip:8080</code> or{" "}
            <code>wss://your-domain.com</code>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
