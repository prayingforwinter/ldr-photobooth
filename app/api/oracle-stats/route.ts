import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const serverUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL

    if (!serverUrl) {
      return NextResponse.json({ error: "Oracle stream server URL not configured" }, { status: 500 })
    }

    // Parse the server URL to handle different formats
    let statsUrl: string
    if (serverUrl.startsWith("http://") || serverUrl.startsWith("https://")) {
      statsUrl = `${serverUrl}/stats`
    } else if (serverUrl.startsWith("ws://")) {
      statsUrl = `${serverUrl.replace("ws://", "http://")}/stats`
    } else if (serverUrl.startsWith("wss://")) {
      statsUrl = `${serverUrl.replace("wss://", "https://")}/stats`
    } else {
      statsUrl = `http://${serverUrl}/stats`
    }

    console.log(`📊 Fetching Oracle server stats from: ${statsUrl}`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
      const response = await fetch(statsUrl, {
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
      console.log(`📄 Raw stats response: ${responseText.substring(0, 200)}${responseText.length > 200 ? "..." : ""}`)

      let data
      try {
        // Try to parse as JSON
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error(`❌ Failed to parse stats response as JSON: ${parseError}`)
        throw new Error(`Server responded with non-JSON data: ${responseText.substring(0, 100)}...`)
      }

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`)
      }

      console.log(`📊 Oracle server stats:`, data)

      return NextResponse.json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      throw fetchError
    }
  } catch (error) {
    console.error("Oracle stats fetch failed:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  }
}
