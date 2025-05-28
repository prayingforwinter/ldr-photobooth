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

    // Test multiple protocols and endpoints
    const testsToRun = [
      { url: `https://${baseUrl}/health`, name: "HTTPS Health Check" },
      { url: `http://${baseUrl}/health`, name: "HTTP Health Check" },
      { url: `https://${baseUrl}/stats`, name: "HTTPS Stats" },
      { url: `http://${baseUrl}/stats`, name: "HTTP Stats" },
    ]

    console.log(`🧪 Running comprehensive connection tests for Oracle server...`)

    const results = []

    for (const test of testsToRun) {
      console.log(`🧪 Testing: ${test.name} - ${test.url}`)

      const testResult = {
        name: test.name,
        url: test.url,
        success: false,
        error: null as string | null,
        responseTime: 0,
        statusCode: null as number | null,
        responsePreview: null as string | null,
      }

      try {
        const startTime = Date.now()
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(test.url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Vercel-Photobooth-Test/1.0",
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        testResult.responseTime = Date.now() - startTime
        testResult.statusCode = response.status

        const responseText = await response.text()
        testResult.responsePreview = responseText.substring(0, 100)

        if (response.ok) {
          testResult.success = true
          console.log(`✅ ${test.name} succeeded in ${testResult.responseTime}ms`)
        } else {
          testResult.error = `HTTP ${response.status}: ${response.statusText}`
          console.log(`❌ ${test.name} failed: ${testResult.error}`)
        }
      } catch (fetchError) {
        testResult.error = fetchError instanceof Error ? fetchError.message : "Unknown error"
        testResult.responseTime = Date.now() - Date.now()
        console.log(`❌ ${test.name} failed: ${testResult.error}`)
      }

      results.push(testResult)
    }

    // Analyze results
    const successfulTests = results.filter((r) => r.success)
    const analysis = {
      totalTests: results.length,
      successfulTests: successfulTests.length,
      hasWorkingConnection: successfulTests.length > 0,
      preferredProtocol: successfulTests.find((r) => r.name.includes("HTTPS"))
        ? "HTTPS"
        : successfulTests.find((r) => r.name.includes("HTTP"))
          ? "HTTP"
          : "None",
      fastestResponse: successfulTests.length > 0 ? Math.min(...successfulTests.map((r) => r.responseTime)) : null,
    }

    return NextResponse.json({
      success: analysis.hasWorkingConnection,
      analysis,
      results,
      recommendations: generateRecommendations(results, analysis),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Oracle connection test failed:", error)

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

function generateRecommendations(results: any[], analysis: any): string[] {
  const recommendations = []

  if (!analysis.hasWorkingConnection) {
    recommendations.push("No successful connections - check if Oracle VM is running and accessible")
    recommendations.push("Verify Oracle Cloud Security Lists allow inbound traffic on port 8080")
    recommendations.push("SSH into VM and test locally: curl http://localhost:8080/health")
    recommendations.push("Check if stream server is running: sudo systemctl status oracle-stream-server")
  } else {
    if (analysis.preferredProtocol === "HTTP") {
      recommendations.push("HTTP connections work - consider setting up HTTPS for security")
      recommendations.push("Update environment variable to use http:// prefix")
    } else if (analysis.preferredProtocol === "HTTPS") {
      recommendations.push("HTTPS connections work - great for security!")
      recommendations.push("Update environment variable to use https:// prefix")
    }
  }

  // Check for specific error patterns
  const timeoutErrors = results.filter((r) => r.error?.includes("timeout") || r.error?.includes("AbortError"))
  if (timeoutErrors.length > 0) {
    recommendations.push("Connection timeouts detected - check network connectivity and server performance")
  }

  const connectionRefused = results.filter((r) => r.error?.includes("ECONNREFUSED") || r.error?.includes("refused"))
  if (connectionRefused.length > 0) {
    recommendations.push("Connection refused - server may not be listening on the expected port")
  }

  return recommendations
}
