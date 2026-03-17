import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
}

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

export const Table = ({ children, className = '' }: TableProps) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="min-w-full divide-y divide-gray-200">
      {children}
    </table>
  </div>
);

export const TableHeader = ({ children, className = '' }: TableHeaderProps) => (
  <thead className={`bg-gray-50 ${className}`}>
    {children}
  </thead>
);

export const TableBody = ({ children, className = '' }: TableBodyProps) => (
  <tbody className={`bg-white divide-y divide-gray-200 ${className}`}>
    {children}
  </tbody>
);

export const TableRow = ({ children, className = '' }: TableRowProps) => (
  <tr className={className}>
    {children}
  </tr>
);

export const TableHead = ({ children, className = '', onClick }: TableHeadProps) => (
  <th 
    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}
    onClick={onClick}
  >
    {children}
  </th>
);

export const TableCell = ({ children, className = '' }: TableCellProps) => (
  <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className}`}>
    {children}
  </td>
);