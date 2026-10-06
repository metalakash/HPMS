import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BaseModal } from './BaseModal';
import { ConfirmationModal } from './ConfirmationModal';
import { JustificationModal } from './JustificationModal';

const REASON = 'Monsoon delay per NEA letter 2083/06/15';

describe('BaseModal', () => {
  it('renders nothing while closed', () => {
    render(
      <BaseModal isOpen={false} onClose={vi.fn()} title="Hidden">
        body
      </BaseModal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a labelled, described modal dialog', () => {
    render(
      <BaseModal isOpen onClose={vi.fn()} title="Edit COD" description="Revised date" footer={<p>foot</p>}>
        body
      </BaseModal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit COD' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Revised date');
    expect(dialog).toHaveTextContent('body');
    expect(dialog).toHaveTextContent('foot');
  });

  it('closes on the close button, Escape and a click outside, but not a click inside', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onBackdropClick = vi.fn();
    render(
      <BaseModal isOpen onClose={onClose} onBackdropClick={onBackdropClick} title="Edit COD">
        body
      </BaseModal>,
    );

    fireEvent.mouseDown(screen.getByText('body'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(onBackdropClick).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll while open and restores it afterwards', () => {
    document.body.style.overflow = 'auto';
    const { rerender } = render(
      <BaseModal isOpen onClose={vi.fn()} title="t">
        body
      </BaseModal>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <BaseModal isOpen={false} onClose={vi.fn()} title="t">
        body
      </BaseModal>,
    );
    expect(document.body.style.overflow).toBe('auto');
  });
});

describe('ConfirmationModal', () => {
  const props = { isOpen: true, title: 'Drop project', message: 'This cannot be undone.' };

  it('confirms, then closes', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ConfirmationModal {...props} onClose={onClose} onConfirm={onConfirm} confirmText="Drop" />);

    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Drop' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open when the action fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onClose = vi.fn();
    render(<ConfirmationModal {...props} onClose={onClose} onConfirm={vi.fn().mockRejectedValue(new Error('no'))} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancels without confirming', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmationModal {...props} onClose={onClose} onConfirm={onConfirm} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables both buttons while loading', () => {
    render(<ConfirmationModal {...props} isLoading onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Confirm/ })).toBeDisabled();
  });
});

describe('JustificationModal', () => {
  const setup = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
    const onClose = vi.fn();
    render(
      <JustificationModal
        isOpen
        onClose={onClose}
        entityType="PROJECT"
        entityId="p-1"
        actionName="updating the RCOD"
        onSubmit={onSubmit}
      />,
    );
    return {
      user: userEvent.setup(),
      onSubmit,
      onClose,
      reason: screen.getByRole('textbox', { name: /Justification/ }),
      submit: screen.getByRole('button', { name: 'Submit for Approval' }),
    };
  };

  it('names the action and entity being justified', () => {
    setup();
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Why are you updating the RCOD?');
    expect(screen.getByText('PROJECT')).toBeInTheDocument();
  });

  it('keeps submit disabled until the reason has 20 characters', async () => {
    const { user, reason, submit } = setup();
    expect(submit).toBeDisabled();

    await user.type(reason, 'Too short');
    expect(submit).toBeDisabled();
    expect(screen.getByText('9 / 20 characters')).toBeInTheDocument();

    await user.clear(reason);
    await user.type(reason, REASON);
    expect(submit).toBeEnabled();
  });

  it('does not count surrounding whitespace towards the minimum', async () => {
    const { user, reason, submit } = setup();
    await user.type(reason, `short${' '.repeat(30)}`);
    expect(submit).toBeDisabled();
  });

  it('submits the trimmed reason and closes', async () => {
    const { user, reason, submit, onSubmit, onClose } = setup();
    await user.type(reason, `  ${REASON}  `);
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ reason: REASON, documentUrl: undefined });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('passes the attached file name', async () => {
    const { user, reason, submit, onSubmit } = setup();
    await user.type(reason, REASON);
    await user.upload(
      screen.getByLabelText(/Supporting Document/),
      new File(['x'], 'nea-letter.pdf', { type: 'application/pdf' }),
    );
    expect(screen.getByText('Selected: nea-letter.pdf')).toBeInTheDocument();

    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledWith({ reason: REASON, documentUrl: 'nea-letter.pdf' });
  });

  it('rejects a file over 10MB', async () => {
    const { user } = setup();
    const big = new File(['x'], 'scan.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 });

    await user.upload(screen.getByLabelText(/Supporting Document/), big);
    expect(screen.getByText('File size must be less than 10MB')).toBeInTheDocument();
    expect(screen.queryByText('Selected: scan.pdf')).not.toBeInTheDocument();
  });

  it('shows the error and stays open when submission fails', async () => {
    const { user, reason, submit, onClose } = setup(vi.fn().mockRejectedValue(new Error('Checker unavailable')));
    await user.type(reason, REASON);
    await user.click(submit);

    expect(await screen.findByText('Checker unavailable')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(reason).toHaveValue(REASON);
  });
});
