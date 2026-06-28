import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VariableQueryEditor } from './VariableQueryEditor';
import { MongoDBVariableQuery } from '../../types';
import { DataSource } from '../../datasource';

// Mock the PipelineEditor to avoid CodeEditor/monaco dependency.
jest.mock('../QueryEditor/PipelineEditor', () => ({
  PipelineEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="pipeline-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.mock('../../hooks/useDatabases', () => ({
  useDatabases: () => ({ databases: ['demo'], loading: false, error: null }),
}));

jest.mock('../../hooks/useCollections', () => ({
  useCollections: () => ({ collections: ['sensors'], loading: false, error: null }),
}));

jest.mock('../../hooks/useFields', () => ({
  useFields: () => ({
    fields: [{ path: 'sensor', types: ['string'], frequency: 1, indexed: true }],
    loading: false,
    error: null,
  }),
}));

const mockDatasource = { uid: 'test-uid' } as DataSource;

const builderQuery: MongoDBVariableQuery = {
  refId: 'A',
  mode: 'builder',
  database: 'demo',
  collection: 'sensors',
  field: '',
  pipeline: '',
};

const defaultProps = {
  query: builderQuery,
  onChange: jest.fn(),
  onRunQuery: jest.fn(),
  datasource: mockDatasource,
};

describe('VariableQueryEditor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders mode toggle, database and collection selects', () => {
    render(<VariableQueryEditor {...defaultProps} />);
    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('Builder')).toBeInTheDocument();
    expect(screen.getByText('Raw pipeline')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Collection')).toBeInTheDocument();
  });

  it('shows the Field input in builder mode and not the pipeline editor', () => {
    render(<VariableQueryEditor {...defaultProps} />);
    expect(screen.getByPlaceholderText('sensor')).toBeInTheDocument();
    expect(screen.queryByTestId('pipeline-editor')).not.toBeInTheDocument();
  });

  it('shows the pipeline editor in raw mode and not the Field input', () => {
    const props = { ...defaultProps, query: { ...builderQuery, mode: 'raw' as const } };
    render(<VariableQueryEditor {...props} />);
    expect(screen.getByTestId('pipeline-editor')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('sensor')).not.toBeInTheDocument();
  });

  it('calls onChange when switching to raw mode', async () => {
    const user = userEvent.setup();
    render(<VariableQueryEditor {...defaultProps} />);
    await user.click(screen.getByText('Raw pipeline'));
    expect(defaultProps.onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'raw' }));
  });

  it('offers inferred field suggestions via a datalist in builder mode', () => {
    render(<VariableQueryEditor {...defaultProps} />);
    const field = screen.getByPlaceholderText('sensor');
    const listId = field.getAttribute('list');
    expect(listId).toBeTruthy();
    const datalist = screen.getByTestId('mongodb-field-suggestions');
    expect(datalist.id).toBe(listId);
    expect(datalist.querySelector('option[value="sensor"]')).toBeInTheDocument();
  });

  it('commits the field value to onChange on blur (debounced input)', async () => {
    const user = userEvent.setup();
    render(<VariableQueryEditor {...defaultProps} />);
    const field = screen.getByPlaceholderText('sensor');
    await user.type(field, 'role');
    await user.tab(); // blur flushes the debounced value immediately
    expect(defaultProps.onChange).toHaveBeenCalledWith(expect.objectContaining({ field: 'role' }));
  });
});
