import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  linkToHome?: boolean
  className?: string
  showSubtitle?: boolean
  showBadge?: boolean
  badgeText?: string
}

export function BrandLogo({
  size = 'md',
  linkToHome = true,
  className,
  showSubtitle = true,
  showBadge = true,
  badgeText = 'Preprofesionales',
}: BrandLogoProps) {
  const iconSizes = {
    sm: 'size-7 rounded-lg',
    md: 'size-8 rounded-xl',
    lg: 'size-11 rounded-2xl',
  }

  const svgSizes = {
    sm: 'size-4',
    md: 'size-4.5',
    lg: 'size-6',
  }

  const textSizes = {
    sm: 'text-14',
    md: 'text-16',
    lg: 'text-22',
  }

  const badgeSizes = {
    sm: 'text-[9px] px-1.5 py-0.2',
    md: 'text-[10px] px-2 py-0.5',
    lg: 'text-11 px-2.5 py-0.5',
  }

  const subtitleSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-11',
  }

  const content: ReactNode = (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      {/* Isotipo con gradiente cobalto / zafiro y doble resplandor interno */}
      <div
        aria-hidden="true"
        className={cn(
          'relative flex flex-none items-center justify-center bg-gradient-to-tr from-[#1E40AF] via-[#2563EB] to-[#3B82F6] text-white shadow-sm shadow-blue-900/20 ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105',
          iconSizes[size],
        )}
      >
        <svg
          className={cn('shrink-0 drop-shadow-xs', svgSizes[size])}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Birrete académico moderno */}
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      </div>

      {/* Logotipo tipográfico y metadatos de marca */}
      <div className="flex flex-col justify-center text-left">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={cn('font-display font-bold tracking-tight text-ink', textSizes[size])}>
            Prácticas
          </span>
          <span className={cn('font-display font-extrabold text-stamp leading-none', textSizes[size])}>
            .
          </span>
          {showBadge && (
            <span
              className={cn(
                'rounded-full bg-blue-50/90 font-data font-semibold uppercase tracking-wider text-stamp border border-blue-200/60 leading-tight',
                badgeSizes[size],
              )}
            >
              {badgeText}
            </span>
          )}
        </div>
        {showSubtitle && (
          <span
            className={cn(
              'mt-0.5 font-data uppercase tracking-[0.12em] text-inkMute leading-none font-medium',
              subtitleSizes[size],
            )}
          >
            Sistema de Vinculación
          </span>
        )}
      </div>
    </div>
  )

  if (linkToHome) {
    return (
      <Link
        to="/"
        className="group inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp rounded-lg transition-opacity hover:opacity-95"
        title="Ir al inicio de Prácticas Preprofesionales"
      >
        {content}
      </Link>
    )
  }

  return content
}
