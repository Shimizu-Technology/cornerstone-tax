import { describe, expect, it } from 'vitest'
import { cumulativeMinutes } from './workLinesModel'

describe('cumulativeMinutes', () => {
  it('rounds cumulatively so minutes add up to the stored total', () => {
    expect(cumulativeMinutes([0.02, 0.02, 0.02, 0.02, 0.02, 0.02])).toEqual([1, 1, 2, 1, 1, 1])
    expect(cumulativeMinutes([0.33, 0.34, 0.33])).toEqual([20, 20, 20])
    expect(cumulativeMinutes([0.75, 1.5])).toEqual([45, 90])
  })
})
