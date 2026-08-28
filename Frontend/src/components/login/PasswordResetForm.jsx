import { Loader2 } from "lucide-react";

import { sanitizeOtp } from "../../utils/loginPage.js";
import { PasswordField } from "./PasswordField.jsx";

// ================= PASSWORD RESET FORM (Admin / Agent share the same block) =================
export const PasswordResetForm = ({
  infoText,
  otp,
  onOtpChange,
  newPassword,
  onNewPasswordChange,
  showNewPassword,
  onToggleShowNewPassword,
  confirmPassword,
  onConfirmPasswordChange,
  showConfirmPassword,
  onToggleShowConfirmPassword,
  otpRequestsRemaining,
  otpSent,
  onRequestOtp,
  onResendOtp,
  onBack,
  loading,
}) => {
  return (
    <>
      <div className="rounded-[14px] border border-[#E7DAC6] bg-[#FFF8EC] p-3 text-xs text-[#8B7355]">
        {infoText}
      </div>

      {!otpSent ? (
        <button
          type="button"
          onClick={onRequestOtp}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#B8641A] py-3 font-semibold text-white hover:bg-[#9F5313] disabled:bg-[#D8C8B2]"
        >
          {loading ? <Loader2 className="animate-spin" /> : "Send OTP"}
        </button>
      ) : (
        <>
          {typeof otpRequestsRemaining === "number" && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">
                OTP requests remaining: {otpRequestsRemaining}
              </span>
              <button
                type="button"
                onClick={onResendOtp}
                disabled={loading || otpRequestsRemaining <= 0}
                className="font-semibold text-[#B8641A] hover:underline disabled:text-[#C4A882] disabled:no-underline"
              >
                Resend OTP
              </button>
            </div>
          )}
          {otpRequestsRemaining === 0 && (
            <p className="text-xs text-red-600 font-medium">
              Limit reached. Try after 15 minutes.
            </p>
          )}

          <input
            value={otp}
            onChange={(e) => onOtpChange(sanitizeOtp(e.target.value))}
            placeholder="Enter 6-digit OTP"
            className="w-full rounded-[16px] border border-[#EDE8DF] py-3 text-center font-mono text-2xl tracking-widest outline-none focus:border-[#B8641A]"
            autoFocus
          />

          <PasswordField
            value={newPassword}
            onChange={(e) => onNewPasswordChange(e.target.value)}
            placeholder="New password"
            show={showNewPassword}
            onToggleShow={onToggleShowNewPassword}
          />

          <PasswordField
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
            placeholder="Confirm new password"
            show={showConfirmPassword}
            onToggleShow={onToggleShowConfirmPassword}
          />

          <button
            disabled={loading || otp.length < 6 || !newPassword || !confirmPassword}
            className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#4A7C2F] py-3 font-semibold text-white hover:bg-[#3E6928] disabled:bg-[#BFD4AF]"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Reset Password"}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full text-sm text-[#8B7355] hover:text-[#5C3D1E]"
          >
            Back to Login
          </button>
        </>
      )}
    </>
  );
};
