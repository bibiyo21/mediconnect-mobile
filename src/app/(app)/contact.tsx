import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Notice, ResendCodeButton, Screen, TextField } from '@/components/ui';
import { confirmContactChange, requestContactChangeCode, type OtpChallenge, type VerifiedCode } from '@/features/auth/api';
import { applyServerErrors } from '@/lib/forms';
import { isEmail, normalizeMobile } from '@/lib/validation';

type Kind = 'email' | 'mobile';

const PH_MOBILE = /^(\+?63|0)?9\d{9}$/;

const requestSchema = (kind: Kind) =>
  z.object({
    contact: z
      .string()
      .trim()
      .min(1, kind === 'email' ? 'Enter your new email address.' : 'Enter your new mobile number.')
      .refine((v) => (kind === 'email' ? isEmail(v) : PH_MOBILE.test(normalizeMobile(v))), kind === 'email' ? 'Enter a valid email address.' : 'Enter a valid Philippine mobile number (09XX XXX XXXX).'),
    current_password: z.string().min(1, 'Enter your current password.'),
  });

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.') });

/**
 * Add or change the email address or mobile number used to sign in.
 * Step 1: the new address and the current password. Step 2: the code sent to it.
 */
export default function ChangeContact() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: Kind = params.kind === 'mobile' ? 'mobile' : 'email';
  const noun = kind === 'email' ? 'email address' : 'mobile number';
  const queryClient = useQueryClient();

  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const verified = useRef<VerifiedCode>({});

  const step1 = useForm<z.infer<ReturnType<typeof requestSchema>>>({ resolver: zodResolver(requestSchema(kind)), defaultValues: { contact: '', current_password: '' } });
  const step2 = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } });

  const request = useMutation({
    mutationFn: (values: { contact: string; current_password: string }) => requestContactChangeCode(values.contact, values.current_password),
    onSuccess: (next, values) => {
      setChallenge(next);
      setContact(values.contact.trim());
      setPassword(values.current_password);
      verified.current = {};
      setFormError(null);
    },
    onError: (error) => setFormError(applyServerErrors(error, step1.setError, { email: 'contact', mobile: 'contact', current_password: 'current_password' })),
  });

  const resend = useMutation({
    mutationFn: () => requestContactChangeCode(contact, password),
    onSuccess: (next) => {
      setChallenge(next);
      step2.reset();
      setResent(true);
      setFormError(null);
    },
    onError: (error) => setFormError(applyServerErrors(error, step2.setError)),
  });

  const confirm = useMutation({
    mutationFn: (code: string) => confirmContactChange({ contact, challengeId: challenge?.challenge_id ?? '', code }, verified.current),
    onSuccess: (account) => {
      setPassword('');
      queryClient.setQueryData(['me'], account);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      if (router.canGoBack()) router.back();
      else router.replace('/account');
    },
    onError: (error) => setFormError(applyServerErrors(error, step2.setError, { code: 'code', verification_token: 'code', email: 'code', mobile: 'code' })),
  });

  if (!challenge) {
    const submit = step1.handleSubmit((values) => {
      setFormError(null);
      request.mutate(values);
    });
    return (
      <Screen title={`Your ${noun}`} subtitle={`We will send a 6-digit code to the new ${noun}. Your other devices will be signed out after the change.`}>
        {formError ? <Notice tone="error" message={formError} /> : null}
        <Controller
          control={step1.control}
          name="contact"
          render={({ field }) => (
            <TextField
              label={kind === 'email' ? 'New email address' : 'New mobile number'}
              hint={kind === 'mobile' ? 'For example 0917 123 4567' : undefined}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={kind === 'email' ? 'email-address' : 'phone-pad'}
              autoComplete={kind === 'email' ? 'email' : 'tel'}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={step1.formState.errors.contact?.message}
            />
          )}
        />
        <Controller
          control={step1.control}
          name="current_password"
          render={({ field }) => (
            <TextField
              label="Current password"
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              onSubmitEditing={() => submit()}
              error={step1.formState.errors.current_password?.message}
            />
          )}
        />
        <Button label="Send code" onPress={submit} loading={request.isPending} />
      </Screen>
    );
  }

  const submitCode = step2.handleSubmit((values) => {
    setFormError(null);
    confirm.mutate(values.code);
  });
  return (
    <Screen title="Enter your code" subtitle={`If ${challenge.destination_masked} can receive a code, we have sent one. It expires in a few minutes.`}>
      {formError ? <Notice tone="error" message={formError} /> : null}
      {resent ? <Notice tone="success" message="A new code is on its way." /> : null}
      <Controller
        control={step2.control}
        name="code"
        render={({ field }) => (
          <TextField
            label="6-digit code"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={field.value}
            onChangeText={field.onChange}
            onSubmitEditing={() => submitCode()}
            error={step2.formState.errors.code?.message}
          />
        )}
      />
      <Button label={`Save new ${noun}`} onPress={submitCode} loading={confirm.isPending} />
      <ResendCodeButton onResend={() => resend.mutate()} loading={resend.isPending} />
    </Screen>
  );
}
