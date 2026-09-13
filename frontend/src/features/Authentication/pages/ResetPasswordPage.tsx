import React, { useState, useMemo, useEffect } from 'react';
import AuthLayout from '../components/AuthLayout';
import Button from '../../../components/Button';
import { useLanguage } from '../../../context/LanguageContext';
import { authService } from '../../../services/auth.service';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

interface Props {
  onGoToLogin: () => void;
  onGoToForgotPassword: () => void;
  token?: string;
}

// Password requirement checks matching registration & backend validation
const pwChecks = [
  { key: 'len', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'At least 1 uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'At least 1 lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { key: 'num', label: 'At least 1 number', test: (p: string) => /[0-9]/.test(p) },
  { key: 'spec', label: 'At least 1 special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function ResetPasswordPage({ onGoToLogin, onGoToForgotPassword, token: propToken }: Props) {
  // Extract token from query parameters if not provided via props
  const [token, setToken] = useState<string>(() => {
    if (propToken) return propToken;
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('token') || '';
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPwHints, setShowPwHints] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const { t } = useLanguage();

  useEffect(() => {
    if (!token) {
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get('token');
      if (urlToken) setToken(urlToken);
    }
  }, [token]);

  // Countdown timer redirecting to login after success
  useEffect(() => {
    if (!isSuccess) return;

    if (countdown <= 0) {
      onGoToLogin();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isSuccess, countdown, onGoToLogin]);

  const pwResults = useMemo(
    () => pwChecks.map((c) => ({ ...c, passed: c.test(newPassword) })),
    [newPassword]
  );
  const allPwPassed = pwResults.every((c) => c.passed);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError(t('auth.missingToken', 'Password reset token is missing. Please request a new link.'));
      return;
    }

    if (!allPwPassed) {
      const failed = pwResults.find((c) => !c.passed);
      setError(failed ? failed.label : t('auth.invalidPasswordCriteria', 'Password does not meet the requirements.'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch', 'Passwords do not match.'));
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({
        token,
        newPassword,
        confirmPassword,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        t('auth.resetFailed', 'Unable to reset your password. The link may be expired or invalid.')
      );
    } finally {
      setLoading(false);
    }
  };

  // If no token was provided in the link
  if (!token && !isSuccess) {
    return (
      <AuthLayout
        title={t('auth.invalidLinkTitle', 'Invalid Reset Link')}
        subtitle={t('auth.invalidLinkSubtitle', 'The password reset link is invalid or has expired.')}
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">
            {t(
              'auth.noTokenExplanation',
              'This password reset link is missing a valid security token. Please request a new link to reset your account password.'
            )}
          </p>

          <div className="space-y-3 pt-2">
            <Button
              onClick={onGoToForgotPassword}
              className="w-full justify-center shadow-md shadow-pink-500/20"
            >
              {t('auth.requestNewLink', 'Request New Reset Link')}
            </Button>

            <button
              type="button"
              onClick={onGoToLogin}
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 text-sm font-medium text-gray-600 hover:text-pink-600 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('auth.backToSignIn', 'Back to Sign In')}
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={isSuccess ? t('auth.passwordUpdated', 'Password Updated!') : t('auth.createNewPassword', 'Create New Password')}
      subtitle={
        isSuccess
          ? t('auth.passwordUpdatedSubtitle', 'Your password has been changed successfully.')
          : t('auth.enterNewPasswordSubtitle', 'Please choose a strong new password for your account.')
      }
    >
      {isSuccess ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-900 leading-relaxed text-left">
            <p className="font-semibold text-emerald-950 mb-1">
              {t('auth.successResetTitle', 'Account Security Updated')}
            </p>
            <p className="text-xs sm:text-sm text-emerald-800">
              {t(
                'auth.successResetMessage',
                'Your new password is now active. All previous reset links have been invalidated.'
              )}
            </p>
          </div>

          <p className="text-xs text-gray-500">
            {t('auth.redirectingIn', 'Redirecting to login in {seconds} seconds...', { seconds: countdown })}
          </p>

          <Button onClick={onGoToLogin} className="w-full justify-center shadow-md shadow-pink-500/20">
            {t('auth.signInNow', 'Sign In Now')}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <div className="text-xs sm:text-sm flex-1">
                {error}
                {error.includes('expired') || error.includes('Invalid') ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={onGoToForgotPassword}
                      className="text-xs font-semibold text-pink-700 underline hover:text-pink-800"
                    >
                      {t('auth.requestNewLinkPrompt', 'Click here to request a fresh reset link')} &rarr;
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* New Password Input */}
          <div className="flex flex-col">
            <label htmlFor="reset-new-password" className="text-sm text-gray-600 font-medium mb-1.5 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-gray-400" />
              {t('auth.newPassword', 'New Password')}
            </label>
            <div className="relative">
              <input
                id="reset-new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={() => setShowPwHints(true)}
                placeholder="Enter new password"
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 bg-white text-gray-800 text-sm placeholder:text-gray-400 transition"
                required
                disabled={loading}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Live Password Checklist */}
            {showPwHints && (
              <div className="mt-2.5 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {t('auth.passwordRequirements', 'Password Requirements')}
                </p>
                <ul className="space-y-1.5">
                  {pwResults.map((c) => (
                    <li
                      key={c.key}
                      className={`flex items-center gap-2 text-xs transition-colors duration-150 ${
                        c.passed ? 'text-emerald-700 font-medium' : 'text-gray-400'
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                          c.passed ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {c.passed ? '✓' : '·'}
                      </span>
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Confirm New Password Input */}
          <div className="flex flex-col">
            <label htmlFor="reset-confirm-password" className="text-sm text-gray-600 font-medium mb-1.5 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-gray-400" />
              {t('auth.confirmPassword', 'Confirm New Password')}
            </label>
            <div className="relative">
              <input
                id="reset-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className={`w-full border rounded-xl px-3.5 py-2.5 pr-10 focus:outline-none focus:ring-2 bg-white text-gray-800 text-sm placeholder:text-gray-400 transition ${
                  confirmPassword && !passwordsMatch
                    ? 'border-rose-300 focus:ring-rose-500/30 focus:border-rose-500'
                    : confirmPassword && passwordsMatch
                    ? 'border-emerald-400 focus:ring-emerald-500/30 focus:border-emerald-500'
                    : 'border-gray-300 focus:ring-pink-500/30 focus:border-pink-500'
                }`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {confirmPassword && (
              <span className={`text-xs mt-1.5 flex items-center gap-1 ${passwordsMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
                {passwordsMatch ? '✓ ' + t('auth.passwordsMatch', 'Passwords match') : '✕ ' + t('auth.passwordsDoNotMatch', 'Passwords do not match')}
              </span>
            )}
          </div>

          <div className="pt-2 space-y-3">
            <Button
              type="submit"
              disabled={loading || !allPwPassed || !passwordsMatch}
              className="w-full justify-center shadow-md shadow-pink-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  {t('auth.updatingPassword', 'Updating Password...')}
                </>
              ) : (
                t('auth.resetPassword', 'Reset Password')
              )}
            </Button>

            <button
              type="button"
              onClick={onGoToLogin}
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 text-sm font-medium text-gray-600 hover:text-pink-600 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('auth.backToSignIn', 'Back to Sign In')}
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

export default ResetPasswordPage;
