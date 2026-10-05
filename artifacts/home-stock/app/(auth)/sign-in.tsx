import React, { useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { Platform, Text } from 'react-native';
import { useSignIn, useSSO } from '@clerk/expo';
import {
  AuthButton,
  AuthField,
  AuthLink,
  AuthMessage,
  AuthScreen,
} from '@/components/AuthScreen';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

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

export default function SignInScreen() {
  const router = useRouter();
  const colors = useColors();
  const { signIn, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [message, setMessage] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  async function finishSignIn() {
    await signIn.finalize({
      navigate: async ({ session }) => {
        if (session?.currentTask) {
          setMessage('Complete the remaining sign-in step to continue.');
          return;
        }
        router.replace('/(tabs)');
      },
    });
  }

  async function submitPassword() {
    setMessage('');
    try {
      const { error } = await signIn.password({
        emailAddress: emailAddress.trim(),
        password,
      });
      if (error) {
        setMessage(messageFromError(error, 'Could not sign in. Check your details and try again.'));
        return;
      }

      if (signIn.status === 'complete') {
        await finishSignIn();
        return;
      }

      if (
        signIn.status === 'needs_client_trust' ||
        signIn.status === 'needs_second_factor'
      ) {
        const emailCodeFactor = signIn.supportedSecondFactors?.find(
          (factor) => factor.strategy === 'email_code',
        );
        if (emailCodeFactor) {
          const result = await signIn.mfa.sendEmailCode();
          if (result.error) {
            setMessage(messageFromError(result.error, 'Could not send a verification code.'));
            return;
          }
          setNeedsCode(true);
          return;
        }
      }

      setMessage('This account needs an additional sign-in step that is not available here.');
    } catch (error) {
      setMessage(messageFromError(error, 'Could not sign in. Please try again.'));
    }
  }

  async function verifyCode() {
    setMessage('');
    try {
      const { error } = await signIn.mfa.verifyEmailCode({ code: code.trim() });
      if (error) {
        setMessage(messageFromError(error, 'That code could not be verified.'));
        return;
      }
      if (signIn.status === 'complete') {
        await finishSignIn();
      } else {
        setMessage('The sign-in is not complete yet. Check the code and try again.');
      }
    } catch (error) {
      setMessage(messageFromError(error, 'That code could not be verified.'));
    }
  }

  async function signInWithGoogle() {
    setMessage('');
    setGoogleLoading(true);
    try {
      const result = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({ scheme: 'home-stock' }),
      });

      if (result.createdSessionId && result.setActive) {
        await result.setActive({
          session: result.createdSessionId,
          navigate: async ({ session }) => {
            if (session?.currentTask) {
              setMessage('Complete the remaining sign-in step to continue.');
              return;
            }
            router.replace('/(tabs)');
          },
        });
      } else if (result.signUp?.status === 'missing_requirements') {
        router.push('/(auth)/continue-sign-up');
      } else {
        setMessage('Google sign-in needs another step. Try email and password instead.');
      }
    } catch (error) {
      setMessage(
        messageFromError(
          error,
          'Google sign-in is unavailable. Try email and password instead.',
        ),
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  const fetching = fetchStatus === 'fetching' || googleLoading;

  return (
    <AuthScreen
      title={needsCode ? 'Verify it’s you' : 'Welcome back'}
      subtitle={
        needsCode
          ? 'Enter the security code sent to your email.'
          : 'Sign in to sync your household stock across app updates and devices.'
      }
    >
      {needsCode ? (
        <>
          <AuthField
            label="Email verification code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            placeholder="Enter the code"
          />
          {message ? <AuthMessage>{message}</AuthMessage> : null}
          <AuthButton
            title={fetching ? 'Verifying…' : 'Verify and continue'}
            onPress={() => void verifyCode()}
            disabled={fetching || !code.trim()}
          />
          <AuthLink
            title="Use a different account"
            onPress={() => {
              setNeedsCode(false);
              setCode('');
              setMessage('');
              signIn.reset();
            }}
          />
        </>
      ) : (
        <>
          <AuthButton
            title={googleLoading ? 'Opening Google…' : 'Continue with Google'}
            onPress={() => void signInWithGoogle()}
            disabled={fetching}
            secondary
          />
          <Text style={{ color: colors.mutedForeground, textAlign: 'center', fontSize: 11 }}>
            or continue with email
          </Text>
          <AuthField
            label="Email address"
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
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            placeholder="Your password"
          />
          {message ? <AuthMessage>{message}</AuthMessage> : null}
          <AuthButton
            title={fetchStatus === 'fetching' ? 'Signing in…' : 'Sign in'}
            onPress={() => void submitPassword()}
            disabled={
              fetchStatus === 'fetching' ||
              !emailAddress.trim() ||
              !password
            }
          />
          <AuthLink
            title="Create an account"
            onPress={() => router.push('/(auth)/sign-up')}
          />
        </>
      )}
      <Text
        style={{
          color: colors.mutedForeground,
          textAlign: 'center',
          fontSize: 10,
          lineHeight: 15,
          marginTop: 2,
        }}
      >
        Your inventory is private to your account.
      </Text>
    </AuthScreen>
  );
}