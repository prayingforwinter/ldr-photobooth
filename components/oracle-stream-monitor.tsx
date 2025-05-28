"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Server, Activity, AlertCircle, CheckCircle, RefreshCw, Wifi, Network, Info, BarChart3 } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export function OracleStreamMonitor() {
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking")
  const [serverStats, setServerStats] = useState<any>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [healthData, setHealthData] = useState<any>(null)
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [isTestingNetwork, setIsTestingNetwork] = useState(false)
  const [networkTestResults, setNetworkTestResults] = useState<any>(null)

  const checkServerStatus = async () => {
    setServerStatus("checking")
    setError(null)
    setDiagnostics(null)
    setStatsError(null)

    try {
      console.log(`🔍 Checking Oracle server via enhanced proxy...`)

      const healthResponse = await fetch("/api/oracle-health", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const healthResult = await healthResponse.json()

      if (healthResponse.ok && healthResult.success) {
        console.log(`✅ Oracle server is online:`, healthResult.data)
        setServerStatus("online")
        setHealthData(healthResult.data)
        setDiagnostics(healthResult.diagnostics)

        // Try to get server stats (non-blocking)
        fetchServerStats()
      } else {
        console.error(`❌ Oracle server is offline:`, healthResult.error)
        setServerStatus("offline")
        setError(healthResult.error || "Unknown error")
        setDiagnostics(healthResult.diagnostics)
      }
    } catch (error) {
      console.error("Oracle server check failed:", error)
      setServerStatus("offline")

      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          setError("Network error - unable to reach health check API")
        } else {
          setError(error.message)
        }
      } else {
        setError("Unknown connection error")
      }
    }

    setLastCheck(new Date())
  }

  const fetchServerStats = async () => {
    try {
      console.log(`📊 Fetching Oracle server stats...`)

      const statsResponse = await fetch("/api/oracle-stats", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const statsResult = await statsResponse.json()

      if (statsResponse.ok && statsResult.success) {
        setServerStats(statsResult.data)
        setStatsError(null)
        console.log(`📊 Oracle server stats retrieved:`, statsResult.data)
      } else {
        // Stats failed but don't treat as critical error
        setStatsError(statsResult.error || "Stats not available")
        setServerStats(null)
        console.warn(`📊 Stats not available:`, statsResult.error)

        // If it's a 404, that's expected for some servers
        if (statsResult.note && statsResult.note.includes("not implemented")) {
          setStatsError("Stats endpoint not implemented (optional)")
        }
      }
    } catch (error) {
      console.warn("Could not fetch server stats:", error)
      setStatsError("Stats collection failed (non-critical)")
      setServerStats(null)
    }
  }

  const runNetworkTest = async () => {
    setIsTestingNetwork(true)
    setNetworkTestResults(null)

    try {
      const response = await fetch("/api/oracle-network-test")
      if (response.ok) {
        const results = await response.json()
        setNetworkTestResults(results)
        console.log("Network test results:", results)
      } else {
        console.error("Network test API failed:", response.status)
        setNetworkTestResults({
          success: false,
          error: `API error: ${response.status}`,
          note: "Network test API is not responding",
        })
      }
    } catch (error) {
      console.error("Network test failed:", error)
      setNetworkTestResults({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        note: "Failed to run network tests",
      })
    } finally {
      setIsTestingNetwork(false)
    }
  }

  useEffect(() => {
    checkServerStatus()

    // Check every 30 seconds
    const interval = setInterval(checkServerStatus, 30000)

    return () => clearInterval(interval)
  }, [])

  const getServerUrl = () => {
    return process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL || null
  }

  const serverUrl = getServerUrl()

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
              onClick={runNetworkTest}
              size="sm"
              variant="outline"
              disabled={isTestingNetwork}
              title="Run simplified network test"
            >
              {isTestingNetwork ? <Activity className="h-3 w-3 animate-pulse" /> : <Network className="h-3 w-3" />}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          <Info className="h-3 w-3 inline mr-1" />
          <strong>Serverless Environment:</strong> Running simplified diagnostics due to Vercel limitations.
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Environment Variable</p>
            <p className="text-xs text-gray-600 break-all font-mono bg-gray-100 p-2 rounded">
              NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL={serverUrl || "Not set"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Connection Method</p>
            <p className="text-xs text-gray-600 bg-blue-100 p-2 rounded">
              <Wifi className="h-3 w-3 inline mr-1" />
              HTTP/HTTPS fetch with timeout handling
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Last Check</p>
            <p className="text-xs text-gray-600">{lastCheck ? lastCheck.toLocaleTimeString() : "Never"}</p>
          </div>
        </div>

        {healthData && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm font-medium">✅ Server Online</p>
            <div className="text-green-600 text-xs mt-1 space-y-1">
              <p>
                <strong>Status:</strong> {healthData.status}
              </p>
              <p>
                <strong>Protocol:</strong> {healthData.protocol || "Unknown"}
              </p>
              <p>
                <strong>Method:</strong> {healthData.method || "HTTP Fetch"}
              </p>
              {healthData.testedUrl && (
                <p>
                  <strong>Working URL:</strong> <code className="bg-white px-1 rounded">{healthData.testedUrl}</code>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Server Stats Section */}
        {serverStatus === "online" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm font-medium">Server Statistics</span>
              {serverStats && (
                <Badge variant="default" className="text-xs">
                  Available
                </Badge>
              )}
              {statsError && (
                <Badge variant="secondary" className="text-xs">
                  {statsError.includes("not implemented") ? "Optional" : "Unavailable"}
                </Badge>
              )}
            </div>

            {serverStats && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {serverStats.uptime && (
                    <div>
                      <span className="font-medium">Uptime:</span> {Math.floor(serverStats.uptime / 60)} minutes
                    </div>
                  )}
                  {serverStats.activeStreams !== undefined && (
                    <div>
                      <span className="font-medium">Active Streams:</span> {serverStats.activeStreams}
                    </div>
                  )}
                  {serverStats.totalConnections !== undefined && (
                    <div>
                      <span className="font-medium">Connections:</span> {serverStats.totalConnections}
                    </div>
                  )}
                  {serverStats.memory && (
                    <div>
                      <span className="font-medium">Memory:</span> {serverStats.memory.heapUsed || "Unknown"}
                    </div>
                  )}
                  {serverStats.protocol && (
                    <div>
                      <span className="font-medium">Stats Protocol:</span> {serverStats.protocol}
                    </div>
                  )}
                  {serverStats.version && (
                    <div>
                      <span className="font-medium">Version:</span> {serverStats.version}
                    </div>
                  )}
                </div>
              </div>
            )}

            {statsError && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                <Info className="h-3 w-3 inline mr-1" />
                <strong>Stats:</strong> {statsError}
                {statsError.includes("not implemented") && (
                  <span className="block mt-1">
                    This is normal - stats endpoint is optional for basic functionality.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {diagnostics && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="diagnostics">
              <AccordionTrigger>Connection Diagnostics</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-2 border rounded">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Basic Connectivity</span>
                        <Badge variant={diagnostics.tests.basicConnectivity.success ? "default" : "destructive"}>
                          {diagnostics.tests.basicConnectivity.success ? "✅ Pass" : "❌ Fail"}
                        </Badge>
                      </div>
                      {diagnostics.tests.basicConnectivity.error && (
                        <p className="text-xs text-red-600 mt-1">{diagnostics.tests.basicConnectivity.error}</p>
                      )}
                      {diagnostics.tests.basicConnectivity.details && (
                        <p className="text-xs text-gray-600 mt-1">{diagnostics.tests.basicConnectivity.details}</p>
                      )}
                    </div>

                    <div className="p-2 border rounded">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">HTTP Test</span>
                        <Badge variant={diagnostics.tests.httpFetch.success ? "default" : "destructive"}>
                          {diagnostics.tests.httpFetch.success ? "✅ Pass" : "❌ Fail"}
                        </Badge>
                      </div>
                      {diagnostics.tests.httpFetch.error && (
                        <p className="text-xs text-red-600 mt-1">{diagnostics.tests.httpFetch.error}</p>
                      )}
                      {diagnostics.tests.httpFetch.details && (
                        <p className="text-xs text-gray-600 mt-1">{diagnostics.tests.httpFetch.details}</p>
                      )}
                    </div>

                    <div className="p-2 border rounded">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">HTTPS Test</span>
                        <Badge variant={diagnostics.tests.httpsTest.success ? "default" : "destructive"}>
                          {diagnostics.tests.httpsTest.success ? "✅ Pass" : "❌ Fail"}
                        </Badge>
                      </div>
                      {diagnostics.tests.httpsTest.error && (
                        <p className="text-xs text-red-600 mt-1">{diagnostics.tests.httpsTest.error}</p>
                      )}
                      {diagnostics.tests.httpsTest.details && (
                        <p className="text-xs text-gray-600 mt-1">{diagnostics.tests.httpsTest.details}</p>
                      )}
                    </div>
                  </div>

                  {diagnostics.recommendations && diagnostics.recommendations.length > 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-yellow-700 text-sm font-medium">Recommendations:</p>
                      <ul className="text-yellow-600 text-xs mt-1 space-y-1 list-disc list-inside">
                        {diagnostics.recommendations.map((rec: string, i: number) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {networkTestResults && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="network">
              <AccordionTrigger>Network Test Results</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {networkTestResults.note && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                      <Info className="h-3 w-3 inline mr-1" />
                      {networkTestResults.note}
                    </div>
                  )}

                  {networkTestResults.analysis && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-700 text-sm font-medium">Test Summary</p>
                      <div className="text-blue-600 text-xs mt-1">
                        <p>
                          <strong>Success Rate:</strong> {networkTestResults.analysis.successRate || 0}% (
                          {networkTestResults.analysis.successfulTests || 0}/
                          {networkTestResults.analysis.totalTests || 0})
                        </p>
                        <p>
                          <strong>Target:</strong> {networkTestResults.analysis.hostname}:
                          {networkTestResults.analysis.port}
                        </p>
                        {networkTestResults.analysis.environment && (
                          <p>
                            <strong>Environment:</strong> {networkTestResults.analysis.environment}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {networkTestResults.tests && (
                    <div className="space-y-2">
                      {networkTestResults.tests.map((test: any, index: number) => (
                        <div
                          key={index}
                          className={`p-2 rounded text-xs ${test.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{test.name}</span>
                            <Badge variant={test.success ? "default" : "destructive"} className="text-xs">
                              {test.success ? "✅ Pass" : "❌ Fail"}
                            </Badge>
                          </div>
                          <p className="text-gray-600 mt-1 font-mono text-xs">{test.command}</p>
                          {test.error && <p className="text-red-600 mt-1">{test.error}</p>}
                          {test.output && test.success && <p className="text-green-600 mt-1">{test.output}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {networkTestResults.recommendations && networkTestResults.recommendations.length > 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-yellow-700 text-sm font-medium">Network Recommendations:</p>
                      <ul className="text-yellow-600 text-xs mt-1 space-y-1 list-disc list-inside">
                        {networkTestResults.recommendations.map((rec: string, i: number) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {networkTestResults.error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-700 text-sm font-medium">Network Test Error</p>
                      <p className="text-red-600 text-xs mt-1">{networkTestResults.error}</p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-medium">❌ Connection Failed</p>
            <p className="text-red-600 text-xs mt-1">{error}</p>
          </div>
        )}

        {serverStatus === "offline" && (
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-700 text-sm font-medium">🔧 Quick Troubleshooting:</p>
              <ol className="text-yellow-600 text-xs mt-2 space-y-1 list-decimal list-inside">
                <li>Check Oracle Cloud Console - ensure VM is running</li>
                <li>Verify public IP: {serverUrl?.split("://")[1]?.split(":")[0] || "Unknown"}</li>
                <li>
                  SSH into VM: <code className="bg-white px-1 rounded">ssh ubuntu@your-ip</code>
                </li>
                <li>
                  Test locally: <code className="bg-white px-1 rounded">curl http://localhost:8080/health</code>
                </li>
                <li>Click the network icon above for detailed tests</li>
              </ol>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-medium">🚨 Most Common Issues:</p>
              <ul className="text-red-600 text-xs mt-2 space-y-1 list-disc list-inside">
                <li>
                  <strong>Oracle Security Lists:</strong> Port 8080 not open for 0.0.0.0/0
                </li>
                <li>
                  <strong>Ubuntu Firewall:</strong> Port 8080 blocked by ufw
                </li>
                <li>
                  <strong>Stream Server:</strong> Not running or crashed
                </li>
                <li>
                  <strong>VM Status:</strong> Oracle VM stopped or suspended
                </li>
              </ul>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-700 text-sm font-medium">🔧 VM Commands to Run:</p>
              <div className="text-blue-600 text-xs mt-1 space-y-1 font-mono">
                <p># Check server status</p>
                <p>sudo systemctl status oracle-stream-server</p>
                <p></p>
                <p># Check firewall</p>
                <p>sudo ufw status</p>
                <p>sudo ufw allow 8080</p>
                <p></p>
                <p># Restart server</p>
                <p>sudo systemctl restart oracle-stream-server</p>
                <p></p>
                <p># Check logs</p>
                <p>sudo journalctl -u oracle-stream-server -f</p>
              </div>
            </div>
          </div>
        )}

        {!serverUrl && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-medium">Configuration Missing</p>
            <p className="text-red-600 text-xs mt-1">
              Please set the NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL environment variable.
            </p>
            <p className="text-red-600 text-xs mt-1">
              Example: <code>168.138.103.248:8080</code>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
