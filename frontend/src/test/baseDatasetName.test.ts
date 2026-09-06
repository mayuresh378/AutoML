import { describe, it, expect } from 'vitest';
import { baseDatasetName, stripExtension } from '../features/datasets/explorer/utils';

describe('baseDatasetName (versioning)', () => {
  it('strips extension', () => {
    expect(stripExtension('students.csv')).toBe('students');
  });

  it('groups cleaned versions under their base name', () => {
    expect(baseDatasetName('students.csv')).toBe('students');
    expect(baseDatasetName('students_cleaned_v2.csv')).toBe('students');
    expect(baseDatasetName('students_cleaned_v3.csv')).toBe('students');
    expect(baseDatasetName('students_cleaned.csv')).toBe('students');
  });

  it('groups featurized files too', () => {
    expect(baseDatasetName('students_cleaned_v3_featurized_v1.csv')).toBe('students');
    expect(baseDatasetName('students_featurized_v2.csv')).toBe('students');
    expect(baseDatasetName('featurized_students_v1.csv')).toBe('students');
  });

  it('leaves non-cleaned names intact', () => {
    expect(baseDatasetName('titanic.csv')).toBe('titanic');
    expect(baseDatasetName('housing.csv')).toBe('housing');
  });
});