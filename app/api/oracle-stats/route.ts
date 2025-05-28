import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const serverUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL

    if (!serverUrl) {
      return NextResponse.json({ error: "Oracle stream server URL not configured" }, { status: 500 })
    }

    // Extract base URL without protocol
    let baseUrl: string
    if (serverUrl.includes("://")) {
      baseUrl = serverUrl.split("://")[1]
    } else {
      baseUrl = serverUrl
    }

    // Try both HTTP and HTTPS protocols for stats endpoint
    const urlsToTry = [
      { url: `http://${baseUrl}/stats`, protocol: "HTTP" },
      { url: `https://${baseUrl}/stats`, protocol: "HTTPS" },
    ]

    console.log(`📊 Testing Oracle server stats endpoints...`)

    let lastError = ""

    for (const { url, protocol } of urlsToTry) {
      try {
        console.log(`📊 Trying stats via ${protocol}: ${url}`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // Shorter timeout for stats

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Vercel-Photobooth-App/1.0",
            Accept: "application/json, text/plain, */*",
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          const responseText = await response.text()
          console.log(`📊 Stats response from ${url}: ${responseText.substring(0, 100)}`)

          let data
          try {
            data = JSON.parse(responseText)
          } catch (parseError) {
            console.warn(`📊 Stats response not JSON from ${url}, treating as text`)
            data = {
              status: "available",
              note: "Stats endpoint responded but with non-JSON data",
              rawResponse: responseText.substring(0, 200),
              protocol,
            }
          }

          console.log(`✅ Stats retrieved successfully via ${protocol}`)

          return NextResponse.json({
            success: true,
            data: {
              ...data,
              protocol,
              testedUrl: url,
              retrievedAt: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
          })
        } else {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`
          lastError = `${url}: ${errorMsg}`
          console.log(`❌ Stats failed via ${protocol}: ${errorMsg}`)

          // If it's a 404, the stats endpoint might not exist
          if (response.status === 404) {
            return NextResponse.json(
              {
                success: false,
                error: "Stats endpoint not available",
                note: "The /stats endpoint is not implemented on this server",
                statusCode: 404,
                timestamp: new Date().toISOString(),
              },
              { status: 200 }, // Return 200 so client can handle gracefully
            )
          }
        }
      } catch (fetchError) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : "Unknown fetch error"
        lastError = `${url}: ${errorMsg}`
        console.log(`❌ Stats fetch failed via ${protocol}: ${errorMsg}`)

        // Continue to next URL
        continue
      }
    }

    // If we get here, all URLs failed
    console.warn(`📊 All stats endpoints failed. Last error: ${lastError}`)

    return NextResponse.json(
      {
        success: false,
        error: "Stats endpoint not accessible",
        details: lastError,
        note: "Server may not have a /stats endpoint or it may be unreachable",
        troubleshooting: [
          "Stats endpoint is optional - server health can still be monitored",
          "Check if your Oracle stream server implements /stats endpoint",
          "Verify server is running: sudo systemctl status oracle-stream-server",
        ],
        timestamp: new Date().toISOString(),
      },
      { status: 200 }, // Return 200 so client can handle gracefully
    )
  } catch (error) {
    console.error("Oracle stats fetch failed:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        note: "Stats collection failed - this is not critical for basic functionality",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }, // Return 200 so client can handle gracefully
    )
  }
}
