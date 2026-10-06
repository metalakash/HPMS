import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type Column } from './DataTable';
import { Pagination } from './Pagination';

interface Row {
  id: string;
  name: string;
  amount: number;
}

const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', render: (r) => r.name },
  { key: 'amount', header: 'Amount', align: 'right', render: (r) => r.amount },
];
const rows: Row[] = [
  { id: 'a', name: 'Arun', amount: 10 },
  { id: 'b', name: 'Bheri', amount: 20 },
];

describe('DataTable', () => {
  it('renders a captioned table with a header and one row per item', () => {
    render(<DataTable caption="Things" columns={columns} rows={rows} rowKey={(r) => r.id} />);

    const table = screen.getByRole('table', { name: 'Things' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Name', 'Amount']);
    const body = within(table).getAllByRole('row').slice(1);
    expect(body).toHaveLength(2);
    expect(body[1]).toHaveTextContent('Bheri');
    expect(body[1]).toHaveTextContent('20');
  });

  it('shows the empty state instead of a table when there are no rows', () => {
    render(
      <DataTable caption="Things" columns={columns} rows={[]} rowKey={(r) => r.id} empty={<p>Nothing here</p>} />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows skeleton rows while loading, not the empty state', () => {
    render(
      <DataTable caption="Things" columns={columns} rows={[]} rowKey={(r) => r.id} loading empty={<p>Nothing here</p>} />,
    );
    expect(screen.queryByText('Nothing here')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1 + 5);
  });

  it('calls onRowClick with the clicked row', async () => {
    const onRowClick = vi.fn();
    render(<DataTable caption="Things" columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />);

    await userEvent.setup().click(screen.getByText('Bheri'));
    expect(onRowClick).toHaveBeenCalledExactlyOnceWith(rows[1]);
  });
});

describe('Pagination', () => {
  const setup = (page: number, totalCount: number) => {
    const onPageChange = vi.fn();
    render(<Pagination page={page} pageSize={20} totalCount={totalCount} onPageChange={onPageChange} />);
    return {
      onPageChange,
      previous: screen.getByRole('button', { name: 'Previous page' }),
      next: screen.getByRole('button', { name: 'Next page' }),
    };
  };

  it('shows the visible range and page count', () => {
    setup(2, 50);
    expect(screen.getByText('21–40 of 50')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('caps the range on a short last page', () => {
    setup(3, 50);
    expect(screen.getByText('41–50 of 50')).toBeInTheDocument();
  });

  it('disables Previous on the first page and Next on the last', () => {
    const first = setup(1, 50);
    expect(first.previous).toBeDisabled();
    expect(first.next).toBeEnabled();
  });

  it('disables Next on the last page', () => {
    const last = setup(3, 50);
    expect(last.previous).toBeEnabled();
    expect(last.next).toBeDisabled();
  });

  it('requests the neighbouring page', async () => {
    const user = userEvent.setup();
    const { onPageChange, previous, next } = setup(2, 50);
    await user.click(next);
    await user.click(previous);
    expect(onPageChange.mock.calls).toEqual([[3], [1]]);
  });

  it('handles an empty result as a single page', () => {
    const { previous, next } = setup(1, 0);
    expect(screen.getByText('0–0 of 0')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(previous).toBeDisabled();
    expect(next).toBeDisabled();
  });
});
