"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Wifi, WifiOff, Server, AlertTriangle, CheckCircle, Network, Activity } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export function OracleDiagnostics() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const runDiagnostics = async () => {
    setIsRunning(true)
    setError(null)

    try {
      const response = await fetch("/api/oracle-diagnostics")

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      setResults(data)

      if (!data.success) {
        setError(data.error || "Unknown error running diagnostics")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run diagnostics")
      console.error("Diagnostics error:", err)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Oracle Server Diagnostics
          </span>
          <Button onClick={runDiagnostics} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Run Diagnostics
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!results && !error && !isRunning && (
          <div className="text-center p-6 text-gray-500">
            <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Run Diagnostics" to check your Oracle server connectivity</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}

        {results && results.success && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Server Reachable</span>
                  <Badge variant={results.diagnostics.analysis.isReachable ? "default" : "destructive"}>
                    {results.diagnostics.analysis.isReachable ? (
                      <>
                        <Wifi className="h-3 w-3 mr-1" />
                        Yes
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3 mr-1" />
                        No
                      </>
                    )}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {results.diagnostics.analysis.isReachable
                    ? `Ping successful to ${results.diagnostics.parsedUrl.hostname}`
                    : `Cannot reach ${results.diagnostics.parsedUrl.hostname}`}
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Port Open</span>
                  <Badge variant={results.diagnostics.analysis.isPortOpen ? "default" : "destructive"}>
                    {results.diagnostics.analysis.isPortOpen ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Yes
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        No
                      </>
                    )}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {results.diagnostics.analysis.isPortOpen
                    ? `Port ${results.diagnostics.parsedUrl.port} is open`
                    : `Port ${results.diagnostics.parsedUrl.port} is closed or blocked`}
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Server Healthy</span>
                  <Badge variant={results.diagnostics.analysis.isHealthy ? "default" : "destructive"}>
                    {results.diagnostics.analysis.isHealthy ? (
                      <>
                        <Server className="h-3 w-3 mr-1" />
                        Yes
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        No
                      </>
                    )}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {results.diagnostics.analysis.isHealthy
                    ? "Health endpoint responding correctly"
                    : "Health endpoint not responding"}
                </p>
              </div>
            </div>

            {results.diagnostics.recommendations.length > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-700 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Recommendations</span>
                </div>
                <ul className="text-yellow-700 text-sm space-y-1 list-disc list-inside">
                  {results.diagnostics.recommendations.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="url">
                <AccordionTrigger>URL Information</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Original URL</div>
                      <div className="col-span-2 font-mono text-xs bg-gray-100 p-1 rounded">
                        {results.diagnostics.serverUrl}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Hostname</div>
                      <div className="col-span-2 font-mono text-xs bg-gray-100 p-1 rounded">
                        {results.diagnostics.parsedUrl.hostname}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Port</div>
                      <div className="col-span-2 font-mono text-xs bg-gray-100 p-1 rounded">
                        {results.diagnostics.parsedUrl.port}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Protocol</div>
                      <div className="col-span-2 font-mono text-xs bg-gray-100 p-1 rounded">
                        {results.diagnostics.parsedUrl.protocol}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Full URL</div>
                      <div className="col-span-2 font-mono text-xs bg-gray-100 p-1 rounded">
                        {results.diagnostics.parsedUrl.full}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ping">
                <AccordionTrigger>Ping Results</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Status</div>
                      <div className="col-span-2">
                        <Badge variant={results.diagnostics.connectivity.ping.success ? "default" : "destructive"}>
                          {results.diagnostics.connectivity.ping.status}
                        </Badge>
                      </div>
                    </div>
                    {results.diagnostics.connectivity.ping.ping?.packetLoss && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="font-medium">Packet Loss</div>
                        <div className="col-span-2">{results.diagnostics.connectivity.ping.ping.packetLoss}%</div>
                      </div>
                    )}
                    {results.diagnostics.connectivity.ping.ping?.avgTime && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="font-medium">Avg Response Time</div>
                        <div className="col-span-2">{results.diagnostics.connectivity.ping.ping.avgTime} ms</div>
                      </div>
                    )}
                    {results.diagnostics.connectivity.ping.error && (
                      <div className="p-2 bg-red-50 text-red-700 rounded text-xs">
                        {results.diagnostics.connectivity.ping.error}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="port">
                <AccordionTrigger>Port Test Results</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Status</div>
                      <div className="col-span-2">
                        <Badge variant={results.diagnostics.connectivity.port.success ? "default" : "destructive"}>
                          {results.diagnostics.connectivity.port.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Port</div>
                      <div className="col-span-2">{results.diagnostics.connectivity.port.port}</div>
                    </div>
                    {results.diagnostics.connectivity.port.error && (
                      <div className="p-2 bg-red-50 text-red-700 rounded text-xs">
                        {results.diagnostics.connectivity.port.error}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="health">
                <AccordionTrigger>Health Check Results</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="font-medium">Status</div>
                      <div className="col-span-2">
                        <Badge variant={results.diagnostics.connectivity.health.success ? "default" : "destructive"}>
                          {results.diagnostics.connectivity.health.status}
                        </Badge>
                      </div>
                    </div>
                    {results.diagnostics.connectivity.health.data && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="font-medium">Server Version</div>
                        <div className="col-span-2">
                          {results.diagnostics.connectivity.health.data.version || "Unknown"}
                        </div>
                      </div>
                    )}
                    {results.diagnostics.connectivity.health.error && (
                      <div className="p-2 bg-red-50 text-red-700 rounded text-xs">
                        {results.diagnostics.connectivity.health.error}
                      </div>
                    )}
                    {results.diagnostics.connectivity.health.data?.rawResponse && (
                      <div className="p-2 bg-gray-50 rounded">
                        <div className="font-medium mb-1">Raw Response:</div>
                        <div className="font-mono text-xs overflow-auto max-h-24">
                          {results.diagnostics.connectivity.health.data.rawResponse}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <Server className="h-4 w-4" />
                <span className="font-medium">Oracle VM Commands</span>
              </div>
              <div className="text-blue-600 text-xs space-y-1 font-mono">
                <p># Check if server is running</p>
                <p>sudo systemctl status oracle-stream-server</p>
                <p></p>
                <p># View server logs</p>
                <p>sudo journalctl -u oracle-stream-server -f</p>
                <p></p>
                <p># Restart server</p>
                <p>sudo systemctl restart oracle-stream-server</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
