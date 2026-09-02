import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VirtualizedTable, ColumnDef } from '../components/VirtualizedTable';

vi.mock('react-virtuoso', () => ({
  TableVirtuoso: ({ data, columns, fixedHeaderContent, itemContent, style }: any) => (
    <div style={style}>
      <table>
        <thead>{fixedHeaderContent()}</thead>
        <tbody>
          {data.map((row: any, i: number) => (
            <tr key={i}>{itemContent(i, row)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
}));

const columns: ColumnDef[] = [
  { key: 'name', header: 'Name', width: 150 },
  { key: 'age', header: 'Age', width: 80 },
  { key: 'role', header: 'Role' },
];

const data = [
  { name: 'Alice', age: 30, role: 'Engineer' },
  { name: 'Bob', age: 25, role: 'Designer' },
  { name: 'Charlie', age: 35, role: 'Manager' },
];

describe('VirtualizedTable', () => {
  it('renders all columns from columns prop', () => {
    render(<VirtualizedTable columns={columns} data={data} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
  });

  it('renders correct number of rows from data prop', () => {
    render(<VirtualizedTable columns={columns} data={data} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('shows empty message when data is empty', () => {
    render(<VirtualizedTable columns={columns} data={[]} emptyMessage="No records found" />);
    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('shows default empty message when data empty and no message provided', () => {
    render(<VirtualizedTable columns={columns} data={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders cell values using render prop when provided', () => {
    const colsWithRender: ColumnDef[] = [
      { key: 'name', header: 'Name', render: (v) => <strong>{v}</strong> },
    ];
    render(<VirtualizedTable columns={colsWithRender} data={[{ name: 'Alice' }]} />);
    const strong = document.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong).toHaveTextContent('Alice');
  });

  it('sorts data when clicking column header', () => {
    render(<VirtualizedTable columns={columns} data={data} />);
    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);
    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('toggles sort direction on second click', () => {
    render(<VirtualizedTable columns={columns} data={data} />);
    const ageHeader = screen.getByText('Age');
    fireEvent.click(ageHeader);
    fireEvent.click(ageHeader);
    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('applies custom className', () => {
    const { container } = render(<VirtualizedTable columns={columns} data={data} className="custom-class" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toMatch(/custom-class/);
  });

  it('handles null values in cells', () => {
    const testData = [{ name: 'Alice', age: null, role: 'Engineer' }];
    render(<VirtualizedTable columns={columns} data={testData} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    const cells = document.querySelectorAll('td');
    expect(cells.length).toBe(3);
  });
});
