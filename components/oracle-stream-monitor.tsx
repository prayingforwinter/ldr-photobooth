"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Server, Activity, AlertCircle, CheckCircle, RefreshCw, Wifi, WifiOff } from "lucide-react"

export function OracleStreamMonitor() {
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking")
  const [serverStats, setServerStats] = useState<any>(null)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [healthData, setHealthData] = useState<any>(null)

  const checkServerStatus = async () => {
    setServerStatus("checking")
    setError(null)

    try {
      console.log(`🔍 Checking Oracle server via proxy...`)

      // Use our proxy API route to avoid CORS issues
      const healthResponse = await fetch("/api/oracle-health", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!healthResponse.ok) {
        throw new Error(`Proxy API error: ${healthResponse.status}`)
      }

      const healthResult = await healthResponse.json()

      if (healthResult.success) {
        console.log(`✅ Oracle server is online:`, healthResult.data)
        setServerStatus("online")
        setHealthData(healthResult.data)

        // Try to get server stats
        try {
          const statsResponse = await fetch("/api/oracle-stats", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          })

          if (statsResponse.ok) {
            const statsResult = await statsResponse.json()
            if (statsResult.success) {
              setServerStats(statsResult.data)
              console.log(`📊 Oracle server stats:`, statsResult.data)
            }
          }
        } catch (statsError) {
          console.warn("Could not fetch server stats:", statsError)
        }
      } else {
        console.error(`❌ Oracle server is offline:`, healthResult.error)
        setServerStatus("offline")
        setError(healthResult.error)
      }
    } catch (error) {
      console.error("Oracle server check failed:", error)
      setServerStatus("offline")

      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          setError("Network error - check your internet connection")
        } else if (error.message.includes("Proxy API error")) {
          setError("Internal API error - check Vercel function logs")
        } else {
          setError(error.message)
        }
      } else {
        setError("Unknown connection error")
      }
    }

    setLastCheck(new Date())
  }

  useEffect(() => {
    checkServerStatus()

    // Check every 30 seconds
    const interval = setInterval(checkServerStatus, 30000)

    return () => clearInterval(interval)
  }, [])

  const getServerUrl = () => {
    const envUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL
    if (!envUrl) return null

    if (envUrl.startsWith("http://") || envUrl.startsWith("https://")) {
      return envUrl
    } else if (envUrl.startsWith("ws://")) {
      return envUrl.replace("ws://", "http://")
    } else if (envUrl.startsWith("wss://")) {
      return envUrl.replace("wss://", "https://")
    } else {
      return `http://${envUrl}`
    }
  }

  const serverUrl = getServerUrl()

  // Function to test direct connection (for debugging)
  const testDirectConnection = async () => {
    setError("Testing direct connection... (check console)")

    try {
      const url = getServerUrl()
      if (!url) {
        setError("No server URL configured")
        return
      }

      console.log(`🔍 Testing direct connection to: ${url}/health`)
      const response = await fetch(`${url}/health`, {
        mode: "no-cors", // This will make the request but won't let us read the response
      })

      console.log("Direct connection response:", response)
      setError("Direct connection test completed - check console")
    } catch (error) {
      console.error("Direct connection test failed:", error)
      setError(`Direct test failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Oracle Stream Server
          </span>
          <div className="flex items-center gap-2">
            <Badge
              variant={serverStatus === "online" ? "default" : serverStatus === "offline" ? "destructive" : "secondary"}
            >
              {serverStatus === "online" && <CheckCircle className="h-3 w-3 mr-1" />}
              {serverStatus === "offline" && <AlertCircle className="h-3 w-3 mr-1" />}
              {serverStatus === "checking" && <Activity className="h-3 w-3 mr-1 animate-pulse" />}
              {serverStatus === "online" ? "Online" : serverStatus === "offline" ? "Offline" : "Checking..."}
            </Badge>
            <Button onClick={checkServerStatus} size="sm" variant="outline" disabled={serverStatus === "checking"}>
              <RefreshCw className={`h-3 w-3 ${serverStatus === "checking" ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={testDirectConnection}
              size="sm"
              variant="outline"
              title="Test direct connection (debug)"
              className="ml-1"
            >
              <WifiOff className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Environment Variable</p>
            <p className="text-xs text-gray-600 break-all font-mono bg-gray-100 p-2 rounded">
              NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL={process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL || "Not set"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Resolved Server URL</p>
            <p className="text-xs text-gray-600 break-all font-mono bg-gray-100 p-2 rounded">
              {serverUrl || "Could not resolve URL"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Connection Method</p>
            <p className="text-xs text-gray-600 bg-blue-100 p-2 rounded">
              <Wifi className="h-3 w-3 inline mr-1" />
              Via Vercel Proxy API (CORS-free)
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Last Check</p>
            <p className="text-xs text-gray-600">{lastCheck ? lastCheck.toLocaleTimeString() : "Never"}</p>
          </div>
        </div>

        {healthData && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm font-medium">Server Health Data</p>
            <div className="text-green-600 text-xs mt-1 space-y-1">
              <p>
                <strong>Status:</strong> {healthData.status}
              </p>
              <p>
                <strong>Server:</strong> {healthData.server || "Oracle Stream Server"}
              </p>
              <p>
                <strong>Version:</strong> {healthData.version || "Unknown"}
              </p>
              {healthData.activeStreams !== undefined && (
                <p>
                  <strong>Active Streams:</strong> {healthData.activeStreams}
                </p>
              )}
            </div>
          </div>
        )}

        {serverStats && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-lg font-bold text-blue-600">{serverStats.activeStreams || 0}</p>
                <p className="text-xs text-blue-600">Active Streams</p>
              </div>

              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-lg font-bold text-green-600">{serverStats.totalConnections || 0}</p>
                <p className="text-xs text-green-600">Connections</p>
              </div>

              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-lg font-bold text-purple-600">
                  {serverStats.uptime ? Math.floor(serverStats.uptime / 60) : 0}m
                </p>
                <p className="text-xs text-purple-600">Uptime</p>
              </div>
            </div>

            {serverStats.memory && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium">Server Memory</p>
                <p className="text-xs text-gray-600">
                  Heap: {serverStats.memory.heapUsed} / RSS: {serverStats.memory.rss}
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-medium">Connection Error</p>
            <p className="text-red-600 text-xs mt-1">{error}</p>
          </div>
        )}

        {serverStatus === "offline" && (
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-700 text-sm font-medium">Troubleshooting Steps:</p>
              <ol className="text-yellow-600 text-xs mt-2 space-y-1 list-decimal list-inside">
                <li>Check if your Oracle Cloud VM is running</li>
                <li>
                  SSH into your VM and run:{" "}
                  <code className="bg-white px-1 rounded">sudo systemctl status oracle-stream-server</code>
                </li>
                <li>
                  Check server logs:{" "}
                  <code className="bg-white px-1 rounded">sudo journalctl -u oracle-stream-server -f</code>
                </li>
                <li>
                  Verify firewall: <code className="bg-white px-1 rounded">sudo ufw status</code>
                </li>
                <li>
                  Test direct access from VM: <code className="bg-white px-1 rounded">curl localhost:8080/health</code>
                </li>
                <li>Check Oracle Cloud Security Lists (port 8080 should be open)</li>
              </ol>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-700 text-sm">
                <strong>Expected URL format:</strong> <code>http://your-oracle-ip:8080</code> or{" "}
                <code>ws://your-oracle-ip:8080</code>
              </p>
              <p className="text-blue-600 text-xs mt-1">
                The connection now goes through Vercel's proxy API to avoid CORS issues.
              </p>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-gray-700 text-sm font-medium">Quick VM Commands:</p>
              <div className="text-gray-600 text-xs mt-1 space-y-1 font-mono">
                <p># Check if server is running</p>
                <p>curl http://localhost:8080/health</p>
                <p></p>
                <p># Restart the server</p>
                <p>sudo systemctl restart oracle-stream-server</p>
                <p></p>
                <p># Check server status</p>
                <p>sudo systemctl status oracle-stream-server</p>
              </div>
            </div>
          </div>
        )}

        {!serverUrl && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-medium">Configuration Missing</p>
            <p className="text-red-600 text-xs mt-1">
              Please set the NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL environment variable in your Vercel project settings.
            </p>
            <p className="text-red-600 text-xs mt-1">
              Example: <code>168.138.103.248:8080</code> or <code>http://168.138.103.248:8080</code>
            </p>
          </div>
        )}

        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          <WifiOff className="h-3 w-3 inline mr-1" />
          <strong>CORS Fix:</strong> Health checks now go through Vercel's backend to avoid browser CORS restrictions.
        </div>
      </CardContent>
    </Card>
  )
}
