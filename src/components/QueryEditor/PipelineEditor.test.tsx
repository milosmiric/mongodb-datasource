import React from 'react';
import { render, screen } from '@testing-library/react';
import { PipelineEditor } from './PipelineEditor';

describe('PipelineEditor', () => {
  it('renders the format button', () => {
    render(<PipelineEditor value='[{"$limit": 10}]' onChange={() => {}} />);
    expect(screen.getByText('Format')).toBeTruthy();
  });
});
