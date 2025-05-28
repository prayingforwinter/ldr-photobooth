"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Server, Activity, AlertCircle, CheckCircle, RefreshCw } from "lucide-react"

export function OracleStreamMonitor() {
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking")
  const [serverStats, setServerStats] = useState<any>(null)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  const checkServerStatus = async () => {
    setServerStatus("checking")
    try {
      const serverUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL || "http://localhost:8080"

      // Check health endpoint
      const healthResponse = await fetch(`${serverUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      if (healthResponse.ok) {
        setServerStatus("online")

        // Get server stats
        try {
          const statsResponse = await fetch(`${serverUrl}/stats`)
          if (statsResponse.ok) {
            const stats = await statsResponse.json()
            setServerStats(stats)
          }
        } catch (error) {
          console.warn("Could not fetch server stats:", error)
        }
      } else {
        setServerStatus("offline")
      }
    } catch (error) {
      console.error("Server check failed:", error)
      setServerStatus("offline")
    }

    setLastCheck(new Date())
  }

  useEffect(() => {
    checkServerStatus()

    // Check every 30 seconds
    const interval = setInterval(checkServerStatus, 30000)

    return () => clearInterval(interval)
  }, [])

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
              {serverStatus === "checking" && <Activity className="h-3 w-3 mr-1" />}
              {serverStatus === "online" ? "Online" : serverStatus === "offline" ? "Offline" : "Checking..."}
            </Badge>
            <Button onClick={checkServerStatus} size="sm" variant="outline">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Server URL</p>
            <p className="text-xs text-gray-600 break-all">
              {process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL || "http://localhost:8080"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Last Check</p>
            <p className="text-xs text-gray-600">{lastCheck ? lastCheck.toLocaleTimeString() : "Never"}</p>
          </div>
        </div>

        {serverStats && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-lg font-bold text-blue-600">{serverStats.activeRooms || 0}</p>
                <p className="text-xs text-blue-600">Active Rooms</p>
              </div>

              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-lg font-bold text-green-600">{serverStats.activeStreams || 0}</p>
                <p className="text-xs text-green-600">Active Streams</p>
              </div>

              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-lg font-bold text-purple-600">{serverStats.totalConnections || 0}</p>
                <p className="text-xs text-purple-600">Connections</p>
              </div>
            </div>

            {serverStats.uptime && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium">Server Uptime</p>
                <p className="text-xs text-gray-600">{serverStats.uptime}</p>
              </div>
            )}
          </div>
        )}

        {serverStatus === "offline" && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-medium">Server Offline</p>
            <p className="text-red-600 text-xs mt-1">
              Make sure your Oracle Cloud VM is running and the stream server is started.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
