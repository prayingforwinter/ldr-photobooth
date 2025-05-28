import { NextResponse } from "next/server"
import crypto from "crypto"

export async function GET() {
  try {
    const turnServerUrl = process.env.NEXT_PUBLIC_TURN_SERVER_URL
    const turnServerSecret = process.env.TURN_SERVER_SECRET

    if (!turnServerUrl || !turnServerSecret) {
      return NextResponse.json({ error: "TURN server not configured" }, { status: 500 })
    }

    // Generate time-limited credentials
    const username = "webrtc"
    const timestamp = Math.floor(Date.now() / 1000) + 3600 // Valid for 1 hour
    const tempUsername = `${timestamp}:${username}`

    // Generate HMAC-SHA1 credential
    const hmac = crypto.createHmac("sha1", turnServerSecret)
    hmac.update(tempUsername)
    const tempCredential = hmac.digest("base64")

    return NextResponse.json({
      urls: [
        `turn:${turnServerUrl}`,
        `turn:${turnServerUrl.replace("3478", "5349")}`, // TLS version
      ],
      username: tempUsername,
      credential: tempCredential,
      ttl: 3600, // 1 hour
    })
  } catch (error) {
    console.error("Error generating TURN credentials:", error)
    return NextResponse.json({ error: "Failed to generate credentials" }, { status: 500 })
  }
}
