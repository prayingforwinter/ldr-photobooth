"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Server,
  AlertTriangle,
  CheckCircle,
  Network,
  Globe,
  Wifi,
  ShieldAlert,
  FileCode,
  Terminal,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export function OracleComprehensiveDiagnostics() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const runDiagnostics = async () => {
    setIsRunning(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch("/api/oracle-comprehensive-test")

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

  const getServerUrl = () => {
    return process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL || "Not set"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Oracle Comprehensive Diagnostics
          </span>
          <Button onClick={runDiagnostics} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Network className="h-4 w-4 mr-2" />
                Run Comprehensive Test
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!results && !error && !isRunning && (
          <div className="text-center p-6 text-gray-500">
            <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Run Comprehensive Test" to perform a detailed analysis of your Oracle server connection</p>
          </div>
        )}

        {isRunning && (
          <div className="text-center p-6">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
            <p className="text-blue-600 font-medium">Running comprehensive diagnostics...</p>
            <p className="text-gray-500 text-sm mt-2">This may take up to 30 seconds</p>
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

        {results && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-blue-700">
                  <Globe className="h-4 w-4" />
                  <span className="font-medium">Connection Status</span>
                </div>
                <Badge variant={results.success ? "default" : "destructive"}>
                  {results.success ? "Connected" : "Failed"}
                </Badge>
              </div>
              <div className="text-sm text-blue-600">
                <p>
                  <strong>URL:</strong> {getServerUrl()}
                </p>
                {results.parsedUrl && (
                  <>
                    <p>
                      <strong>Hostname:</strong> {results.parsedUrl.hostname}
                    </p>
                    <p>
                      <strong>Port:</strong> {results.parsedUrl.port}
                    </p>
                    <p>
                      <strong>Protocol:</strong> {results.parsedUrl.protocol}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Test Results Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* DNS Test */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <span className="font-medium">DNS Resolution</span>
                  </div>
                  <Badge variant={results.tests?.dns?.success ? "default" : "destructive"}>
                    {results.tests?.dns?.success ? "Success" : "Failed"}
                  </Badge>
                </div>
                {results.tests?.dns?.success ? (
                  <p className="text-sm text-green-600">Resolved to IP: {results.tests.dns.ip}</p>
                ) : (
                  <p className="text-sm text-red-600">{results.tests?.dns?.error || "DNS resolution failed"}</p>
                )}
              </div>

              {/* HTTP Test */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4" />
                    <span className="font-medium">HTTP Connection</span>
                  </div>
                  <Badge variant={results.tests?.http?.success ? "default" : "destructive"}>
                    {results.tests?.http?.success ? "Success" : "Failed"}
                  </Badge>
                </div>
                {results.tests?.http?.success ? (
                  <p className="text-sm text-green-600">
                    HTTP {results.tests.http.statusCode} in {results.tests.http.timing}ms
                  </p>
                ) : (
                  <p className="text-sm text-red-600">{results.tests?.http?.error || "HTTP connection failed"}</p>
                )}
              </div>

              {/* HTTPS Test */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    <span className="font-medium">HTTPS Connection</span>
                  </div>
                  <Badge variant={results.tests?.https?.success ? "default" : "destructive"}>
                    {results.tests?.https?.success ? "Success" : "Failed"}
                  </Badge>
                </div>
                {results.tests?.https?.success ? (
                  <p className="text-sm text-green-600">
                    HTTPS {results.tests.https.statusCode} in {results.tests.https.timing}ms
                  </p>
                ) : (
                  <p className="text-sm text-red-600">{results.tests?.https?.error || "HTTPS connection failed"}</p>
                )}
              </div>

              {/* Socket Test */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    <span className="font-medium">Raw Socket</span>
                  </div>
                  <Badge variant={results.tests?.socket?.success ? "default" : "destructive"}>
                    {results.tests?.socket?.success ? "Success" : "Failed"}
                  </Badge>
                </div>
                {results.tests?.socket?.success ? (
                  <p className="text-sm text-green-600">Socket connected in {results.tests.socket.timing}ms</p>
                ) : (
                  <p className="text-sm text-red-600">{results.tests?.socket?.error || "Socket connection failed"}</p>
                )}
              </div>
            </div>

            {/* Analysis and Recommendations */}
            {results.analysis && (
              <div className="space-y-4">
                {/* Errors */}
                {results.analysis.errors && results.analysis.errors.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Detected Issues</span>
                    </div>
                    <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                      {results.analysis.errors.map((error: string, i: number) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {results.analysis.recommendations && results.analysis.recommendations.length > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-700 mb-2">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">Recommendations</span>
                    </div>
                    <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
                      {results.analysis.recommendations.map((rec: string, i: number) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Best Connection Method */}
                {results.analysis.bestMethod && results.analysis.bestMethod !== "none" && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">Best Connection Method</span>
                    </div>
                    <p className="text-sm text-green-600">
                      {results.analysis.bestMethod.toUpperCase()} is the most reliable connection method
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Response Details */}
            <Accordion type="single" collapsible className="w-full">
              {/* HTTP Response */}
              {results.tests?.http?.success && (
                <AccordionItem value="http-response">
                  <AccordionTrigger>HTTP Response Details</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <div className="p-2 bg-gray-50 rounded text-xs">
                        <p className="font-medium mb-1">Status: {results.tests.http.statusCode}</p>
                        <p className="font-medium mb-1">Response Time: {results.tests.http.timing}ms</p>

                        {results.tests.http.headers && (
                          <div className="mt-2">
                            <p className="font-medium">Headers:</p>
                            <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-auto max-h-32">
                              {JSON.stringify(results.tests.http.headers, null, 2)}
                            </pre>
                          </div>
                        )}

                        {results.tests.http.responseText && (
                          <div className="mt-2">
                            <p className="font-medium">Response Body:</p>
                            <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-auto max-h-32">
                              {results.tests.http.responseText}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* HTTPS Response */}
              {results.tests?.https?.success && (
                <AccordionItem value="https-response">
                  <AccordionTrigger>HTTPS Response Details</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <div className="p-2 bg-gray-50 rounded text-xs">
                        <p className="font-medium mb-1">Status: {results.tests.https.statusCode}</p>
                        <p className="font-medium mb-1">Response Time: {results.tests.https.timing}ms</p>

                        {results.tests.https.headers && (
                          <div className="mt-2">
                            <p className="font-medium">Headers:</p>
                            <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-auto max-h-32">
                              {JSON.stringify(results.tests.https.headers, null, 2)}
                            </pre>
                          </div>
                        )}

                        {results.tests.https.responseText && (
                          <div className="mt-2">
                            <p className="font-medium">Response Body:</p>
                            <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-auto max-h-32">
                              {results.tests.https.responseText}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Raw Test Results */}
              <AccordionItem value="raw-results">
                <AccordionTrigger>Raw Test Results</AccordionTrigger>
                <AccordionContent>
                  <div className="p-2 bg-gray-50 rounded">
                    <pre className="text-xs overflow-auto max-h-96">{JSON.stringify(results, null, 2)}</pre>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Server Commands */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <Terminal className="h-4 w-4" />
                <span className="font-medium">Oracle VM Commands</span>
              </div>
              <div className="text-blue-600 text-xs space-y-1 font-mono">
                <p># Check if server is running</p>
                <p>sudo systemctl status oracle-stream-server</p>
                <p></p>
                <p># Check server logs</p>
                <p>sudo journalctl -u oracle-stream-server -f</p>
                <p></p>
                <p># Test locally on VM</p>
                <p>curl http://localhost:8080/health</p>
                <p></p>
                <p># Check firewall</p>
                <p>sudo ufw status</p>
                <p>sudo ufw allow 8080/tcp</p>
              </div>
            </div>

            {/* Oracle Cloud Console */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <FileCode className="h-4 w-4" />
                <span className="font-medium">Oracle Cloud Console</span>
              </div>
              <div className="text-blue-600 text-xs space-y-1">
                <p>1. Log in to Oracle Cloud Console</p>
                <p>2. Go to Compute > Instances > [Your VM]</p>
                <p>3. Check if the VM is running</p>
                <p>4. Go to Virtual Cloud Networks &gt; [Your VCN] &gt; Security Lists</p>
                <p>5. Verify ingress rule exists for port 8080 (TCP) from 0.0.0.0/0</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
