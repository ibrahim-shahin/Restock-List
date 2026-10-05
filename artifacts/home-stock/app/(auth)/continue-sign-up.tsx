import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSignUp } from '@clerk/expo';
import {
  AuthButton,
  AuthField,
  AuthMessage,
  AuthScreen,
} from '@/components/AuthScreen';

function fieldKey(field: string): string {
  return field.replace(/([-_][a-z])/g, (match) =>
    match.toUpperCase().replace(/[-_]/, ''),
  );
}

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

export default function ContinueSignUpScreen() {
  const router = useRouter();
  const { signUp, fetchStatus } = useSignUp();
  const fields = useMemo(
    () => (signUp.status === 'missing_requirements' ? signUp.missingFields : []),
    [signUp],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  async function continueAccount() {
    setMessage('');
    try {
      const updates: Record<string, unknown> = {};
      for (const field of fields) {
        if (field === 'legal_accepted') {
          updates.legalAccepted = true;
        } else {
          updates[fieldKey(field)] = values[field] ?? '';
        }
      }
      const { error } = await signUp.update(
        updates as Parameters<typeof signUp.update>[0],
      );
      if (error) {
        setMessage(messageFromError(error, 'Could not update the account details.'));
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
      } else {
        setMessage('Some account details are still missing.');
      }
    } catch (error) {
      setMessage(messageFromError(error, 'Could not complete sign-up.'));
    }
  }

  return (
    <AuthScreen
      title="Finish setting up"
      subtitle="Enter the remaining details required to create your account."
    >
      {fields.map((field) => (
        <AuthField
          key={field}
          label={field.replaceAll('_', ' ')}
          value={values[field] ?? ''}
          onChangeText={(value) =>
            setValues((current) => ({ ...current, [field]: value }))
          }
          autoCapitalize="words"
          placeholder={`Enter ${field.replaceAll('_', ' ')}`}
        />
      ))}
      {message ? <AuthMessage>{message}</AuthMessage> : null}
      <View nativeID="clerk-captcha" />
      <AuthButton
        title={fetchStatus === 'fetching' ? 'Saving…' : 'Continue'}
        onPress={() => void continueAccount()}
        disabled={fetchStatus === 'fetching'}
      />
    </AuthScreen>
  );
}