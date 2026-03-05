import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryEditor } from './QueryEditor';
import { MongoDBQuery } from '../../types';
import { DataSource } from '../../datasource';

// Mock the PipelineEditor to avoid CodeEditor/monaco dependency.
jest.mock('./PipelineEditor', () => ({
  PipelineEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="pipeline-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

// Mock the hooks to avoid real backend calls.
jest.mock('../../hooks/useDatabases', () => ({
  useDatabases: () => ({
    databases: ['demo', 'admin', 'local'],
    loading: false,
    error: null,
  }),
}));

jest.mock('../../hooks/useCollections', () => ({
  useCollections: () => ({
    collections: ['sensors', 'users', 'events'],
    loading: false,
    error: null,
  }),
}));

const mockDatasource = {
  uid: 'test-uid',
} as DataSource;

const defaultQuery: MongoDBQuery = {
  refId: 'A',
  database: 'demo',
  collection: 'sensors',
  pipeline: '[{"$limit": 100}]',
  timeField: '',
  format: 'table',
  legendFormat: '',
};

const defaultProps = {
  query: defaultQuery,
  onChange: jest.fn(),
  onRunQuery: jest.fn(),
  datasource: mockDatasource,
};

describe('QueryEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders database and collection selects', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Collection')).toBeInTheDocument();
  });

  it('renders pipeline editor', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.getByTestId('pipeline-editor')).toBeInTheDocument();
  });

  it('renders format select', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.getByText('Format')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.getByText('Time Series')).toBeInTheDocument();
  });

  it('shows time field input when format is time_series', () => {
    const props = {
      ...defaultProps,
      query: { ...defaultQuery, format: 'time_series' as const },
    };

    render(<QueryEditor {...props} />);
    expect(screen.getByText('Time Field')).toBeInTheDocument();
    expect(screen.getByText('Legend')).toBeInTheDocument();
  });

  it('hides time field input when format is table', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.queryByText('Time Field')).not.toBeInTheDocument();
    expect(screen.queryByText('Legend')).not.toBeInTheDocument();
  });

  it('calls onChange with format when format changes', async () => {
    const user = userEvent.setup();
    render(<QueryEditor {...defaultProps} />);

    // Find the Time Series radio button.
    const timeSeriesLabel = screen.getByText('Time Series');
    await user.click(timeSeriesLabel);

    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'time_series' })
    );
  });

  it('calls onChange when time field value is entered', async () => {
    const user = userEvent.setup();
    const tsProps = {
      ...defaultProps,
      query: { ...defaultQuery, format: 'time_series' as const },
    };

    render(<QueryEditor {...tsProps} />);

    const timeFieldInput = screen.getByPlaceholderText('timestamp');
    await user.type(timeFieldInput, 't');

    expect(tsProps.onChange).toHaveBeenCalled();
  });
});
