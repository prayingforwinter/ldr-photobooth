import { type NextRequest, NextResponse } from "next/server"

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

    console.log(`🔍 Checking Oracle server health at: ${healthUrl}`)

    // Make the request from the server side (no CORS issues)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Vercel-Photobooth-App/1.0",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Get the raw response text first
      const responseText = await response.text()
      console.log(
        `📄 Raw response from Oracle server: ${responseText.substring(0, 200)}${responseText.length > 200 ? "..." : ""}`,
      )

      let data
      try {
        // Try to parse as JSON
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error(`❌ Failed to parse response as JSON: ${parseError}`)

        // If we can't parse as JSON but the response was "OK", consider it a success
        if (response.ok && responseText.includes("healthy")) {
          data = {
            status: "healthy",
            note: "Response was not valid JSON but contained 'healthy'",
            rawResponse: responseText.substring(0, 100), // Include part of the raw response
          }
        } else {
          throw new Error(`Server responded with non-JSON data: ${responseText.substring(0, 100)}...`)
        }
      }

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`)
      }

      console.log(`✅ Oracle server health check passed:`, data)

      return NextResponse.json({
        success: true,
        status: "online",
        data,
        serverUrl: healthUrl,
        timestamp: new Date().toISOString(),
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)

      if (fetchError instanceof Error) {
        if (fetchError.name === "AbortError") {
          throw new Error("Connection timeout - server may be unreachable")
        } else {
          throw fetchError
        }
      }
      throw new Error("Unknown fetch error")
    }
  } catch (error) {
    console.error("Oracle health check failed:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        success: false,
        status: "offline",
        error: errorMessage,
        serverUrl: process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }, // Return 200 so the client can handle the error gracefully
    )
  }
}
