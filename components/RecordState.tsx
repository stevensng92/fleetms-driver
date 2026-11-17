import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, type Href } from 'expo-router';
import { AppFrame } from './AppFrame';
import { AppHeader } from './AppHeader';
import { Button } from './Button';
import { Card } from './Card';
import { LoadError } from './LoadError';
import { useTokens } from '../theme/ThemeProvider';
import { space, type } from '../theme/tokens';

/** What a one-record screen says when its record is gone, and where its button goes. */
export type NotFoundWords = {
  title: string;
  body: string;
  actionLabel: string;
  to: Href;
};

/** The job screen and the Trip screen say the same thing when a job is gone. */
export const JOB_NOT_FOUND: NotFoundWords = {
  title: 'This job is no longer on your list',
  body: 'Dispatch may have cancelled or reassigned it.',
  actionLabel: 'Back to jobs',
  to: '/(tabs)',
};

type Query = {
  /** undefined: not loaded yet. null: loaded, and there is no such record. */
  data: unknown;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
};

/**
 * What a one-record screen (job, Trip, receipt) shows before it has its
 * record: the header with Back, and exactly one of a spinner, the error box
 * with Retry, or a "no longer on your list" card. A failed load wins over
 * not-found, so a retry that fails never claims the record is gone.
 */
export function RecordState({ title, errorTitle, notFound, query, bg }: {
  title: string;
  errorTitle: string;
  notFound: NotFoundWords;
  query: Query;
  bg?: string;
}) {
  const T = useTokens();
  let body: React.ReactNode;
  if (query.isError) {
    body = (
      <LoadError
        title={errorTitle}
        error={query.error}
        onRetry={() => { query.refetch(); }}
      />
    );
  } else if (query.data === null) {
    body = (
      <Card style={{ marginHorizontal: space[4], padding: space[5], gap: space[3] }}>
        <Text style={[type.heading, { color: T.text }]}>{notFound.title}</Text>
        <Text style={[type.body, { color: T.text2 }]}>{notFound.body}</Text>
        <View style={{ marginTop: space[2], alignSelf: 'flex-start' }}>
          <Button variant="secondary" onPress={() => router.replace(notFound.to)}>{notFound.actionLabel}</Button>
        </View>
      </Card>
    );
  } else {
    body = (
      <View testID="record-loading" style={{ paddingTop: 60, alignItems: 'center' }}>
        <ActivityIndicator color={T.text2}/>
      </View>
    );
  }
  return (
    <AppFrame bg={bg}>
      <AppHeader title={title} onBack={() => router.back()}/>
      {body}
    </AppFrame>
  );
}
