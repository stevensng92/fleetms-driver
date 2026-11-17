// Value: protects=a test file that forgets installFakeDatabase() gets a clear instruction instead of a confusing null error; fails_when=live() stops throwing or loses the installFakeDatabase hint; why_new=every other test file installs the fake first, so the empty state is never reached; seam=none; no_claim=what the screens do with a missing client
jest.mock('../../lib/supabase', () => require('../fakeDatabase').supabaseModule);

import { supabase } from '../../lib/supabase';

describe('the fake database client before installFakeDatabase()', () => {
  it('tells the test author to install it', () => {
    expect(() => supabase.from('jobs')).toThrow(/installFakeDatabase/);
  });
});
