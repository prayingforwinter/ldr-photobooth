"use client"

import { OracleComprehensiveDiagnostics } from "@/components/oracle-comprehensive-diagnostics"
import { OracleDiagnostics } from "@/components/oracle-diagnostics"
import { OracleStreamMonitor } from "@/components/oracle-stream-monitor"

export default function DiagnosticsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Oracle Connection Diagnostics</h1>
          <p className="text-gray-600">Comprehensive tools to diagnose connection issues</p>
        </div>

        <div className="space-y-6">
          <OracleComprehensiveDiagnostics />
          <OracleDiagnostics />
          <OracleStreamMonitor />
        </div>
      </div>
    </div>
  )
}
