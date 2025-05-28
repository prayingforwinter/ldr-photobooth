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

    // Extract hostname and port from URL
    let hostname: string
    let port = "8080" // Default port

    if (serverUrl.includes("://")) {
      const urlParts = serverUrl.split("://")[1].split(":")
      hostname = urlParts[0].split("/")[0]
      if (urlParts.length > 1) {
        port = urlParts[1].split("/")[0]
      }
    } else {
      const urlParts = serverUrl.split(":")
      hostname = urlParts[0].split("/")[0]
      if (urlParts.length > 1) {
        port = urlParts[1].split("/")[0]
      }
    }

    console.log(`🔍 Testing port connectivity to Oracle server: ${hostname}:${port}`)

    // Use nc (netcat) to test port connectivity with a timeout
    try {
      const { stdout, stderr } = await execPromise(`nc -zv -w 5 ${hostname} ${port}`)

      console.log("Netcat stdout:", stdout)
      if (stderr) console.log("Netcat stderr:", stderr)

      const success =
        stdout.includes("succeeded") ||
        stderr.includes("succeeded") ||
        stdout.includes("open") ||
        stderr.includes("open")

      return NextResponse.json({
        success,
        status: success ? "open" : "closed",
        port,
        hostname,
        raw: stdout || stderr,
        timestamp: new Date().toISOString(),
      })
    } catch (ncError) {
      console.error("Port test failed:", ncError)

      // Try with timeout command as fallback
      try {
        const { stdout, stderr } = await execPromise(`timeout 5 bash -c "</dev/tcp/${hostname}/${port}"`)

        return NextResponse.json({
          success: true,
          status: "open",
          port,
          hostname,
          method: "bash",
          timestamp: new Date().toISOString(),
        })
      } catch (bashError) {
        return NextResponse.json({
          success: false,
          status: "closed",
          error: "Port is closed or unreachable",
          port,
          hostname,
          timestamp: new Date().toISOString(),
        })
      }
    }
  } catch (error) {
    console.error("Oracle port test failed:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        success: false,
        status: "error",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  }
}
