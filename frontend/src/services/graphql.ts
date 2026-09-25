import { api } from './api';

interface GraphQLResponse<T> {
  data: T | null;
  errors: string[] | null;
}

export class GraphQLError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join('; '));
    this.name = 'GraphQLError';
  }
}

/**
 * Minimal client for POST /graphql. Caching is React Query's job, so there is
 * no Apollo layer. The backend has no Subscription type; real-time data comes
 * from the notifications WebSocket instead.
 */
export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
  operationName?: string,
): Promise<T> {
  const { data } = await api.post<GraphQLResponse<T>>('/graphql', {
    query,
    variables,
    operationName,
  });
  if (data.errors?.length) throw new GraphQLError(data.errors);
  if (data.data == null) throw new GraphQLError(['Empty GraphQL response']);
  return data.data;
}
