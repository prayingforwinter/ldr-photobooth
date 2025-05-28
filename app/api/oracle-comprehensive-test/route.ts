import { type NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import dns from "dns"

const execPromise = promisify(exec)
const dnsLookup = promisify(dns.lookup)

export async function GET(request: NextRequest) {
  try {
    const serverUrl = process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL

    if (!serverUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Oracle stream server URL not configured",
          step: "environment_check",
          recommendations: [
            "Add NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL to your environment variables",
            "Format should be: hostname:port (e.g., 168.138.103.248:8080) or full URL",
          ],
        },
        { status: 200 },
      )
    }

    // Parse the URL to extract hostname and port
    let hostname: string
    let port = "8080" // Default port
    let protocol = "http:" // Default protocol
    let parsedUrl: URL | null = null

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
      return NextResponse.json(
        {
          success: false,
          error: "Invalid server URL format",
          details: parseError instanceof Error ? parseError.message : "URL parsing failed",
          step: "url_parsing",
          serverUrl,
          recommendations: [
            "Check the format of NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL",
            "Should be hostname:port (e.g., 168.138.103.248:8080) or full URL (http://hostname:port)",
          ],
        },
        { status: 200 },
      )
    }

    console.log(`🔍 Running comprehensive diagnostics for ${hostname}:${port}`)

    // Step 1: DNS Resolution Test
    let dnsResult: { success: boolean; error?: string; ip?: string } = { success: false }

    try {
      const dnsResponse = await dnsLookup(hostname)
      dnsResult = {
        success: true,
        ip: dnsResponse.address,
      }
      console.log(`✅ DNS resolution successful: ${hostname} -> ${dnsResponse.address}`)
    } catch (dnsError) {
      dnsResult = {
        success: false,
        error: dnsError instanceof Error ? dnsError.message : "DNS lookup failed",
      }
      console.error(`❌ DNS resolution failed for ${hostname}:`, dnsError)
    }

    // If DNS failed, return early with detailed error
    if (!dnsResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `DNS resolution failed: ${dnsResult.error}`,
          step: "dns_resolution",
          hostname,
          recommendations: [
            "Verify the hostname/IP is correct",
            "Check if the Oracle VM is running",
            "Ensure the VM has a public IP address",
            "Try using the IP address directly instead of hostname",
          ],
        },
        { status: 200 },
      )
    }

    // Step 2: HTTP Connection Test
    const httpTestResults = await testHttpConnection(`http://${hostname}:${port}/health`)

    // Step 3: HTTPS Connection Test
    const httpsTestResults = await testHttpConnection(`https://${hostname}:${port}/health`)

    // Step 4: Raw Socket Test (using fetch with different timeout)
    const socketTestResults = await testRawConnection(hostname, port)

    // Analyze results and provide recommendations
    const analysis = analyzeResults({
      dns: dnsResult,
      http: httpTestResults,
      https: httpsTestResults,
      socket: socketTestResults,
      hostname,
      port,
      protocol,
      serverUrl,
    })

    return NextResponse.json(
      {
        success: analysis.anyConnectionSuccessful,
        tests: {
          dns: dnsResult,
          http: httpTestResults,
          https: httpsTestResults,
          socket: socketTestResults,
        },
        analysis,
        serverUrl,
        parsedUrl: {
          hostname,
          port,
          protocol,
          full: parsedUrl?.toString() || `${protocol}//${hostname}:${port}`,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Comprehensive test failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error in diagnostic test",
        step: "general_error",
        recommendations: [
          "Check server logs for more details",
          "Verify environment variables are set correctly",
          "Try running the test again",
        ],
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  }
}

async function testHttpConnection(url: string): Promise<{
  success: boolean
  statusCode?: number
  error?: string
  responseText?: string
  headers?: Record<string, string>
  timing?: number
}> {
  const startTime = Date.now()

  try {
    console.log(`🌐 Testing connection to ${url}...`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Vercel-Diagnostic-Tool/1.0",
        Accept: "*/*",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const timing = Date.now() - startTime
    const responseText = await response.text()

    // Get headers as object
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    console.log(`✅ Connection to ${url} successful: HTTP ${response.status}`)

    return {
      success: response.ok,
      statusCode: response.status,
      responseText: responseText.substring(0, 500), // Limit response size
      headers,
      timing,
    }
  } catch (error) {
    const timing = Date.now() - startTime

    let errorMessage = "Unknown error"
    if (error instanceof Error) {
      errorMessage = error.message
      console.error(`❌ Connection to ${url} failed:`, errorMessage)

      // Classify error types for better diagnostics
      if (errorMessage.includes("abort")) {
        errorMessage = "Connection timed out after 10 seconds"
      } else if (errorMessage.includes("ECONNREFUSED")) {
        errorMessage = "Connection refused - port may be closed or service not running"
      } else if (errorMessage.includes("ENOTFOUND")) {
        errorMessage = "Host not found - DNS resolution failed"
      } else if (errorMessage.includes("certificate")) {
        errorMessage = "SSL certificate error - self-signed or invalid certificate"
      }
    }

    return {
      success: false,
      error: errorMessage,
      timing,
    }
  }
}

async function testRawConnection(
  hostname: string,
  port: string,
): Promise<{
  success: boolean
  error?: string
  timing?: number
}> {
  const startTime = Date.now()

  try {
    console.log(`🔌 Testing raw socket connection to ${hostname}:${port}...`)

    // Use a very short timeout for basic connectivity test
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    // Just try to establish a connection without expecting any specific response
    await fetch(`http://${hostname}:${port}`, {
      method: "HEAD",
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const timing = Date.now() - startTime
    console.log(`✅ Raw socket connection to ${hostname}:${port} successful`)

    return {
      success: true,
      timing,
    }
  } catch (error) {
    const timing = Date.now() - startTime

    let errorMessage = "Unknown error"
    if (error instanceof Error) {
      errorMessage = error.message
      console.error(`❌ Raw socket connection to ${hostname}:${port} failed:`, errorMessage)
    }

    return {
      success: false,
      error: errorMessage,
      timing,
    }
  }
}

function analyzeResults(results: any) {
  const { dns, http, https, socket, hostname, port, protocol, serverUrl } = results

  // Check if any connection method succeeded
  const anyConnectionSuccessful = http.success || https.success || socket.success

  // Determine best connection method
  let bestMethod = "none"
  if (https.success) bestMethod = "https"
  else if (http.success) bestMethod = "http"
  else if (socket.success) bestMethod = "socket"

  // Generate recommendations based on test results
  const recommendations: string[] = []
  const errors: string[] = []

  // DNS is successful but connections fail
  if (dns.success && !anyConnectionSuccessful) {
    errors.push("DNS resolves but cannot connect to server")
    recommendations.push("Check if Oracle VM firewall allows port " + port)
    recommendations.push("Verify Oracle Cloud Security Lists allow inbound traffic on port " + port)
    recommendations.push("Check if stream server is running: sudo systemctl status oracle-stream-server")
  }

  // Connection refused errors
  if (
    (http.error && http.error.includes("refused")) ||
    (https.error && https.error.includes("refused")) ||
    (socket.error && socket.error.includes("refused"))
  ) {
    errors.push("Connection refused")
    recommendations.push("Ensure stream server is running on port " + port)
    recommendations.push("Check if the port is correct in your environment variable")
    recommendations.push("Verify no firewall is blocking the connection")
  }

  // Timeout errors
  if (
    (http.error && http.error.includes("timeout")) ||
    (https.error && https.error.includes("timeout")) ||
    (socket.error && socket.error.includes("timeout"))
  ) {
    errors.push("Connection timeout")
    recommendations.push("Check if Oracle VM is responding to network requests")
    recommendations.push("Verify network path between Vercel and Oracle Cloud")
  }

  // SSL errors
  if (https.error && https.error.includes("certificate")) {
    errors.push("SSL certificate error")
    recommendations.push("Your server may be using a self-signed certificate")
    recommendations.push("Try using HTTP instead of HTTPS in your environment variable")
  }

  // HTTP status errors
  if (http.statusCode && http.statusCode >= 400) {
    errors.push(`HTTP error ${http.statusCode}`)
    recommendations.push("Check server logs for error details")
    recommendations.push("Verify the /health endpoint is implemented correctly")
  }

  // If HTTPS works but HTTP doesn't
  if (https.success && !http.success) {
    recommendations.push("Use HTTPS in your environment variable: https://" + hostname + ":" + port)
  }

  // If HTTP works but HTTPS doesn't
  if (http.success && !https.success) {
    recommendations.push("Use HTTP in your environment variable: http://" + hostname + ":" + port)
  }

  // If no connection method works
  if (!anyConnectionSuccessful) {
    recommendations.push("SSH into your Oracle VM and check if the server is running")
    recommendations.push("Test locally: curl http://localhost:8080/health")
    recommendations.push("Check Oracle Cloud Console to ensure VM is running")
  }

  // Check if the URL format might be wrong
  if (serverUrl && !serverUrl.includes("://") && !serverUrl.includes(":")) {
    recommendations.push("Your URL might be missing the port. Try: " + serverUrl + ":8080")
  }

  // If everything works
  if (anyConnectionSuccessful) {
    recommendations.push(`Use ${bestMethod.toUpperCase()} protocol in your environment variable`)
    if (bestMethod === "https") {
      recommendations.push("Update to: NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL=https://" + hostname + ":" + port)
    } else if (bestMethod === "http") {
      recommendations.push("Update to: NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL=http://" + hostname + ":" + port)
    }
  }

  return {
    anyConnectionSuccessful,
    bestMethod,
    errors,
    recommendations,
  }
}
