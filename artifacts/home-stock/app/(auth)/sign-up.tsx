import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useSignUp } from '@clerk/expo';
import {
  AuthButton,
  AuthField,
  AuthLink,
  AuthMessage,
  AuthScreen,
} from '@/components/AuthScreen';
import { useColors } from '@/hooks/useColors';

function messageFromError(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return fallback;
}

export default function SignUpScreen() {
  const router = useRouter();
  const colors = useColors();
  const { signUp, fetchStatus } = useSignUp();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [message, setMessage] = useState('');

  async function createAccount() {
    setMessage('');
    try {
      const { error } = await signUp.password({
        emailAddress: emailAddress.trim(),
        password,
      });
      if (error) {
        setMessage(messageFromError(error, 'Could not create the account.'));
        return;
      }
      const result = await signUp.verifications.sendEmailCode();
      if (result.error) {
        setMessage(messageFromError(result.error, 'Could not send the verification code.'));
        return;
      }
      setNeedsVerification(true);
    } catch (error) {
      setMessage(messageFromError(error, 'Could not create the account. Please try again.'));
    }
  }

  async function verifyEmail() {
    setMessage('');
    try {
      const { error } = await signUp.verifications.verifyEmailCode({
        code: code.trim(),
      });
      if (error) {
        setMessage(messageFromError(error, 'That code could not be verified.'));
        return;
      }
      if (signUp.status === 'complete') {
        await signUp.finalize({
          navigate: async ({ session }) => {
            if (session?.currentTask) {
              setMessage('Complete the remaining account step to continue.');
              return;
            }
            router.replace('/(tabs)');
          },
        });
      } else if (signUp.status === 'missing_requirements') {
        router.replace('/(auth)/continue-sign-up');
      } else {
        setMessage('The account is not complete yet. Check the code and try again.');
      }
    } catch (error) {
      setMessage(messageFromError(error, 'That code could not be verified.'));
    }
  }

  return (
    <AuthScreen
      title={needsVerification ? 'Check your email' : 'Create your account'}
      subtitle={
        needsVerification
          ? `Enter the verification code sent to ${emailAddress.trim()}.`
          : 'Create an account to keep a cloud copy of your household stock.'
      }
    >
      {needsVerification ? (
        <>
          <AuthField
            label="Email verification code"
            testID="sign-up-verification-code-input"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            placeholder="Enter the code"
          />
          {message ? <AuthMessage>{message}</AuthMessage> : null}
          <AuthButton
            title={fetchStatus === 'fetching' ? 'Verifying…' : 'Verify email'}
            onPress={() => void verifyEmail()}
            disabled={fetchStatus === 'fetching' || !code.trim()}
            testID="verify-sign-up-code-button"
          />
          <AuthLink
            title="Send a new code"
            onPress={() => void signUp.verifications.sendEmailCode()}
            testID="resend-sign-up-code-link"
          />
        </>
      ) : (
        <>
          <AuthField
            label="Email address"
            testID="sign-up-email-input"
            value={emailAddress}
            onChangeText={setEmailAddress}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@example.com"
          />
          <AuthField
            label="Password"
            testID="sign-up-password-input"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="Create a password"
          />
          {message ? <AuthMessage>{message}</AuthMessage> : null}
          <AuthButton
            title={fetchStatus === 'fetching' ? 'Creating account…' : 'Create account'}
            onPress={() => void createAccount()}
            disabled={
              fetchStatus === 'fetching' ||
              !emailAddress.trim() ||
              !password
            }
            testID="create-account-button"
          />
          <AuthLink
            title="Already have an account? Sign in"
            onPress={() => router.replace('/(auth)/sign-in')}
            testID="sign-in-link"
          />
        </>
      )}
      <View nativeID="clerk-captcha" />
      <Text
        style={{
          color: colors.mutedForeground,
          textAlign: 'center',
          fontSize: 10,
          lineHeight: 15,
        }}
      >
        You can export a JSON backup at any time.
      </Text>
    </AuthScreen>
  );
}