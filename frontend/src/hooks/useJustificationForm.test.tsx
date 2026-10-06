import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { useModalStore } from '@/store/useModalStore';
import { useJustificationForm } from './useJustificationForm';

const REASON = 'Monsoon delay per NEA letter 2083/06/15';
const CHANGES = { forecast_cod_ad: '2027-03-31' };

function onSubmitMutation(resolver: () => Response) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  server.use(
    http.post('*/mutations/submit-with-justification', async ({ request }) => {
      calls.push({
        path: new URL(request.url).pathname,
        body: (await request.json()) as Record<string, unknown>,
      });
      return resolver();
    }),
  );
  return calls;
}

const setup = () => {
  const onSuccess = vi.fn();
  const onError = vi.fn();
  const hook = renderHook(() =>
    useJustificationForm({
      entityType: 'PROJECT',
      entityId: 'p-1',
      action: 'UPDATE',
      changes: CHANGES,
      onSuccess,
      onError,
    }),
  );
  return { ...hook, onSuccess, onError };
};

describe('useJustificationForm', () => {
  it('rejects a reason under 20 characters without calling the API', async () => {
    const calls = onSubmitMutation(() => HttpResponse.json({}));
    const { result } = setup();

    act(() => result.current.setReason('too short'));
    await act(() => result.current.submit());

    expect(result.current.error).toBe('Justification must be at least 20 characters');
    expect(calls).toHaveLength(0);

    act(() => result.current.clearError());
    expect(result.current.error).toBe('');
  });

  it('submits the trimmed justification with the entity and document name', async () => {
    const calls = onSubmitMutation(() => HttpResponse.json({ data: { approval_request_id: 'ar-9' } }));
    useModalStore.getState().openModal('justification');
    const { result, onSuccess } = setup();

    act(() => {
      result.current.setReason(`  ${REASON}  `);
      result.current.setDocumentFile(new File(['x'], 'nea-letter.pdf'));
    });
    await act(() => result.current.submit());

    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe('/api/v1/mutations/submit-with-justification');
    expect(calls[0]?.body).toMatchObject({
      entity_type: 'PROJECT',
      entity_id: 'p-1',
      action: 'UPDATE',
      changes: CHANGES,
      justification: REASON,
      document_url: 'nea-letter.pdf',
    });
    expect(onSuccess).toHaveBeenCalledExactlyOnceWith('ar-9');
    // Form reset and modal closed
    expect(result.current.reason).toBe('');
    expect(result.current.documentFile).toBeNull();
    expect(useModalStore.getState().modals.justification?.isOpen).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps the form and reports the error when the API fails', async () => {
    onSubmitMutation(() => HttpResponse.json({ detail: 'Not a maker' }, { status: 403 }));
    const { result, onSuccess, onError } = setup();

    act(() => result.current.setReason(REASON));
    await act(() => result.current.submit());

    await waitFor(() => expect(result.current.error).toBe('Not a maker'));
    expect(onError).toHaveBeenCalledExactlyOnceWith('Not a maker');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.reason).toBe(REASON);
    expect(result.current.isLoading).toBe(false);
  });
});
