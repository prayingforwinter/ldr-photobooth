"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Key, RefreshCw, Clock, Shield } from "lucide-react"

interface CredentialInfo {
  username: string
  urls: string[]
  ttl: number
  expiresAt: Date
}

export function CredentialStatus() {
  const [credentials, setCredentials] = useState<CredentialInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<string>("")

  const fetchCredentials = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/turn-credentials")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const expiresAt = new Date(Date.now() + data.ttl * 1000)

      setCredentials({
        username: data.username,
        urls: data.urls,
        ttl: data.ttl,
        expiresAt,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch credentials")
    }

    setIsLoading(false)
  }

  // Update time remaining every second
  useEffect(() => {
    if (!credentials) return

    const interval = setInterval(() => {
      const now = new Date()
      const remaining = credentials.expiresAt.getTime() - now.getTime()

      if (remaining <= 0) {
        setTimeRemaining("Expired")
        return
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60))
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000)

      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`)
    }, 1000)

    return () => clearInterval(interval)
  }, [credentials])

  // Auto-fetch on mount
  useEffect(() => {
    fetchCredentials()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          TURN Credential Status
          <Badge variant="default" className="ml-auto">
            <Shield className="h-3 w-3 mr-1" />
            Secure
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Credential Generation</span>
          <Badge variant={credentials ? "default" : error ? "destructive" : "secondary"}>
            {credentials ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </>
            ) : error ? (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Failed
              </>
            ) : (
              "Unknown"
            )}
          </Badge>
        </div>

        {credentials && (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Active Credentials</span>
              </div>
              <div className="text-green-600 text-sm space-y-1">
                <p>
                  <strong>Username:</strong> <code className="bg-white px-1 rounded">{credentials.username}</code>
                </p>
                <p>
                  <strong>TURN URLs:</strong>
                </p>
                <ul className="ml-4 space-y-1">
                  {credentials.urls.map((url, index) => (
                    <li key={index}>
                      <code className="bg-white px-1 rounded text-xs">{url}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Time Remaining</span>
              </div>
              <Badge variant={timeRemaining === "Expired" ? "destructive" : "default"}>{timeRemaining}</Badge>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="h-4 w-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}

        <Button onClick={fetchCredentials} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate New Credentials
            </>
          )}
        </Button>

        <div className="space-y-2 text-xs text-gray-500">
          <div className="p-2 bg-blue-50 border border-blue-200 rounded">
            <p className="font-medium text-blue-700">Security Features:</p>
            <ul className="mt-1 space-y-1 text-blue-600">
              <li>• Server-side credential generation</li>
              <li>• HMAC-SHA1 signed authentication</li>
              <li>• Time-limited credentials (1 hour)</li>
              <li>• Secret key never exposed to client</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
