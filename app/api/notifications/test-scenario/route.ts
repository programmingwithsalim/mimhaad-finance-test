import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { scenario, recipient, phone } = await request.json()

    if (!recipient) {
      return NextResponse.json({ success: false, error: "Recipient email is required" }, { status: 400 })
    }

    const scenarios = {
      transaction_alert: {
        subject: "High-Value Transaction Alert",
        message: "A high-value transaction of GHS 50,000 has been processed on your account.",
        priority: "high",
      },
      low_balance: {
        subject: "Low Balance Warning",
        message: "Your MoMo float balance is below the minimum threshold (GHS 1,000).",
        priority: "medium",
      },
      security_alert: {
        subject: "Security Alert - New Login",
        message: "A new login was detected from an unrecognized device.",
        priority: "high",
      },
      system_maintenance: {
        subject: "Scheduled System Maintenance",
        message: "System maintenance is scheduled for tonight from 2:00 AM to 4:00 AM.",
        priority: "low",
      },
      approval_request: {
        subject: "Approval Request - Float Allocation",
        message: "A new float allocation request requires your approval.",
        priority: "medium",
      },
    }

    const scenarioData = scenarios[scenario as keyof typeof scenarios]

    if (!scenarioData) {
      return NextResponse.json({ success: false, error: "Invalid scenario type" }, { status: 400 })
    }

    console.log("🎭 Testing scenario:", {
      scenario,
      recipient,
      phone,
      scenarioData,
    })

    // Simulate scenario test
    const testResult = {
      success: true,
      scenario,
      recipient,
      phone,
      scenarioData,
      timestamp: new Date().toISOString(),
      messageId: `scenario_${scenario}_${Date.now()}`,
    }

    return NextResponse.json({
      success: true,
      message: `Scenario test '${scenario}' completed successfully`,
      data: testResult,
    })
  } catch (error) {
    console.error("❌ Error testing scenario:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to test scenario",
      },
      { status: 500 },
    )
  }
}
