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

    // Extract hostname from URL
    let hostname: string
    if (serverUrl.includes("://")) {
      hostname = serverUrl.split("://")[1].split(":")[0].split("/")[0]
    } else {
      hostname = serverUrl.split(":")[0].split("/")[0]
    }

    console.log(`🔍 Pinging Oracle server: ${hostname}`)

    // Use ping to test basic connectivity
    try {
      const { stdout, stderr } = await execPromise(`ping -c 3 ${hostname}`)

      console.log("Ping stdout:", stdout)
      if (stderr) console.log("Ping stderr:", stderr)

      // Extract ping statistics
      const pingResults = {
        raw: stdout,
        success: stdout.includes("bytes from"),
        packetLoss: stdout.match(/(\d+)% packet loss/)?.[1] || "unknown",
        avgTime: stdout.match(/min\/avg\/max\/mdev = [\d.]+\/([\d.]+)/)?.[1] || "unknown",
      }

      return NextResponse.json({
        success: pingResults.success,
        status: pingResults.success ? "reachable" : "unreachable",
        ping: pingResults,
        hostname,
        timestamp: new Date().toISOString(),
      })
    } catch (pingError) {
      console.error("Ping test failed:", pingError)

      return NextResponse.json({
        success: false,
        status: "unreachable",
        error: pingError instanceof Error ? pingError.message : "Unknown ping error",
        hostname,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error("Oracle ping failed:", error)

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
