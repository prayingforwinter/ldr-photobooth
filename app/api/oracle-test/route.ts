import { type NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execPromise = promisify(exec)

export async function GET(request: NextRequest) {
  try {
    const serverUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL

    if (!serverUrl) {
      return NextResponse.json({ error: "Oracle stream server URL not configured" }, { status: 500 })
    }

    // Parse the server URL to handle different formats
    let healthUrl: string
    if (serverUrl.startsWith("http://") || serverUrl.startsWith("https://")) {
      healthUrl = `${serverUrl}/health`
    } else if (serverUrl.startsWith("ws://")) {
      healthUrl = `${serverUrl.replace("ws://", "http://")}/health`
    } else if (serverUrl.startsWith("wss://")) {
      healthUrl = `${serverUrl.replace("wss://", "https://")}/health`
    } else {
      healthUrl = `http://${serverUrl}/health`
    }

    console.log(`🔍 Testing Oracle server with curl: ${healthUrl}`)

    // Use curl for more reliable connection testing
    try {
      const { stdout, stderr } = await execPromise(`curl -v -m 10 "${healthUrl}"`)

      console.log("Curl stdout:", stdout)
      if (stderr) console.log("Curl stderr:", stderr)

      // Try to parse as JSON if possible
      try {
        const data = JSON.parse(stdout)
        return NextResponse.json({
          success: true,
          status: "online",
          data,
          method: "curl",
          serverUrl: healthUrl,
          timestamp: new Date().toISOString(),
        })
      } catch (parseError) {
        // If not JSON, return the raw response
        return NextResponse.json({
          success: true,
          status: "online",
          rawResponse: stdout,
          method: "curl",
          serverUrl: healthUrl,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (curlError) {
      console.error("Curl test failed:", curlError)

      // Fall back to fetch
      console.log("Falling back to fetch...")

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch(healthUrl, {
          method: "GET",
          headers: {
            "User-Agent": "Vercel-Photobooth-App/1.0",
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const responseText = await response.text()
        console.log(`Raw response: ${responseText.substring(0, 200)}`)

        return NextResponse.json({
          success: response.ok,
          status: response.ok ? "online" : "error",
          statusCode: response.status,
          rawResponse: responseText.substring(0, 500),
          method: "fetch",
          serverUrl: healthUrl,
          timestamp: new Date().toISOString(),
        })
      } catch (fetchError) {
        clearTimeout(timeoutId)
        throw fetchError
      }
    }
  } catch (error) {
    console.error("Oracle test failed:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        success: false,
        status: "offline",
        error: errorMessage,
        serverUrl: process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  }
}
