import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderRoute, signIn } from '@/test/render';

describe('ProjectsPage filters', () => {
  it('keeps both filters when both change before the page has re-rendered', async () => {
    signIn();
    const { router } = renderRoute('/projects');
    const stage = await screen.findByLabelText('Stage');
    const province = screen.getByLabelText('Province');

    // Both changes land in one render cycle, so the second must build on the first, not on the old URL
    act(() => {
      fireEvent.change(stage, { target: { value: 'operation' } });
      fireEvent.change(province, { target: { value: 'Gandaki' } });
    });

    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('stage')).toBe('operation');
      expect(params.get('province')).toBe('Gandaki');
    });
  }, 20_000);
});
