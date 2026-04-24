export function buildPasswordResetOtpEmailHtml(otp: string) {
  const year = new Date().getFullYear();

  return `
<div style="font-family: Arial, sans-serif; background:#f6f8fb; padding:40px;">
  <div style="max-width:600px; background:#ffffff; margin:auto; padding:30px; border-radius:12px; border:1px solid #e5e7eb;">
    <h2 style="color:#0B2D5B; margin:0;">SVA | UT-Dallas</h2>
    <p style="color:#6b7280; margin-top:8px;">Password Reset Request</p>

    <p style="margin-top:24px; color:#111827; line-height:1.6;">
      We received a request to reset your password. Use the one-time verification code below to continue.
    </p>

    <div style="text-align:center; margin:32px 0;">
      <div style="display:inline-block; padding:16px 24px; border-radius:12px; background:#f3f4f6; border:1px solid #e5e7eb;">
        <strong style="font-size:32px; letter-spacing:8px; color:#0B2D5B;">
          ${otp}
        </strong>
      </div>
    </div>

    <p style="font-size:14px; color:#4b5563; line-height:1.6;">
      This code expires in <strong>10 minutes</strong>. If you did not request a password reset, you can safely ignore this email.
    </p>

    <hr style="border:none; border-top:1px solid #e5e7eb; margin:30px 0;" />

    <p style="font-size:12px; color:#9ca3af;">
      © ${year} SVA | UT-Dallas. All rights reserved.
    </p>
  </div>
</div>`;
}

export function buildPasswordResetOtpEmailText(otp: string) {
  return `SVA | UT-Dallas password reset code: ${otp}

This code expires in 10 minutes. If you did not request a password reset, you can ignore this email.`;
}