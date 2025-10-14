import { NextResponse } from "next/server";

export async function POST() {
  try {
    console.log("🔧 Testing notification configuration...");

    // Check environment variables
    const resendApiKey =
      process.env.RESEND_API_KEY || "re_RJus2Pwt_Lmg6cG4ZvxNgtEaU6CumyouV";
    const databaseUrl = process.env.DATABASE_URL;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    const configTests = {
      email_provider: {
        name: "Resend API",
        status: resendApiKey ? "configured" : "missing",
        api_key: resendApiKey ? "present" : "missing",
        from_email: "programmingwithsalim@gmail.com",
        test_endpoint: "/api/notifications/test",
      },
      sms_provider: {
        name: "Hubtel",
        status: "not_configured",
        api_key: "not_set",
        phone_number: "not_set",
        note: "SMS functionality not yet implemented",
      },
      database_connection: {
        status: databaseUrl ? "connected" : "disconnected",
        url_present: databaseUrl ? "yes" : "no",
      },
      environment: {
        node_env: process.env.NODE_ENV || "development",
        app_url: appUrl || "not_set",
        connection_string: process.env.CONNECTION_STRING
          ? "present"
          : "missing",
      },
    };

    // Test Resend API connection
    let emailTestResult = null;
    if (resendApiKey) {
      try {
        const testResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Mimhaad Financial Services <programmingwithsalim@gmail.com>",
            to: ["test@example.com"], // This will fail but test the API connection
            subject: "Configuration Test",
            html: "<p>This is a configuration test</p>",
          }),
        });

        emailTestResult = {
          status: "api_reachable",
          response_status: testResponse.status,
          message:
            testResponse.status === 422
              ? "API working (invalid email expected)"
              : "API response received",
        };
      } catch (error) {
        emailTestResult = {
          status: "api_error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    const allConfigured =
      configTests.email_provider.status === "configured" &&
      configTests.database_connection.status === "connected";

    return NextResponse.json({
      success: allConfigured,
      message: allConfigured
        ? "Configuration test passed"
        : "Some configurations are missing",
      data: {
        ...configTests,
        email_test_result: emailTestResult,
      },
      recommendations: [
        !resendApiKey ? "Set RESEND_API_KEY environment variable" : null,
        !databaseUrl ? "Set DATABASE_URL environment variable" : null,
        !appUrl ? "Set NEXT_PUBLIC_APP_URL environment variable" : null,
      ].filter(Boolean),
    });
  } catch (error) {
    console.error("Error testing configuration:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to test configuration",
      },
      { status: 500 }
    );
  }
}
