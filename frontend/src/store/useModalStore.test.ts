import { beforeEach, describe, expect, it } from 'vitest';
import { useModalStore } from './useModalStore';

const store = () => useModalStore.getState();

describe('useModalStore', () => {
  beforeEach(() => store().closeAllModals());

  it('opens a modal with its data', () => {
    store().openModal('justification', { entityId: 'p-1' });
    expect(store().modals.justification).toEqual({
      isOpen: true,
      data: { entityId: 'p-1' },
      error: undefined,
    });
  });

  it('defaults data to an empty object', () => {
    store().openModal('confirmation');
    expect(store().modals.confirmation?.data).toEqual({});
  });

  it('closes one modal without touching the others', () => {
    store().openModal('a', { n: 1 });
    store().openModal('b', { n: 2 });
    store().closeModal('a');

    expect(store().modals.a).toEqual({ isOpen: false, data: undefined, error: undefined });
    expect(store().modals.b?.isOpen).toBe(true);
    expect(store().modals.b?.data).toEqual({ n: 2 });
  });

  it('merges updates into existing data and keeps the modal open', () => {
    store().openModal('a', { n: 1, keep: true });
    store().updateModalData('a', { n: 2 });
    expect(store().modals.a).toMatchObject({ isOpen: true, data: { n: 2, keep: true } });
  });

  it('sets and clears an error without losing data', () => {
    store().openModal('a', { n: 1 });
    store().setModalError('a', 'Upload failed');
    expect(store().modals.a).toMatchObject({ isOpen: true, data: { n: 1 }, error: 'Upload failed' });

    store().setModalError('a');
    expect(store().modals.a?.error).toBeUndefined();
  });

  it('reopening a modal clears a previous error', () => {
    store().openModal('a');
    store().setModalError('a', 'boom');
    store().openModal('a');
    expect(store().modals.a?.error).toBeUndefined();
  });

  it('closes everything', () => {
    store().openModal('a');
    store().openModal('b');
    store().closeAllModals();
    expect(store().modals).toEqual({});
  });
});
