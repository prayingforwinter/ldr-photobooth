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

    // Extract hostname and port
    const [hostname, port = "8080"] = baseUrl.split(":")

    console.log(`🔍 Testing Oracle server: ${hostname}:${port}`)

    // Initialize diagnostics object
    const diagnostics = {
      hostname,
      port,
      tests: {
        basicConnectivity: { success: false, error: "", details: "" },
        httpFetch: { success: false, error: "", details: "" },
        httpsTest: { success: false, error: "", details: "" },
      },
      recommendations: [] as string[],
    }

    // Test URLs to try
    const urlsToTry = [
      { url: `http://${baseUrl}/health`, protocol: "HTTP" },
      { url: `https://${baseUrl}/health`, protocol: "HTTPS" },
    ]

    let lastError = ""
    const connectionSuccess = false

    // Try each URL
    for (const { url, protocol } of urlsToTry) {
      try {
        console.log(`🌐 Testing ${protocol} connection to ${url}...`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

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
        const responseText = await response.text()

        console.log(`📄 Response from ${url}: Status ${response.status}`)
        console.log(`📄 Response body preview: ${responseText.substring(0, 100)}`)

        if (response.ok) {
          // Mark the appropriate test as successful
          if (protocol === "HTTP") {
            diagnostics.tests.httpFetch.success = true
            diagnostics.tests.httpFetch.details = `Successfully connected via ${url}`
          } else {
            diagnostics.tests.httpsTest.success = true
            diagnostics.tests.httpsTest.details = `Successfully connected via ${url}`
          }

          diagnostics.tests.basicConnectivity.success = true
          diagnostics.tests.basicConnectivity.details = "Server is reachable and responding"

          let data
          try {
            data = JSON.parse(responseText)
          } catch (parseError) {
            // If we can't parse as JSON but got a successful response
            data = {
              status: "healthy",
              note: "Server responded but with non-JSON data",
              rawResponse: responseText.substring(0, 100),
              protocol,
            }
          }

          console.log(`✅ ${protocol} connection successful to ${url}`)

          return NextResponse.json({
            success: true,
            status: "online",
            data: {
              ...data,
              protocol,
              testedUrl: url,
              method: "fetch",
            },
            diagnostics,
            serverUrl: url,
            timestamp: new Date().toISOString(),
          })
        } else {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`
          lastError = `${url}: ${errorMsg}`

          if (protocol === "HTTP") {
            diagnostics.tests.httpFetch.error = errorMsg
            diagnostics.tests.httpFetch.details = responseText.substring(0, 200)
          } else {
            diagnostics.tests.httpsTest.error = errorMsg
            diagnostics.tests.httpsTest.details = responseText.substring(0, 200)
          }

          console.log(`❌ ${protocol} connection failed: ${errorMsg}`)
        }
      } catch (fetchError) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : "Unknown fetch error"
        lastError = `${url}: ${errorMsg}`

        if (protocol === "HTTP") {
          diagnostics.tests.httpFetch.error = errorMsg
          diagnostics.tests.httpFetch.details = `Failed to connect to ${url}`
        } else {
          diagnostics.tests.httpsTest.error = errorMsg
          diagnostics.tests.httpsTest.details = `Failed to connect to ${url}`
        }

        console.log(`❌ ${protocol} fetch failed: ${errorMsg}`)

        // Check for specific error types
        if (errorMsg.includes("ECONNREFUSED")) {
          diagnostics.tests.basicConnectivity.error = "Connection refused - port may be closed"
        } else if (errorMsg.includes("ENOTFOUND")) {
          diagnostics.tests.basicConnectivity.error = "Host not found - check hostname/IP"
        } else if (errorMsg.includes("ETIMEDOUT") || errorMsg.includes("timeout")) {
          diagnostics.tests.basicConnectivity.error = "Connection timeout - check firewall/network"
        } else if (errorMsg.includes("NetworkError")) {
          diagnostics.tests.basicConnectivity.error = "Network error - check connectivity"
        } else {
          diagnostics.tests.basicConnectivity.error = errorMsg
        }
      }
    }

    // Generate recommendations based on test results
    if (!diagnostics.tests.basicConnectivity.success) {
      if (diagnostics.tests.basicConnectivity.error.includes("Connection refused")) {
        diagnostics.recommendations.push("🔴 Connection refused - Stream server may not be running")
        diagnostics.recommendations.push("SSH into VM and run: sudo systemctl status oracle-stream-server")
        diagnostics.recommendations.push("Start server: sudo systemctl start oracle-stream-server")
      } else if (diagnostics.tests.basicConnectivity.error.includes("timeout")) {
        diagnostics.recommendations.push("🔴 Connection timeout - Check firewall settings")
        diagnostics.recommendations.push("Oracle Cloud: Add ingress rule for port 8080 in Security Lists")
        diagnostics.recommendations.push("Ubuntu: Check firewall with 'sudo ufw status'")
        diagnostics.recommendations.push("Allow port: 'sudo ufw allow 8080'")
      } else if (diagnostics.tests.basicConnectivity.error.includes("Host not found")) {
        diagnostics.recommendations.push("🔴 Host not found - Check hostname/IP address")
        diagnostics.recommendations.push("Verify Oracle VM public IP is correct")
        diagnostics.recommendations.push("Check if VM is running in Oracle Cloud Console")
      } else {
        diagnostics.recommendations.push("🔴 Network connectivity issue")
        diagnostics.recommendations.push("Check if Oracle VM is running and accessible")
        diagnostics.recommendations.push("Verify the public IP address is correct")
      }
    }

    // If we get here, all connection attempts failed
    throw new Error(`All connection attempts failed. Last error: ${lastError}`)
  } catch (error) {
    console.error("Oracle health check failed:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    // Return detailed error information
    return NextResponse.json(
      {
        success: false,
        status: "offline",
        error: errorMessage,
        diagnostics: (error as any).diagnostics || {
          hostname: "unknown",
          port: "8080",
          tests: {
            basicConnectivity: { success: false, error: errorMessage, details: "" },
            httpFetch: { success: false, error: errorMessage, details: "" },
            httpsTest: { success: false, error: errorMessage, details: "" },
          },
          recommendations: [
            "Check if Oracle Cloud VM is running",
            "Verify Oracle Cloud Security Lists allow port 8080",
            "SSH into VM and test locally: curl http://localhost:8080/health",
          ],
        },
        troubleshooting: {
          immediateSteps: [
            "Check Oracle Cloud Console - ensure VM is running",
            "Verify the public IP address is correct",
            "SSH into VM and test locally: curl http://localhost:8080/health",
          ],
          networkSteps: [
            "Check Oracle Cloud Security Lists - ensure port 8080 is open for 0.0.0.0/0",
            "Check Ubuntu firewall: sudo ufw status",
            "Verify stream server is running: sudo systemctl status oracle-stream-server",
          ],
          serverSteps: [
            "Restart stream server: sudo systemctl restart oracle-stream-server",
            "Check server logs: sudo journalctl -u oracle-stream-server -f",
            "Test server locally: curl http://localhost:8080/health",
          ],
        },
        serverUrl: process.env.NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }, // Return 200 so the client can handle the error gracefully
    )
  }
}
