import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const serverUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL

    if (!serverUrl) {
      return NextResponse.json({ error: "Oracle stream server URL not configured" }, { status: 500 })
    }

    // Parse the URL to extract hostname and port
    let hostname: string
    let port = "8080" // Default port
    let protocol = "http:" // Default protocol

    try {
      // Try to parse as full URL
      if (serverUrl.includes("://")) {
        const url = new URL(serverUrl)
        hostname = url.hostname
        port = url.port || (url.protocol === "https:" ? "443" : "80")
        protocol = url.protocol
      } else {
        // Parse as hostname:port
        const parts = serverUrl.split(":")
        hostname = parts[0]
        port = parts.length > 1 ? parts[1] : "8080"
      }
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid server URL format",
          details: parseError instanceof Error ? parseError.message : "URL parsing failed",
          serverUrl,
        },
        { status: 200 },
      )
    }

    // Try both HTTP and HTTPS
    const urlsToTry = [`http://${hostname}:${port}/health`, `https://${hostname}:${port}/health`]

    const results = []

    for (const url of urlsToTry) {
      try {
        console.log(`🔍 Testing direct connection to ${url}...`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const startTime = Date.now()
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "Vercel-Direct-Test/1.0",
            Accept: "*/*",
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        const endTime = Date.now()

        const responseText = await response.text()

        results.push({
          url,
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          responseTime: endTime - startTime,
          responseText: responseText.substring(0, 500),
          headers: Object.fromEntries(response.headers.entries()),
        })

        console.log(`✅ Direct test to ${url}: ${response.status} ${response.statusText}`)

        // If successful, no need to try other URLs
        if (response.ok) {
          break
        }
      } catch (error) {
        console.error(`❌ Direct test to ${url} failed:`, error)

        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          errorType: error instanceof Error ? error.name : "Unknown",
        })
      }
    }

    // Check if any connection succeeded
    const anySuccess = results.some((r) => r.success)

    return NextResponse.json(
      {
        success: anySuccess,
        results,
        serverUrl,
        parsedUrl: { hostname, port, protocol },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Direct test failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  }
}
