import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const serverUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL

    if (!serverUrl) {
      return NextResponse.json({ error: "Oracle stream server URL not configured" }, { status: 500 })
    }

    // Parse the server URL
    let parsedUrl: URL
    let hostname: string
    let port = "8080" // Default port
    let protocol = "http:"

    try {
      // Try to parse as full URL
      if (serverUrl.includes("://")) {
        parsedUrl = new URL(serverUrl)
        hostname = parsedUrl.hostname
        port = parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80")
        protocol = parsedUrl.protocol
      } else {
        // Parse as hostname:port
        const parts = serverUrl.split(":")
        hostname = parts[0]
        port = parts.length > 1 ? parts[1] : "8080"
        protocol = "http:"
        parsedUrl = new URL(`http://${hostname}:${port}`)
      }
    } catch (parseError) {
      console.error("URL parsing error:", parseError)
      return NextResponse.json(
        {
          error: "Invalid server URL format",
          serverUrl,
        },
        { status: 400 },
      )
    }

    // Run all diagnostics in parallel
    const [pingResult, portResult, healthResult] = await Promise.allSettled([
      // Basic ping test
      fetch(`/api/oracle-ping`).then((res) => res.json()),

      // Port connectivity test
      fetch(`/api/oracle-telnet`).then((res) => res.json()),

      // Health endpoint test
      fetch(`/api/oracle-health`).then((res) => res.json()),
    ])

    // Analyze results
    const diagnostics = {
      serverUrl,
      parsedUrl: {
        hostname,
        port,
        protocol,
        full: parsedUrl.toString(),
      },
      connectivity: {
        ping: pingResult.status === "fulfilled" ? pingResult.value : { error: "Ping test failed" },
        port: portResult.status === "fulfilled" ? portResult.value : { error: "Port test failed" },
        health: healthResult.status === "fulfilled" ? healthResult.value : { error: "Health test failed" },
      },
      analysis: {
        isReachable: pingResult.status === "fulfilled" && pingResult.value.success,
        isPortOpen: portResult.status === "fulfilled" && portResult.value.success,
        isHealthy: healthResult.status === "fulfilled" && healthResult.value.success,
      },
      recommendations: [],
    }

    // Generate recommendations based on test results
    if (!diagnostics.analysis.isReachable) {
      diagnostics.recommendations.push("Server is unreachable - check if Oracle VM is running and has a public IP")
    }

    if (diagnostics.analysis.isReachable && !diagnostics.analysis.isPortOpen) {
      diagnostics.recommendations.push(
        "Server is reachable but port is closed - check firewall settings and security lists",
      )
    }

    if (diagnostics.analysis.isPortOpen && !diagnostics.analysis.isHealthy) {
      diagnostics.recommendations.push("Port is open but health check failed - check if stream server is running")
    }

    return NextResponse.json({
      success: true,
      diagnostics,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Oracle diagnostics failed:", error)

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
