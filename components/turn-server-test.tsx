"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Loader2, Server, AlertTriangle } from "lucide-react"

export function TurnServerTest() {
  const [serverUrl, setServerUrl] = useState(process.env.NEXT_PUBLIC_TURN_SERVER_URL || "your-oracle-ip:3478")
  const [username, setUsername] = useState(process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME || "webrtc")
  const [isTestingStun, setIsTestingStun] = useState(false)
  const [isTestingTurn, setIsTestingTurn] = useState(false)
  const [stunResult, setStunResult] = useState<boolean | null>(null)
  const [turnResult, setTurnResult] = useState<boolean | null>(null)
  const [details, setDetails] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [credentials, setCredentials] = useState<any>(null)

  const formatUrl = (url: string, protocol: "stun" | "turn"): string => {
    if (!url) return ""

    // Remove any existing protocol
    const cleanUrl = url.replace(/^(turn:|stun:)/, "")

    // Add the specified protocol
    return `${protocol}:${cleanUrl}`
  }

  const fetchTurnCredentials = async () => {
    try {
      const response = await fetch("/api/turn-credentials")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const creds = await response.json()
      setCredentials(creds)
      return creds
    } catch (error) {
      console.error("Failed to fetch TURN credentials:", error)
      setError("Failed to fetch TURN credentials from server")
      return null
    }
  }

  const testStunServer = async () => {
    setIsTestingStun(true)
    setStunResult(null)
    setDetails("")
    setError("")

    try {
      const stunUrl = formatUrl(serverUrl, "stun")
      console.log("Testing STUN with URL:", stunUrl)

      const config = { iceServers: [{ urls: stunUrl }] }

      const pc = new RTCPeerConnection(config)
      pc.createDataChannel("test")

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const result = await new Promise<boolean>((resolve) => {
        let hasCandidate = false
        let timeout: NodeJS.Timeout

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            setDetails((prev) => prev + `\nSTUN Candidate: ${event.candidate.candidate}`)
            hasCandidate = true
          } else {
            clearTimeout(timeout)
            pc.close()
            resolve(hasCandidate)
          }
        }

        timeout = setTimeout(() => {
          pc.close()
          resolve(hasCandidate)
        }, 10000)
      })

      setStunResult(result)
    } catch (error) {
      setStunResult(false)
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      setError(`STUN Error: ${errorMsg}`)
      setDetails(`STUN Error: ${errorMsg}`)
    }

    setIsTestingStun(false)
  }

  const testTurnServer = async () => {
    setIsTestingTurn(true)
    setTurnResult(null)
    setDetails("")
    setError("")

    try {
      // Fetch fresh credentials from server
      const creds = await fetchTurnCredentials()
      if (!creds) {
        setTurnResult(false)
        setError("Failed to get TURN credentials")
        setIsTestingTurn(false)
        return
      }

      console.log("Testing TURN with server-generated credentials")

      const config = {
        iceServers: [
          {
            urls: creds.urls,
            username: creds.username,
            credential: creds.credential,
          },
        ],
      }

      const pc = new RTCPeerConnection(config)
      pc.createDataChannel("test")

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const result = await new Promise<boolean>((resolve) => {
        let hasRelay = false
        let timeout: NodeJS.Timeout

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            setDetails((prev) => prev + `\nTURN Candidate: ${event.candidate.type} - ${event.candidate.candidate}`)
            if (event.candidate.type === "relay") {
              hasRelay = true
              clearTimeout(timeout)
              pc.close()
              resolve(true)
            }
          } else {
            clearTimeout(timeout)
            pc.close()
            resolve(hasRelay)
          }
        }

        timeout = setTimeout(() => {
          pc.close()
          resolve(false)
        }, 15000)
      })

      setTurnResult(result)
    } catch (error) {
      setTurnResult(false)
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      setError(`TURN Error: ${errorMsg}`)
      setDetails(`TURN Error: ${errorMsg}`)
    }

    setIsTestingTurn(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Oracle TURN Server Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">Secure Testing</span>
          </div>
          <p className="text-blue-600 text-sm mt-1">
            TURN credentials are now generated securely server-side. The test will fetch fresh time-limited credentials
            automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="server-url">Server IP:Port</Label>
            <Input
              id="server-url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="168.138.103.248:3478"
            />
            <div className="text-xs text-gray-500">
              <p>
                STUN URL: <code>{formatUrl(serverUrl, "stun")}</code>
              </p>
              <p>
                TURN URL: <code>{formatUrl(serverUrl, "turn")}</code>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username (Public)</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="webrtc"
              disabled
            />
            <div className="text-xs text-gray-500">Credentials are generated securely server-side</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={testStunServer} disabled={isTestingStun} className="flex-1">
            {isTestingStun ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Test STUN
          </Button>
          <Button onClick={testTurnServer} disabled={isTestingTurn} className="flex-1">
            {isTestingTurn ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Test TURN
          </Button>
        </div>

        <Button onClick={fetchTurnCredentials} variant="outline" className="w-full">
          Fetch Fresh TURN Credentials
        </Button>

        {credentials && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Server-Generated Credentials</span>
            </div>
            <div className="text-green-600 text-sm mt-1 space-y-1">
              <p>
                <strong>Username:</strong> <code>{credentials.username}</code>
              </p>
              <p>
                <strong>URLs:</strong> <code>{credentials.urls.join(", ")}</code>
              </p>
              <p className="text-xs">Valid for {credentials.ttl / 3600} hour(s)</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 border rounded">
            <span className="font-medium">STUN Test</span>
            <Badge variant={stunResult === true ? "default" : stunResult === false ? "destructive" : "secondary"}>
              {stunResult === true ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Pass
                </>
              ) : stunResult === false ? (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Fail
                </>
              ) : (
                "Not tested"
              )}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 border rounded">
            <span className="font-medium">TURN Test</span>
            <Badge variant={turnResult === true ? "default" : turnResult === false ? "destructive" : "secondary"}>
              {turnResult === true ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Pass
                </>
              ) : turnResult === false ? (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Fail
                </>
              ) : (
                "Not tested"
              )}
            </Badge>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}

        {details && (
          <div className="p-3 bg-gray-50 rounded text-sm font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
            {details}
          </div>
        )}

        <div className="text-xs text-gray-500">
          <p>
            <strong>STUN:</strong> Tests basic connectivity to your Oracle server
          </p>
          <p>
            <strong>TURN:</strong> Tests relay functionality with secure server-side credentials
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
