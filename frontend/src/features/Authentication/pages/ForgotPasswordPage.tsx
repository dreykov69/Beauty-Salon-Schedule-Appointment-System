import React, { useState } from 'react';
import AuthLayout from '../components/AuthLayout';
import Button from '../../../components/Button';
import { useLanguage } from '../../../context/LanguageContext';
import { authService } from '../../../services/auth.service';
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  onGoToLogin: () => void;
}

export function ForgotPasswordPage({ onGoToLogin }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t('auth.enterValidEmail', 'Please enter a valid email address.'));
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(trimmedEmail);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        t('auth.forgotPasswordError', 'Unable to process your request. Please check your internet connection or try again later.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.forgotPasswordTitle', 'Forgot Password')}
      subtitle={
        isSubmitted
          ? t('auth.forgotPasswordCheckEmail', 'Check your inbox for reset instructions')
          : t('auth.forgotPasswordSubtitle', 'Enter your email to receive a password reset link')
      }
    >
      {isSubmitted ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div className="bg-pink-50/60 border border-pink-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed text-left">
            <p className="font-semibold text-gray-900 mb-1">
              {t('auth.resetLinkSent', 'Password reset email sent!')}
            </p>
            <p className="text-gray-600 text-xs sm:text-sm">
              {t(
                'auth.resetEmailSentExplanation',
                'If an account exists with that email, a password reset link has been sent. Please check your inbox and spam folder.'
              )}
            </p>
            <p className="mt-3 text-xs text-pink-700 font-medium">
              ⏰ {t('auth.linkExpiresIn', 'The link will expire in 15 minutes.')}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsSubmitted(false);
                setEmail('');
              }}
              className="w-full justify-center text-sm"
            >
              {t('auth.tryAnotherEmail', 'Try another email')}
            </Button>

            <button
              type="button"
              onClick={onGoToLogin}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-pink-600 hover:text-pink-700 hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('auth.backToSignIn', 'Back to Sign In')}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <div className="text-xs sm:text-sm">{error}</div>
            </div>
          )}

          <div className="flex flex-col">
            <label htmlFor="forgot-email" className="text-sm text-gray-600 font-medium mb-1.5 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-gray-400" />
              {t('auth.email', 'Email Address')}
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. yourname@example.com"
              className="border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 bg-white text-gray-800 text-sm placeholder:text-gray-400 transition"
              required
              disabled={loading}
              autoFocus
            />
            <span className="text-xs text-gray-400 mt-1.5">
              {t('auth.forgotEmailHint', "We'll send a single-use password recovery link to this address.")}
            </span>
          </div>

          <div className="pt-2 space-y-3">
            <Button
              type="submit"
              disabled={loading}
              className="w-full justify-center shadow-md shadow-pink-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  {t('auth.sendingLink', 'Sending Link...')}
                </>
              ) : (
                t('auth.sendResetLink', 'Send Reset Link')
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

export default ForgotPasswordPage;
