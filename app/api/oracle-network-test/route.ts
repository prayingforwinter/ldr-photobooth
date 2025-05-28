import { type NextRequest, NextResponse } from "next/server"

// Helper function to safely execute commands
async function safeExec(
  command: string,
  description: string,
): Promise<{ success: boolean; output: string; error: string }> {
  try {
    // For Vercel environment, we'll simulate some basic tests
    // since most network commands aren't available

    if (command.includes("ping")) {
      // Simulate ping test using fetch
      const hostname = command.match(/ping.*?(\S+)/)?.[1]
      if (hostname) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 3000)

          await fetch(`http://${hostname}`, {
            signal: controller.signal,
            method: "HEAD",
          })

          clearTimeout(timeoutId)
          return {
            success: true,
            output: `PING ${hostname}: Host is reachable`,
            error: "",
          }
        } catch (error) {
          return {
            success: false,
            output: "",
            error: `Host ${hostname} unreachable: ${error instanceof Error ? error.message : "Unknown error"}`,
          }
        }
      }
    }

    // For other commands, return a "not available" message
    return {
      success: false,
      output: "",
      error: `Command not available in serverless environment: ${command}`,
    }
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const serverUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL

    if (!serverUrl) {
      return NextResponse.json({ error: "Oracle stream server URL not configured" }, { status: 500 })
    }

    // Extract hostname and port
    let baseUrl: string
    if (serverUrl.includes("://")) {
      baseUrl = serverUrl.split("://")[1]
    } else {
      baseUrl = serverUrl
    }

    const [hostname, port = "8080"] = baseUrl.split(":")

    console.log(`🔍 Running simplified network tests for ${hostname}:${port}`)

    const tests = []

    // Test 1: Basic connectivity test (simplified ping)
    const pingResult = await safeExec(`ping -c 3 ${hostname}`, "Basic Connectivity")
    tests.push({
      name: "Basic Connectivity",
      command: `ping -c 3 ${hostname}`,
      success: pingResult.success,
      output: pingResult.output,
      error: pingResult.error,
    })

    // Test 2: HTTP connection test
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`http://${hostname}:${port}/health`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "Vercel-Network-Test/1.0",
        },
      })

      clearTimeout(timeoutId)

      tests.push({
        name: "HTTP Connection Test",
        command: `fetch http://${hostname}:${port}/health`,
        success: response.ok,
        output: response.ok
          ? `HTTP ${response.status} - Connection successful`
          : `HTTP ${response.status} - ${response.statusText}`,
        error: response.ok ? "" : `HTTP error: ${response.status} ${response.statusText}`,
      })
    } catch (error) {
      tests.push({
        name: "HTTP Connection Test",
        command: `fetch http://${hostname}:${port}/health`,
        success: false,
        output: "",
        error: error instanceof Error ? error.message : "HTTP connection failed",
      })
    }

    // Test 3: HTTPS connection test
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`https://${hostname}:${port}/health`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "Vercel-Network-Test/1.0",
        },
      })

      clearTimeout(timeoutId)

      tests.push({
        name: "HTTPS Connection Test",
        command: `fetch https://${hostname}:${port}/health`,
        success: response.ok,
        output: response.ok
          ? `HTTPS ${response.status} - Connection successful`
          : `HTTPS ${response.status} - ${response.statusText}`,
        error: response.ok ? "" : `HTTPS error: ${response.status} ${response.statusText}`,
      })
    } catch (error) {
      tests.push({
        name: "HTTPS Connection Test",
        command: `fetch https://${hostname}:${port}/health`,
        success: false,
        output: "",
        error: error instanceof Error ? error.message : "HTTPS connection failed",
      })
    }

    // Test 4: DNS Resolution (simplified)
    try {
      // Try to resolve the hostname by making a request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)

      await fetch(`http://${hostname}`, {
        method: "HEAD",
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      tests.push({
        name: "DNS Resolution",
        command: `resolve ${hostname}`,
        success: true,
        output: `${hostname} resolves successfully`,
        error: "",
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "DNS resolution failed"
      tests.push({
        name: "DNS Resolution",
        command: `resolve ${hostname}`,
        success: !errorMsg.includes("ENOTFOUND"),
        output: errorMsg.includes("ENOTFOUND") ? "" : `${hostname} is resolvable`,
        error: errorMsg.includes("ENOTFOUND") ? `DNS resolution failed: ${hostname} not found` : "",
      })
    }

    const successfulTests = tests.filter((t) => t.success).length
    const analysis = {
      totalTests: tests.length,
      successfulTests,
      successRate: Math.round((successfulTests / tests.length) * 100),
      hostname,
      port,
      environment: "Vercel Serverless (Limited Commands)",
    }

    return NextResponse.json({
      success: successfulTests > 0,
      analysis,
      tests,
      recommendations: generateSimplifiedRecommendations(tests, analysis),
      note: "Running in serverless environment - some network tools are not available",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Network test failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        note: "Network testing failed in serverless environment",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  }
}

function generateSimplifiedRecommendations(tests: any[], analysis: any): string[] {
  const recommendations = []

  const connectivityTest = tests.find((t) => t.name === "Basic Connectivity")
  const httpTest = tests.find((t) => t.name === "HTTP Connection Test")
  const httpsTest = tests.find((t) => t.name === "HTTPS Connection Test")
  const dnsTest = tests.find((t) => t.name === "DNS Resolution")

  if (!dnsTest?.success) {
    recommendations.push("🔴 DNS issue - Check hostname/IP address")
    recommendations.push("Verify Oracle VM public IP is correct")
  } else {
    recommendations.push("✅ DNS resolution working")
  }

  if (!connectivityTest?.success) {
    recommendations.push("🔴 Basic connectivity failed")
    recommendations.push("Check if Oracle VM is running")
    recommendations.push("Verify network connectivity")
  } else {
    recommendations.push("✅ Basic connectivity working")
  }

  if (!httpTest?.success && !httpsTest?.success) {
    recommendations.push("🔴 Both HTTP and HTTPS failed")
    recommendations.push("Check Oracle Cloud Security Lists - ensure port 8080 is open")
    recommendations.push("SSH into VM: sudo systemctl status oracle-stream-server")
    recommendations.push("Check firewall: sudo ufw status")
  } else if (httpTest?.success) {
    recommendations.push("✅ HTTP connection working")
  } else if (httpsTest?.success) {
    recommendations.push("✅ HTTPS connection working")
  }

  if (analysis.successRate < 50) {
    recommendations.push("🔧 Multiple issues detected - check VM status and network configuration")
  }

  return recommendations
}
