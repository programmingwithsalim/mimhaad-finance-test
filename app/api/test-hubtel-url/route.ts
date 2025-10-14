import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("🧪 Testing Hubtel URL Authentication...");

    // Test parameters from your working URL
    const clientId = "cbkmgino";
    const clientSecret = "alywcjxo";
    const senderId = "MIMHAADFS";
    const testPhone = "233549514616";
    const testMessage = "This Is A Test Message";

    // Build URL with query parameters
    const url = new URL("https://smsc.hubtel.com/v1/messages/send");
    url.searchParams.set("clientid", clientId);
    url.searchParams.set("clientsecret", clientSecret);
    url.searchParams.set("from", senderId);
    url.searchParams.set("to", testPhone);
    url.searchParams.set("content", testMessage);

    console.log(
      "🔗 Test URL:",
      url.toString().replace(/clientsecret=([^&]+)/, "clientsecret=***")
    );

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    console.log("📤 Hubtel Test Response:", result);

    return NextResponse.json({
      success: result.status === 0,
      message:
        result.status === 0 ? "Test SMS sent successfully" : "Test SMS failed",
      result,
      url: url.toString().replace(/clientsecret=([^&]+)/, "clientsecret=***"),
    });
  } catch (error) {
    console.error("Test error:", error);
    return NextResponse.json(
      { success: false, error: "Test failed" },
      { status: 500 }
    );
  }
}
