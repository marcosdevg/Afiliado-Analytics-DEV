'use client'

import { useMemo } from 'react'
import { useTheme } from './ThemeProvider'

export type ChartColors = {
  text: string
  textSecondary: string
  grid: string
  tooltipBg: string
  tooltipBorder: string
  tooltipTitle: string
  tooltipBody: string
}

/** Cores para Chart.js que adaptam ao tema claro/escuro do app. */
export function useChartColors(): ChartColors {
  const { theme } = useTheme()
  return useMemo<ChartColors>(() => {
    if (theme === 'light') {
      return {
        text: '#18181B',
        textSecondary: '#52525B',
        grid: 'rgba(24, 24, 27, 0.1)',
        tooltipBg: '#FFFFFF',
        tooltipBorder: '#E4E4E7',
        tooltipTitle: '#18181B',
        tooltipBody: '#52525B',
      }
    }
    return {
      text: '#FFFFFF',
      textSecondary: '#E9E9E9',
      grid: 'rgba(233, 233, 233, 0.1)',
      tooltipBg: '#18181B',
      tooltipBorder: '#27272A',
      tooltipTitle: '#FFFFFF',
      tooltipBody: '#E9E9E9',
    }
  }, [theme])
}
