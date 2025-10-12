"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth-context";
import {
  Eye,
  EyeOff,
  Loader2,
  Sun,
  Moon,
  Shield,
  ArrowLeft,
} from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 2FA States
  const [requires2FA, setRequires2FA] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [userId, setUserId] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);
  const [resendingOtp, setResendingOtp] = useState(false);

  const { user, isLoading: authLoading, refreshSession } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  // Set mounted state to true after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Check if 2FA is required
        if (data.requires2FA) {
          setRequires2FA(true);
          setUserId(data.userId);
          if (data.expiresAt) {
            setOtpExpiresAt(new Date(data.expiresAt));
          }
          setError("");

          // Show message about OTP
          if (!data.otpSent) {
            setError(
              data.error || "Could not send OTP. Please use a backup code."
            );
          }
        } else if (data.user) {
          // Normal login success
          await refreshSession();
          router.push("/dashboard");
        } else {
          setError(
            "Invalid email or password. Please check your credentials and try again."
          );
        }
      } else {
        setError(
          data.error ||
            "Invalid email or password. Please check your credentials and try again."
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          userId,
          code: otpCode, // Changed from 'token' to 'code'
          isBackupCode: false,
          trustDevice: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Complete the login
        const completeResponse = await fetch("/api/auth/login-complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            userId,
            verified2FA: true,
            trustDevice: true, // Remember this device
          }),
        });

        const completeData = await completeResponse.json();

        if (completeResponse.ok && completeData.user) {
          await refreshSession();
          router.push("/dashboard");
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          setError("Failed to complete login. Please try again.");
        }
      } else {
        setError(data.error || "Invalid verification code. Please try again.");
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("An error occurred during verification. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setResendingOtp(true);

    try {
      const response = await fetch("/api/auth/2fa/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.expiresAt) {
          setOtpExpiresAt(new Date(data.expiresAt));
        }
        setError("");
        alert("New verification code sent!");
      } else {
        setError(data.error || "Failed to resend code. Please try again.");
      }
    } catch (error) {
      console.error("Resend OTP error:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setResendingOtp(false);
    }
  };

  const handleBackToLogin = () => {
    setRequires2FA(false);
    setOtpCode("");
    setError("");
  };

  const handleForgotPassword = () => {
    alert("Please contact your administrator to reset your password.");
  };

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Don't render login form if user is already authenticated
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Redirecting to dashboard...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background with vertical sea blue stripe */}
      <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900">
        <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-[600px] bg-gradient-to-b from-cyan-100 to-sky-200 dark:from-cyan-900/30 dark:to-sky-800/30 opacity-60"></div>
      </div>

      {/* Theme Toggle Button - Top Right */}
      {mounted && (
        <div className="absolute top-6 right-6 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleThemeToggle}
            className="h-10 w-10 rounded-full bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      )}

      <Card className="w-full max-w-sm shadow-xl border-0 bg-white dark:bg-gray-800 relative z-10">
        <CardContent className="p-6">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Mimhaad Financial Services Logo"
                width={48}
                height={48}
                className="rounded-full"
              />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
              {requires2FA
                ? "Two-Factor Authentication"
                : "Mimhaad Financial Services"}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {requires2FA
                ? "Enter the verification code sent to your device"
                : "Enter your credentials to access your account"}
            </p>
          </div>

          {/* Form - Login or OTP Verification */}
          {!requires2FA ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Email Field */}
              <div className="space-y-1">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-10 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 text-sm"
                  autoComplete="email"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label
                    htmlFor="password"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Password
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 h-auto"
                    onClick={handleForgotPassword}
                    disabled={isLoading}
                  >
                    Forgot password?
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-10 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 pr-10 text-sm"
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Sign In Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-10 bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 text-white font-medium text-sm"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* OTP Code Field */}
              <div className="space-y-1">
                <Label
                  htmlFor="otp"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Verification Code
                </Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  disabled={isLoading}
                  className="h-10 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 text-sm text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoComplete="off"
                  autoFocus
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                  Enter the 6-digit code sent to your device
                </p>
              </div>

              {/* Verify Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm"
                  disabled={isLoading || otpCode.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Verify Code
                    </>
                  )}
                </Button>
              </div>

              {/* Resend OTP */}
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  onClick={handleResendOtp}
                  disabled={resendingOtp || isLoading}
                >
                  {resendingOtp ? "Sending..." : "Resend Code"}
                </Button>
              </div>

              {/* Back to Login */}
              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={handleBackToLogin}
                  disabled={isLoading}
                >
                  <ArrowLeft className="mr-1 h-3 w-3" />
                  Back to Login
                </Button>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              © 2025 Mimhaad Financial Services Ltd.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
